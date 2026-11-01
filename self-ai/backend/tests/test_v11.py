"""Streaming, thinking models, conversation memory, model download, docx, lenient evaluation, Wikipedia."""
import io
import json
import time
import zipfile

import httpx
import pytest

from app.ai import providers
from app.ai import router as ai_router
from app.config import get_settings
from app.services import evaluation as E
from app.services import memory as M
from app.services import search


def _events(resp) -> list[dict]:
    return [json.loads(line) for line in resp.text.splitlines() if line.strip()]


# ---------------- streaming ----------------

def test_stream_chat_saves_and_matches(client):
    r = client.post("/api/chat/stream", json={"message": "스트리밍 테스트"})
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/x-ndjson")
    ev = _events(r)
    assert ev[0]["type"] == "start" and ev[-1]["type"] == "done"
    deltas = [e["text"] for e in ev if e["type"] == "delta"]
    assert len(deltas) > 3  # really streamed in pieces
    done = ev[-1]
    assert "".join(deltas).strip() == done["answer"] and done["answer"].startswith("[TEST DOUBLE]")
    conv = client.get(f"/api/conversations/{done['conversation_id']}").json()
    assert [m["role"] for m in conv["messages"]] == ["user", "assistant"]
    assert conv["messages"][1]["evaluation"]["status"] == "completed"  # background task after the stream


def test_stream_continues_conversation_and_404(client):
    cid = _events(client.post("/api/chat/stream", json={"message": "첫 질문"}))[-1]["conversation_id"]
    done = _events(client.post("/api/chat/stream", json={"message": "두 번째", "conversation_id": cid}))[-1]
    assert done["conversation_id"] == cid
    assert client.post("/api/chat/stream", json={"message": "x", "conversation_id": 999}).status_code == 404


def test_stream_ai_down_is_503_before_streaming(client, ollama_down):
    r = client.post("/api/chat/stream", json={"message": "안녕"})
    assert r.status_code == 503 and "Ollama" in r.json()["detail"]["message"]


def test_stream_error_midway_saves_nothing(client, monkeypatch):
    def handler(req: httpx.Request):
        if req.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "fake-model:latest"}]})
        lines = [{"message": {"content": "부분 "}, "done": False}, {"error": "model runner crashed"}]
        return httpx.Response(200, content="".join(json.dumps(x) + "\n" for x in lines).encode())
    monkeypatch.setattr(ai_router, "local_factory",
                        lambda **kw: providers.OllamaProvider(transport=httpx.MockTransport(handler), **kw))
    ev = _events(client.post("/api/chat/stream", json={"message": "깨지는 답변"}))
    assert ev[-1]["type"] == "error" and "crashed" in ev[-1]["message"]
    assert client.get("/api/conversations").json() == []


# ---------------- thinking models ----------------

def test_thinking_hidden_in_regular_and_streamed_answers(client):
    client.put("/api/settings", json={"values": {"local_model": "fake-think"}})
    d = client.post("/api/chat", json={"message": "생각하는 모델"}).json()
    assert "<think>" not in d["answer"] and "숨겨져야" not in d["answer"] and d["answer"].startswith("[TEST DOUBLE]")
    ev = _events(client.post("/api/chat/stream", json={"message": "생각하는 모델 스트림"}))
    text = "".join(e["text"] for e in ev if e["type"] == "delta")
    assert "think" not in text and "숨겨져야" not in text and text.startswith("[TEST DOUBLE]")


def test_think_flag_dropped_if_server_rejects_it(monkeypatch):
    monkeypatch.setattr(providers.OllamaProvider, "_send_think", True)
    seen = []

    def handler(req: httpx.Request):
        body = json.loads(req.content)
        seen.append("think" in body)
        if "think" in body:
            return httpx.Response(400, json={"error": "\"m\" does not support thinking"})
        return httpx.Response(200, json={"model": "m", "message": {"content": "ok"}, "done": True})
    p = providers.OllamaProvider(transport=httpx.MockTransport(handler), default_model="m")
    assert p.chat([{"role": "user", "content": "hi"}]).content == "ok"
    assert p.chat([{"role": "user", "content": "again"}]).content == "ok"
    assert seen == [True, False, False]  # retried once, then remembered


def test_think_filter_split_tags():
    f = providers.ThinkFilter()
    out = "".join(f.feed(c) for c in ["<th", "ink>a", "b</thi", "nk>", "\n\n정답", " <b>굵게</b>"]) + f.flush()
    assert out == "정답 <b>굵게</b>"


# ---------------- conversation memory ("대화 기록") ----------------

def test_conversation_summary_memory_used_in_later_chats(client):
    cid = client.post("/api/chat", json={"message": "제주도 여행 일정 짜줘"}).json()["conversation_id"]
    assert not [m for m in client.get("/api/memories").json() if m["kind"] == "conversation"]  # 1 question: none yet
    client.post("/api/chat", json={"message": "제주도에서 렌터카 빌리는 법도", "conversation_id": cid})
    convs = [m for m in client.get("/api/memories").json() if m["kind"] == "conversation"]
    assert len(convs) == 1 and convs[0]["source"] == f"conversation:{cid}" and "제주도" in convs[0]["content"]
    # in the same conversation its own summary is not injected (already in history)
    same = client.post("/api/chat", json={"message": "제주도 맛집은?", "conversation_id": cid}).json()
    assert all(m["kind"] != "conversation" for m in same["context"]["memories"])
    # a new conversation can use the earlier one
    new = client.post("/api/chat", json={"message": "지난번 제주도 여행 얘기 기억나?"}).json()
    assert any(m["kind"] == "conversation" for m in new["context"]["memories"])


def test_delete_conversation_removes_its_memories(client):
    cid = client.post("/api/chat", json={"message": "내 이름은 최민준이야"}).json()["conversation_id"]
    client.post("/api/chat", json={"message": "나는 축구를 좋아해", "conversation_id": cid})
    kinds = {m["kind"] for m in client.get("/api/memories").json()}
    assert {"conversation", "user_info"} <= kinds
    assert client.get(f"/api/conversations/{cid}").json()["extracted_memories"] >= 2
    r = client.delete(f"/api/conversations/{cid}").json()  # default: keep extracted facts, drop summary
    assert r["memories_deleted"] == 1
    left = client.get("/api/memories").json()
    assert all(m["kind"] != "conversation" for m in left) and any("최민준" in m["content"] for m in left)

    cid2 = client.post("/api/chat", json={"message": "내 이름은 한서윤이야"}).json()["conversation_id"]
    r2 = client.delete(f"/api/conversations/{cid2}", params={"delete_memories": True}).json()
    assert r2["memories_deleted"] >= 1
    assert not any("한서윤" in m["content"] for m in client.get("/api/memories").json())


def test_conversation_summary_respects_auto_memory_off(client):
    client.put("/api/settings", json={"values": {"auto_memory": False}})
    cid = client.post("/api/chat", json={"message": "질문 하나"}).json()["conversation_id"]
    client.post("/api/chat", json={"message": "질문 둘", "conversation_id": cid})
    assert client.get("/api/memories").json() == []


def test_ai_memory_extraction_only_for_personal_messages(client, monkeypatch):
    calls = []
    real = M.extract_llm
    monkeypatch.setattr(M, "extract_llm", lambda router, text: (calls.append(text), real(router, text))[1])
    client.put("/api/settings", json={"values": {"auto_evaluate": False}})
    client.post("/api/chat", json={"message": "FastAPI의 장점은 무엇인가요?"})
    assert calls == []
    client.post("/api/chat", json={"message": "나는 커피를 좋아해"})
    assert calls == ["나는 커피를 좋아해"]


# ---------------- learning memory ----------------

def test_learning_creates_learned_memory_and_cleanup(client):
    rec = client.post("/api/learning/text", json={"text": "TypeScript는 JavaScript에 정적 타입을 더한 언어이다. 컴파일하면 JavaScript가 된다.", "title": "TypeScript 기초"}).json()
    mems = [m for m in client.get("/api/memories").json() if m["source"] == f"learning:{rec['id']}"]
    assert len(mems) == 1 and mems[0]["kind"] == "knowledge" and "TypeScript 기초" in mems[0]["content"]
    client.delete(f"/api/learning/records/{rec['id']}", params={"delete_knowledge": True})
    assert not [m for m in client.get("/api/memories").json() if m["source"] == f"learning:{rec['id']}"]


# ---------------- model download ----------------

def _wait_job(client, model, timeout=5):
    t0 = time.time()
    while time.time() - t0 < timeout:
        jobs = {j["model"]: j for j in client.get("/api/ai/models").json()["jobs"]}
        if jobs.get(model, {}).get("status") in ("completed", "failed"):
            return jobs[model]
        time.sleep(0.05)
    raise AssertionError("pull did not finish")


def test_model_pull_requires_confirmation_and_works(client):
    info = client.get("/api/ai/models").json()
    assert info["ollama_ok"] is True and "fake-model:latest" in info["installed"] and info["suggested"]
    assert client.post("/api/ai/models/pull", json={"model": "fake-tiny"}).status_code == 428
    assert client.post("/api/ai/models/pull", json={"model": "../../etc", "confirm": True}).status_code == 422
    client.post("/api/ai/models/pull", json={"model": "fake-tiny", "confirm": True})
    job = _wait_job(client, "fake-tiny")
    assert job["status"] == "completed" and job["total"] == 100
    assert "fake-tiny:latest" in client.get("/api/ai/models").json()["installed"]


def test_model_pull_failure_is_reported(client):
    client.post("/api/ai/models/pull", json={"model": "llama3.2:3b", "confirm": True})
    job = _wait_job(client, "llama3.2:3b")
    assert job["status"] == "failed" and "file does not exist" in job["error"]


def test_model_list_when_ollama_down(client, ollama_down):
    assert client.get("/api/ai/models").json()["ollama_ok"] is False


# ---------------- system status ----------------

def test_system_status(client):
    s = client.get("/api/system").json()
    for k in ("uptime_seconds", "database", "database_size", "search", "ai", "counts", "data_dir", "backups", "version"):
        assert k in s
    assert s["ai"]["ready"] is True and isinstance(s["backups"], int)


# ---------------- documents ----------------

def _docx(paragraphs: list[str]) -> bytes:
    w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    body = "".join(f"<w:p><w:r><w:t>{p}</w:t></w:r></w:p>" for p in paragraphs)
    xml = f'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="{w}"><w:body>{body}</w:body></w:document>'
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("word/document.xml", xml)
    return buf.getvalue()


def test_docx_upload(client):
    data = _docx(["회의록: 다음 분기 목표는 사용자 1만 명 달성이다.", "담당자는 마케팅 팀이며 매주 진행 상황을 공유한다."])
    r = client.post("/api/learning/file", files={"file": ("회의록.docx", io.BytesIO(data), "application/octet-stream")})
    assert r.status_code == 200, r.text
    assert client.get(f"/api/learning/records/{r.json()['id']}").json()["status"] == "completed"
    hits = client.get("/api/knowledge", params={"q": "분기 목표"}).json()
    assert hits and "1만 명" in hits[0]["content"]


def test_docx_rejects_broken_and_oversized(client, monkeypatch):
    bad = client.post("/api/learning/file", files={"file": ("x.docx", io.BytesIO(b"PK\x03\x04garbage"), "application/octet-stream")})
    assert bad.status_code == 422
    from app.services import files
    monkeypatch.setattr(files, "MAX_DOCX_XML", 50)
    big = client.post("/api/learning/file", files={"file": ("big.docx", io.BytesIO(_docx(["가" * 200])), "application/octet-stream")})
    assert big.status_code == 422 and "너무 큽니다" in big.json()["detail"]


# ---------------- evaluation parsing ----------------

@pytest.mark.parametrize("value,expected", [(4, 4.0), ("4", 4.0), ("4/5", 4.0), ("8/10", 4.0), ("4점", 4.0),
                                            ({"score": 3}, 3.0), ("없음", None), (True, None), (9, 4.5), (85, 4.25)])
def test_lenient_scores(value, expected):
    assert E._score(value) == expected


def test_evaluation_with_korean_keys(client, monkeypatch):
    def handler(req: httpx.Request):
        if req.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "fake-model:latest"}]})
        body = json.loads(req.content)
        if body.get("format") == "json":
            content = json.dumps({"scores": {"정확성": "4/5", "논리성": 5, "근거": "3점", "관련성": {"score": 5}},
                                  "missing_info": "없음", "uncertainty": "없음", "comments": "ok"}, ensure_ascii=False)
        else:
            content = "답변"
        return httpx.Response(200, json={"model": "fake-model", "message": {"content": content}, "done": True})
    monkeypatch.setattr(ai_router, "local_factory",
                        lambda **kw: providers.OllamaProvider(transport=httpx.MockTransport(handler), **kw))
    mid = client.post("/api/chat", json={"message": "평가 형식 테스트"}).json()["assistant_message_id"]
    ev = client.get(f"/api/messages/{mid}/evaluation").json()
    assert ev["status"] == "completed"
    assert (ev["accuracy"], ev["logic"], ev["evidence"], ev["relevance"]) == (4.0, 5.0, 3.0, 5.0)


# ---------------- research: provider returns text directly ----------------

def test_wikipedia_provider_uses_extracts(client):
    calls = []

    def handler(req: httpx.Request):
        calls.append(str(req.url))
        q = dict(req.url.params)
        if q.get("list") == "search":
            return httpx.Response(200, json={"query": {"search": [{"title": "Mars", "snippet": "Mars is a <b>planet</b>"}]}})
        if q.get("prop") == "extracts":
            return httpx.Response(200, json={"query": {"pages": {"1": {"title": "Mars", "extract": "Mars is the fourth planet from the Sun. " * 40}}}})
        return httpx.Response(404)
    search.transport = httpx.MockTransport(handler)
    client.put("/api/settings", json={"values": {"search_provider": "wikipedia", "external_network_enabled": True},
                                      "confirm_sensitive": True})
    t = client.post("/api/research", json={"topic": "Mars planet"}).json()
    t = client.get(f"/api/research/{t['id']}").json()
    assert t["status"] == "completed"
    web = [s for s in t["sources"] if s["kind"] == "web"]
    assert web and all(s["has_content"] for s in web)
    assert not any("/wiki/Mars" in c for c in calls)  # no HTML page download needed
    assert not any("본문을 가져오지 못함" in n for s in web for n in s["reliability_notes"])


# ---------------- cloud streaming (OpenAI-compatible SSE) ----------------

def test_cloud_streaming(client, ollama_down, monkeypatch):
    def handler(req: httpx.Request):
        body = json.loads(req.content)
        if not body.get("stream"):  # background evaluation / memory calls are not streamed
            return httpx.Response(200, json={"model": "cloud-x", "choices": [{"message": {"content": "{}"}}]})
        chunks = [{"model": "cloud-x", "choices": [{"delta": {"content": t}}]} for t in ("클라", "우드 ", "답변")]
        sse = "".join(f"data: {json.dumps(c, ensure_ascii=False)}\n\n" for c in chunks) + "data: [DONE]\n\n"
        return httpx.Response(200, content=sse.encode(), headers={"content-type": "text/event-stream"})
    monkeypatch.setenv("CLOUD_ENABLED", "true")
    monkeypatch.setenv("CLOUD_API_KEY", "sk-test-abcdef")
    monkeypatch.setenv("CLOUD_MODEL", "cloud-x")
    get_settings.cache_clear()
    monkeypatch.setattr(ai_router, "cloud_factory",
                        lambda: providers.OpenAICompatibleProvider(transport=httpx.MockTransport(handler)))
    client.put("/api/settings", json={"values": {"cloud_allowed": True}, "confirm_sensitive": True})
    ev = _events(client.post("/api/chat/stream", json={"message": "클라우드 스트림"}))
    assert [e["text"] for e in ev if e["type"] == "delta"] == ["클라", "우드 ", "답변"]
    assert ev[-1]["provider"] == "cloud" and ev[-1]["answer"] == "클라우드 답변"
    get_settings.cache_clear()


# ---------------- first run on a fresh install ----------------

def test_sqlite_folder_created_on_first_run(tmp_path, monkeypatch):
    target = tmp_path / "fresh" / "nested" / "self_ai.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{target}")
    get_settings.cache_clear()
    try:
        from sqlalchemy import create_engine, text
        url = get_settings().database_url
        assert target.parent.is_dir()
        with create_engine(url).connect() as c:
            assert c.execute(text("select 1")).scalar() == 1
    finally:
        get_settings.cache_clear()


def test_env_example_starts_cleanly(tmp_path, monkeypatch):
    """The .env the launcher copies on first run must give a working configuration."""
    from pathlib import Path

    from app.config import Settings
    example = Path(__file__).resolve().parent.parent / ".env.example"
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    s = Settings(_env_file=str(example))
    assert s.AI_MODE == "AUTO" and s.CLOUD_ENABLED is False and s.ACCESS_TOKEN == ""
    assert s.database_url == f"sqlite:///{tmp_path / 'data' / 'self_ai.db'}"


def test_rule_and_ai_memories_not_duplicated(client):
    client.post("/api/chat", json={"message": "내 이름은 박지영이야. 나는 등산을 좋아해."})
    mems = client.get("/api/memories").json()
    prefs = [m["content"] for m in mems if m["kind"] == "preference"]
    assert prefs == ["사용자는 등산을(를) 좋아한다"]          # the AI's phrasing only, not also "나는 등산을 좋아해."
    assert any("박지영" in m["content"] for m in mems)        # rule fact the AI did not cover is kept


def test_merge_candidates_rules():
    rules = [{"kind": "preference", "content": "나는 커피를 좋아해.", "importance": 3, "explicit": False},
             {"kind": "preference", "content": "나는 녹차를 좋아해.", "importance": 3, "explicit": False},
             {"kind": "knowledge", "content": "회의는 월요일", "importance": 4, "explicit": True}]
    ai = [{"kind": "preference", "content": "사용자는 커피를 좋아한다", "importance": 3}]
    got = [c["content"] for c in M.merge_candidates(rules, ai)]
    assert got == ["나는 녹차를 좋아해.", "회의는 월요일", "사용자는 커피를 좋아한다"]
    assert M.merge_candidates(rules, None) == rules and M.merge_candidates(rules, []) == rules


def test_malformed_ollama_output_handled(client, monkeypatch):
    def handler(req: httpx.Request):
        if req.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "fake-model:latest"}]})
        body = json.loads(req.content)
        if body.get("stream"):
            lines = ['{"message": {"content": "정상 "}, "done": false}', "this is not json",
                     '{"message": {"content": "답변"}, "done": true}']
            return httpx.Response(200, content=("\n".join(lines) + "\n").encode())
        return httpx.Response(200, content=b"<html>not ollama</html>")
    monkeypatch.setattr(ai_router, "local_factory",
                        lambda **kw: providers.OllamaProvider(transport=httpx.MockTransport(handler), **kw))
    ev = _events(client.post("/api/chat/stream", json={"message": "깨진 줄 섞인 스트림"}))
    assert ev[-1]["type"] == "done" and ev[-1]["answer"] == "정상 답변"
    r = client.post("/api/chat", json={"message": "JSON이 아닌 응답"})
    assert r.status_code == 503 and "해석할 수 없습니다" in r.json()["detail"]["message"]


# ---------------- starter knowledge packs ----------------

def _wait_records(client, n, timeout=20):
    t0 = time.time()
    while time.time() - t0 < timeout:
        recs = client.get("/api/learning/records").json()
        if len(recs) >= n and all(r["status"] in ("completed", "failed") for r in recs):
            return recs
        time.sleep(0.1)
    raise AssertionError("starter pack import did not finish")


def test_starter_packs_listed_and_imported(client):
    packs = {p["id"]: p for p in client.get("/api/learning/packs").json()}
    assert {"selfai-guide", "ai-basics", "dev-basics"} <= set(packs)
    guide = packs["selfai-guide"]
    assert guide["sections"] >= 6 and guide["imported"] == 0
    r = client.post("/api/learning/packs/selfai-guide/import").json()
    assert r == {"queued": guide["sections"], "already_imported": 0}
    recs = _wait_records(client, guide["sections"])
    assert all(x["status"] == "completed" and x["source_type"] == "starter" for x in recs)
    assert all(x["source_name"].startswith("기본 자료: SELF AI 사용 가이드 / ") for x in recs)
    after = {p["id"]: p for p in client.get("/api/learning/packs").json()}
    assert after["selfai-guide"]["imported"] == guide["sections"] and after["ai-basics"]["imported"] == 0
    # the AI can now find it: unverified knowledge, labelled as a built-in source
    hits = client.get("/api/knowledge", params={"q": "SELF AI 데이터는 어디에 저장되나 backend/data"}).json()
    assert hits and hits[0]["verification"] == "unverified" and hits[0]["source_type"] == "starter"
    assert hits[0]["confidence"] <= 0.6
    d = client.post("/api/chat", json={"message": "SELF AI는 내 데이터를 어디에 저장해?"}).json()
    assert d["context"]["knowledge"] and d["context"]["knowledge"][0]["source"].startswith("기본 자료")


def test_starter_pack_import_is_idempotent(client):
    first = client.post("/api/learning/packs/dev-basics/import").json()
    _wait_records(client, first["queued"])
    again = client.post("/api/learning/packs/dev-basics/import").json()
    assert again["queued"] == 0 and again["already_imported"] == first["queued"]
    assert len(client.get("/api/learning/records").json()) == first["queued"]


def test_starter_pack_unknown_id_and_traversal(client):
    assert client.post("/api/learning/packs/nope/import").status_code == 404
    assert client.post("/api/learning/packs/..%2F..%2Fetc/import").status_code == 404
