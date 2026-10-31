"""AI router, chat, conversations, memory, security basics."""
import httpx

from app.config import get_settings
from app.services import memory as M
from app.services import text as T


def test_health(client):
    assert client.get("/api/health").json()["ok"] is True


def test_ai_status_local_ready(client):
    s = client.get("/api/ai/status").json()
    assert s["mode"] == "AUTO" and s["ready"] is True
    assert s["active"]["provider"] == "ollama"
    assert s["cloud"]["available"] is False  # CLOUD_ENABLED=false by default


def test_ai_unavailable_is_reported_clearly(client, ollama_down):
    s = client.get("/api/ai/status").json()
    assert s["ready"] is False and "Ollama" in s["error"]
    r = client.post("/api/chat", json={"message": "안녕"})
    assert r.status_code == 503
    assert "Ollama" in r.json()["detail"]["message"]
    assert client.get("/api/conversations").json() == []  # nothing stored on failure


def test_local_mode_does_not_fall_back_to_cloud(client, ollama_down):
    client.put("/api/settings", json={"values": {"ai_mode": "LOCAL"}})
    s = client.get("/api/ai/status").json()
    assert s["ready"] is False and "LOCAL" in s["error"]


def test_cloud_mode_refuses_when_disabled(client):
    client.put("/api/settings", json={"values": {"ai_mode": "CLOUD"}})
    r = client.post("/api/chat", json={"message": "hi"})
    assert r.status_code == 503 and "CLOUD" in r.json()["detail"]["message"]


def test_missing_model_message(client):
    client.put("/api/settings", json={"values": {"local_model": "llama3:70b"}})
    s = client.get("/api/ai/status").json()
    assert s["ready"] is False and "ollama pull llama3:70b" in s["error"]


def test_chat_saves_conversation_and_evaluates(client):
    r = client.post("/api/chat", json={"message": "파이썬의 장점은?"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["answer"].startswith("[TEST DOUBLE]") and d["provider"] == "ollama"
    assert d["context"]["grounding"]["no_context"] is True
    cid = d["conversation_id"]
    r2 = client.post("/api/chat", json={"message": "더 자세히", "conversation_id": cid}).json()
    assert r2["conversation_id"] == cid
    conv = client.get(f"/api/conversations/{cid}").json()
    assert [m["role"] for m in conv["messages"]] == ["user", "assistant", "user", "assistant"]
    ev = conv["messages"][1]["evaluation"]  # background task ran after the response
    assert ev["status"] == "completed" and ev["overall"] is not None and ev["evaluator"].startswith("ollama")


def test_chat_uses_memory_and_knowledge(client):
    client.post("/api/memories", json={"kind": "user_info", "content": "사용자의 이름은 김민수이다", "importance": 5})
    client.post("/api/learning/text", json={"text": "FastAPI는 파이썬 웹 프레임워크이다. 타입 힌트를 이용해 자동 문서를 만든다.", "title": "FastAPI 소개"})
    d = client.post("/api/chat", json={"message": "내 이름이 뭐야? FastAPI는 뭐야?"}).json()
    ctx = d["context"]
    assert any("김민수" in m["content"] for m in ctx["memories"])
    assert any("FastAPI" in k["title"] for k in ctx["knowledge"])
    assert ctx["grounding"]["uses_context"] is True


def test_chat_input_validation(client):
    assert client.post("/api/chat", json={"message": "   "}).status_code == 422
    assert client.post("/api/chat", json={"message": "x" * 20001}).status_code == 422
    assert client.post("/api/chat", json={"message": "hi", "conversation_id": 9999}).status_code == 404


def test_conversation_rename_search_delete(client):
    cid = client.post("/api/chat", json={"message": "고양이 이야기"}).json()["conversation_id"]
    assert client.patch(f"/api/conversations/{cid}", json={"title": "고양이"}).json()["title"] == "고양이"
    assert len(client.get("/api/conversations", params={"q": "고양이"}).json()) == 1
    assert client.delete(f"/api/conversations/{cid}").status_code == 200
    assert client.get(f"/api/conversations/{cid}").status_code == 404


def test_unsaved_chat_mode(client):
    client.put("/api/settings", json={"values": {"save_chat_history": False}})
    d = client.post("/api/chat", json={"message": "기록하지 마"}).json()
    assert d["conversation_id"] is None and d["saved"] is False
    assert client.get("/api/conversations").json() == []


def test_memory_crud_and_filters(client):
    m = client.post("/api/memories", json={"kind": "preference", "content": "사용자는 다크 모드를 선호한다"}).json()
    assert m["created"] is True
    again = client.post("/api/memories", json={"kind": "preference", "content": "사용자는 다크 모드를 선호한다."}).json()
    assert again["created"] is False and again["id"] == m["id"] and again["times_seen"] == 2
    client.post("/api/memories", json={"kind": "project", "content": "SELF AI 프로젝트를 개발 중"})
    assert len(client.get("/api/memories", params={"kind": "project"}).json()) == 1
    hits = client.get("/api/memories", params={"q": "다크"}).json()
    assert hits[0]["id"] == m["id"]
    up = client.patch(f"/api/memories/{m['id']}", json={"content": "사용자는 라이트 모드를 선호한다", "importance": 5}).json()
    assert up["content"].startswith("사용자는 라이트") and up["updated_at"] >= m["updated_at"]
    assert client.patch(f"/api/memories/{m['id']}", json={"kind": "nope"}).status_code == 422
    assert client.delete(f"/api/memories/{m['id']}").status_code == 200
    assert all(x["id"] != m["id"] for x in client.get("/api/memories").json())


def test_memory_dedupe_endpoint(client):
    from app.db import SessionLocal
    from app.models import Memory
    db = SessionLocal()
    for c in ("사용자는 커피를 좋아한다", "사용자는 커피를 정말 좋아한다", "사용자는 등산을 좋아한다"):
        db.add(Memory(kind="preference", content=c, content_hash=T.content_hash(c)))
    db.commit()
    db.close()
    groups = client.get("/api/memories/duplicates").json()
    assert len(groups) == 1 and len(groups[0]) == 2
    assert client.post("/api/memories/dedupe").json() == {"groups": 1, "removed": 1}
    assert len(client.get("/api/memories").json()) == 2


def test_memory_extracted_from_chat(client):
    d = client.post("/api/chat", json={"message": "내 이름은 박지영이야. 나는 등산을 좋아해."}).json()
    mems = client.get("/api/memories").json()
    contents = " | ".join(m["content"] for m in mems)
    assert "박지영" in contents and "등산" in contents
    assert all(m["source"].startswith(f"chat:{d['conversation_id']}/") for m in mems)


def test_auto_memory_off(client):
    client.put("/api/settings", json={"values": {"auto_memory": False}})
    client.post("/api/chat", json={"message": "내 이름은 박지영이야."})
    assert client.get("/api/memories").json() == []


def test_rule_extraction_ignores_questions():
    assert M.extract_rules("내 이름이 뭐야?") == []
    got = M.extract_rules("기억해줘: 회의는 매주 월요일 10시")
    assert got and "월요일" in got[0]["content"]


def test_feedback_and_correction_becomes_knowledge(client):
    d = client.post("/api/chat", json={"message": "서울의 인구는?"}).json()
    mid = d["assistant_message_id"]
    assert client.post(f"/api/messages/{mid}/feedback", json={}).status_code == 422
    f = client.post(f"/api/messages/{mid}/feedback", json={"rating": 2, "corrected_answer": "서울 인구는 약 940만 명이다.",
                                                         "save_correction_as_knowledge": True}).json()
    assert 0 <= f["similarity"] < 1 and f["knowledge_id"]
    k = client.get(f"/api/knowledge/{f['knowledge_id']}").json()
    assert k["verification"] == "user_verified" and k["confidence"] == 0.9
    d2 = client.post("/api/chat", json={"message": "서울 인구 알려줘"}).json()
    assert any(x["id"] == f["knowledge_id"] for x in d2["context"]["knowledge"])
    st = client.get("/api/evaluations/stats").json()
    assert st["corrections"] == 1 and st["rated_pairs"] == 1


def test_settings_validation_and_sensitive_confirmation(client):
    assert client.put("/api/settings", json={"values": {"ai_mode": "TURBO"}}).status_code == 422
    assert client.put("/api/settings", json={"values": {"unknown": 1}}).status_code == 422
    r = client.put("/api/settings", json={"values": {"external_network_enabled": True}})
    assert r.status_code == 428
    r = client.put("/api/settings", json={"values": {"external_network_enabled": True}, "confirm_sensitive": True})
    assert r.status_code == 200 and r.json()["values"]["external_network_enabled"] is True


def test_settings_never_expose_secrets(client, monkeypatch):
    monkeypatch.setenv("CLOUD_API_KEY", "sk-supersecret-123456")
    get_settings.cache_clear()
    body = client.get("/api/settings").text
    assert "sk-supersecret" not in body and '"CLOUD_API_KEY_SET":true' in body.replace(" ", "")
    get_settings.cache_clear()


def test_access_token(client, monkeypatch):
    monkeypatch.setenv("ACCESS_TOKEN", "letmein-token")
    get_settings.cache_clear()
    assert client.get("/api/dashboard").status_code == 401
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/dashboard", headers={"x-access-token": "letmein-token"}).status_code == 200
    get_settings.cache_clear()


def test_cloud_provider_used_only_when_fully_enabled(client, ollama_down, monkeypatch):
    from app.ai import providers
    from app.ai import router as ai_router
    calls = []

    def cloud_handler(req: httpx.Request):
        calls.append(req)
        return httpx.Response(200, json={"model": "cloud-x", "choices": [{"message": {"content": "cloud answer"}}]})

    monkeypatch.setenv("CLOUD_ENABLED", "true")
    monkeypatch.setenv("CLOUD_API_KEY", "sk-test-abcdef")
    monkeypatch.setenv("CLOUD_MODEL", "cloud-x")
    get_settings.cache_clear()
    monkeypatch.setattr(ai_router, "cloud_factory",
                        lambda: providers.OpenAICompatibleProvider(transport=httpx.MockTransport(cloud_handler)))
    client.post("/api/memories", json={"kind": "user_info", "content": "사용자의 비밀 메모 abc"})
    # enabled in .env but not allowed in Settings -> refused, no call made
    assert client.post("/api/chat", json={"message": "비밀 메모"}).status_code == 503
    assert calls == []
    client.put("/api/settings", json={"values": {"cloud_allowed": True}, "confirm_sensitive": True})
    d = client.post("/api/chat", json={"message": "비밀 메모"}).json()
    assert d["provider"] == "cloud" and d["answer"] == "cloud answer"
    assert d["context"]["withheld_for_privacy"] is True and d["context"]["memories"] == []
    assert "abc" not in calls[0].content.decode()  # personal memory not sent
    get_settings.cache_clear()


def test_tokenizer_handles_korean_particles():
    ranked = T.rank("서울", ["서울에서 살고 있다", "부산은 바다가 있다"], lambda s: s)
    assert ranked[0][0].startswith("서울")
