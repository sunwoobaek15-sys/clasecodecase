"""Research agent, autonomy policy, evaluation stats, backup/restore, data deletion, dashboard."""
import httpx

from app.services import search


def _web_transport():
    pages = {
        "https://www.nasa.gov/mars": "<html><body><p>Mars is the fourth planet from the Sun. Mars has two moons, Phobos and Deimos.</p><script>evil()</script></body></html>",
        "https://en.wikipedia.org/wiki/Mars": "<html><body><p>Mars is the fourth planet. It has two small moons named Phobos and Deimos.</p></body></html>",
        "https://blog.example.com/mars": "<html><body><p>Some say Mars has three moons.</p></body></html>",
    }

    def handler(req: httpx.Request):
        if req.url.host == "en.wikipedia.org" and req.url.path == "/w/api.php":
            return httpx.Response(200, json={"query": {"search": [{"title": "Mars", "snippet": "Mars is the <b>fourth</b> planet"}]}})
        if req.url.host == "searx.local":
            return httpx.Response(200, json={"results": [
                {"title": "NASA Mars", "url": "https://www.nasa.gov/mars", "content": "Mars facts"},
                {"title": "Mars - Wikipedia", "url": "https://en.wikipedia.org/wiki/Mars", "content": "Mars planet"},
                {"title": "Mars blog", "url": "https://blog.example.com/mars", "content": "opinion"}]})
        url = str(req.url)
        if url in pages:
            return httpx.Response(200, text=pages[url], headers={"content-type": "text/html; charset=utf-8"})
        return httpx.Response(404)
    return httpx.MockTransport(handler)


def test_research_needs_connection_when_no_provider(client):
    p = client.get("/api/research/provider").json()
    assert p["provider"] == "none" and p["connected"] is False
    t = client.post("/api/research", json={"topic": "화성의 위성"}).json()
    t = client.get(f"/api/research/{t['id']}").json()
    assert t["status"] == "needs_connection" and t["sources"] == []
    assert client.post(f"/api/research/{t['id']}/save").status_code == 409


def test_research_provider_requires_network_switch(client):
    client.put("/api/settings", json={"values": {"search_provider": "wikipedia"}})
    p = client.get("/api/research/provider").json()
    assert p["connected"] is False and "외부 네트워크" in p["detail"]


def test_research_full_pipeline_with_searxng(client, monkeypatch):
    monkeypatch.setenv("SEARXNG_URL", "http://searx.local")
    from app.config import get_settings
    get_settings.cache_clear()
    search.transport = _web_transport()
    search.CHECK_HOSTS = False
    client.put("/api/settings", json={"values": {"search_provider": "searxng", "external_network_enabled": True},
                                      "confirm_sensitive": True})
    t = client.post("/api/research", json={"topic": "Mars moons"}).json()
    t = client.get(f"/api/research/{t['id']}").json()
    assert t["status"] == "completed", t
    assert t["plan_method"] == "llm" and t["plan"][0]["queries"]
    web = [s for s in t["sources"] if s["kind"] == "web"]
    assert len(web) == 3 and all(s["has_content"] for s in web)
    nasa = next(s for s in web if "nasa" in s["url"])
    blog = next(s for s in web if "blog" in s["url"])
    assert nasa["reliability"] > blog["reliability"]  # .gov + agreement beats lone blog
    assert any("공공" in n for n in nasa["reliability_notes"])
    assert "[S1]" in t["report"] and "## 출처" in t["report"]
    assert t["comparison"][0]["type"] == "agreements"
    saved = client.post(f"/api/research/{t['id']}/save").json()
    assert saved["knowledge_id"] and saved["verification"] in ("multi_source", "unverified")
    assert client.post(f"/api/research/{t['id']}/save").status_code == 409  # no double save
    k = client.get(f"/api/knowledge/{saved['knowledge_id']}").json()
    assert k["category"] == "research" and "nasa.gov" in k["source"]
    get_settings.cache_clear()


def test_research_local_only_extractive_without_ai(client, ollama_down):
    client.post("/api/learning/text", json={"text": "화성은 태양계의 네 번째 행성이다. 화성에는 포보스와 데이모스라는 두 위성이 있다.", "title": "화성"})
    t = client.post("/api/research", json={"topic": "화성 위성", "use_web": False}).json()
    t = client.get(f"/api/research/{t['id']}").json()
    assert t["status"] == "completed" and t["search_provider"] == "local-only"
    assert t["plan_method"] == "template" and t["report_method"] == "extractive"
    assert "AI 모델이 연결되지 않아" in t["report"]
    assert all(s["kind"] == "knowledge" for s in t["sources"])


def test_fetch_page_blocks_private_addresses():
    import pytest
    for url in ("http://127.0.0.1:8000/api/settings", "http://localhost/", "file:///etc/passwd", "http://169.254.169.254/"):
        with pytest.raises(ValueError):
            search.fetch_page(url, check_host=True)


def test_autonomy_policy_and_scan(client):
    pol = client.get("/api/autonomy/policy").json()
    assert pol["actions"]["merge_duplicate_memories"]["approval"] is True
    assert "유료 서비스 사용" in pol["never_automatic"]
    client.post("/api/chat", json={"message": "양자 컴퓨터의 원리는 무엇인가요"})
    from app.db import SessionLocal
    from app.models import Memory
    from app.services import text as T
    db = SessionLocal()
    for c in ("사용자는 녹차를 좋아한다", "사용자는 녹차를 아주 좋아한다"):
        db.add(Memory(kind="preference", content=c, content_hash=T.content_hash(c)))
    db.commit()
    db.close()
    res = client.post("/api/autonomy/scan").json()
    assert res["created"] and res["auto_run"] == []
    tasks = {t["action"]: t for t in client.get("/api/autonomy/tasks").json()}
    assert "plan_research" in tasks and "merge_duplicate_memories" in tasks
    # scanning again does not duplicate proposals
    assert client.post("/api/autonomy/scan").json()["created"] == []

    merge = tasks["merge_duplicate_memories"]
    assert client.post(f"/api/autonomy/tasks/{merge['id']}/run").status_code == 403  # approval required
    assert len(client.get("/api/memories").json()) >= 2
    done = client.post(f"/api/autonomy/tasks/{merge['id']}/approve").json()
    assert done["status"] == "completed" and done["result"]["removed"] == 1

    plan = client.post(f"/api/autonomy/tasks/{tasks['plan_research']['id']}/run").json()
    assert plan["status"] == "completed"
    rt = client.get(f"/api/research/{plan['result']['research_task_id']}").json()
    assert rt["origin"] == "autonomy" and rt["status"] == "pending" and rt["plan"]  # planned, not executed


def test_autonomy_auto_run_safe_only(client):
    client.put("/api/settings", json={"values": {"autonomy_auto_run_safe": True, "auto_evaluate": False}})
    client.post("/api/chat", json={"message": "인공지능 윤리 문제를 정리해줘"})
    res = client.post("/api/autonomy/scan").json()
    tasks = {t["id"]: t for t in client.get("/api/autonomy/tasks").json()}
    assert res["auto_run"]
    for tid in res["auto_run"]:
        assert tasks[tid]["requires_approval"] is False and tasks[tid]["status"] == "completed"


def test_autonomy_disabled(client):
    client.put("/api/settings", json={"values": {"autonomy_enabled": False}})
    assert client.post("/api/autonomy/scan").json()["disabled"] is True


def test_reject_proposal(client):
    client.post("/api/chat", json={"message": "블록체인 합의 알고리즘 비교"})
    client.post("/api/autonomy/scan")
    t = client.get("/api/autonomy/tasks").json()[0]
    assert client.post(f"/api/autonomy/tasks/{t['id']}/reject").json()["status"] == "rejected"
    assert client.post(f"/api/autonomy/tasks/{t['id']}/run").status_code == 409


def test_evaluation_list_and_stats(client):
    for q in ("질문 하나", "질문 둘"):
        client.post("/api/chat", json={"message": q})
    evs = client.get("/api/evaluations").json()
    assert len(evs) == 2 and all(e["status"] == "completed" for e in evs)
    st = client.get("/api/evaluations/stats").json()
    assert st["count"] == 2 and st["averages"]["overall"] is not None and st["trend"]


def test_evaluation_failure_recorded_when_ai_down(client, monkeypatch):
    mid = client.post("/api/chat", json={"message": "평가 실패 테스트"}).json()["assistant_message_id"]
    from app.ai import router as ai_router
    from tests.conftest import _Offline
    monkeypatch.setattr(ai_router, "local_factory", lambda **kw: _Offline(**kw))
    e = client.post(f"/api/messages/{mid}/evaluate").json()
    assert e["status"] == "failed" and e["overall"] is None and e["error"]


def test_backup_restore_and_delete(client):
    client.post("/api/memories", json={"kind": "decision", "content": "백업 테스트 결정"})
    b = client.post("/api/backups").json()
    assert b["name"].startswith("self_ai-") and b["size"] > 0
    assert any(x["name"] == b["name"] for x in client.get("/api/backups").json())
    assert client.get(f"/api/backups/{b['name']}/download").status_code == 200
    assert client.get("/api/backups/..%2F..%2Fself_ai.db/download").status_code in (400, 404)
    assert client.post(f"/api/backups/{b['name']}/restore", json={}).status_code == 428

    r = client.post("/api/data/delete", json={"scope": "memories"})
    assert r.status_code == 428
    r = client.post("/api/data/delete", json={"scope": "memories", "confirm": "DELETE"}).json()
    assert r["deleted"]["memories"] == 1 and r["safety_backup"]
    assert client.get("/api/memories").json() == []

    res = client.post(f"/api/backups/{b['name']}/restore", json={"confirm": "RESTORE"}).json()
    assert res["safety_backup"]
    assert [m["content"] for m in client.get("/api/memories").json()] == ["백업 테스트 결정"]


def test_backup_upload_validation(client):
    import io
    bad = client.post("/api/backups/upload", files={"file": ("x.db", io.BytesIO(b"not sqlite"), "application/octet-stream")})
    assert bad.status_code == 422
    name = client.post("/api/backups").json()["name"]
    data = client.get(f"/api/backups/{name}/download").content
    ok = client.post("/api/backups/upload", files={"file": ("mine.db", io.BytesIO(data), "application/octet-stream")})
    assert ok.status_code == 200 and ok.json()["name"].endswith("-uploaded.db")


def test_export_json(client):
    client.post("/api/memories", json={"kind": "project", "content": "내보내기 테스트"})
    data = client.get("/api/export").json()
    assert data["format"] == "self-ai-export-v1"
    assert data["tables"]["memories"][0]["content"] == "내보내기 테스트"


def test_dashboard_counts_are_real(client):
    d = client.get("/api/dashboard").json()
    assert d["counts"]["memories"] == 0 and d["counts"]["knowledge"] == 0
    client.post("/api/memories", json={"kind": "project", "content": "대시보드 테스트"})
    client.post("/api/learning/text", json={"text": "대시보드 통계는 실제 데이터베이스 개수를 보여준다. 가짜 숫자는 없다."})
    d = client.get("/api/dashboard").json()
    assert d["counts"]["memories"] == 1 and d["counts"]["knowledge"] == 1 and d["counts"]["learning_records"] == 1
    assert d["recent_learning"] and d["recent_activity"]
    assert d["ai"]["ready"] is True


def test_unknown_error_hides_details(client, monkeypatch):
    from app.routers import system
    monkeypatch.setattr(system.backup, "list_all", lambda: (_ for _ in ()).throw(RuntimeError("secret path /root/x")))
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app, raise_server_exceptions=False) as c:
        r = c.get("/api/backups")
    assert r.status_code == 500 and "secret" not in r.text


def test_periodic_autonomy_loop_runs_scan(client, monkeypatch):
    import threading
    from app import main
    from app.services import autonomy
    calls = []
    stop = threading.Event()
    monkeypatch.setattr(autonomy, "scan", lambda db: (calls.append(1), stop.set()))
    main._autonomy_loop(stop, minutes=0.0001)
    assert calls == [1]
