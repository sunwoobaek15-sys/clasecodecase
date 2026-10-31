"""TEST DOUBLE that speaks the Ollama HTTP API. It is NOT an AI.

Used only by the automated tests and the UI smoke test, because a real model
cannot be downloaded in CI. Replies are deterministic and always start with
"[TEST DOUBLE]" so they can never be mistaken for real model output.

Run standalone:  python -m tests.fake_ollama --port 11500
"""
from __future__ import annotations

import json
import os
import re
import time

import httpx

MODEL = "fake-model:latest"
THINK_MODEL = "fake-think:latest"  # always wraps its answer in <think>…</think> like qwen3 on old Ollama
_installed = {MODEL, THINK_MODEL}
DELAY = float(os.environ.get("FAKE_OLLAMA_DELAY", "0"))  # seconds between streamed pieces (UI tests)


def reset() -> None:
    _installed.clear()
    _installed.update({MODEL, THINK_MODEL})


def _reply(body: dict) -> str:
    msgs = body.get("messages", [])
    last = msgs[-1]["content"] if msgs else ""
    system = msgs[0]["content"] if msgs and msgs[0]["role"] == "system" else ""
    if body.get("format") == "json":
        if "엄격한 평가자" in last:
            return json.dumps({"accuracy": 4, "logic": 4, "evidence": 3 if "없음" in last.split("[질문]")[0] else 5,
                               "relevance": 5, "missing_info": "없음", "uncertainty": "없음",
                               "comments": "[TEST DOUBLE] 고정 평가"}, ensure_ascii=False)
        if "기억 관리자" in last:
            msg = last.split("사용자 메시지:", 1)[-1]
            m = re.search(r"(\S+)\s*(?:을|를)\s*(?:좋아해|좋아합니다)", msg)
            return json.dumps({"memories": [{"kind": "preference", "content": f"사용자는 {m.group(1)}을(를) 좋아한다",
                                             "importance": 3}] if m else []}, ensure_ascii=False)
        if "다음 자료를 분석하라" in last:
            text = last.split("자료:", 1)[-1].strip()
            return json.dumps({"title": text.split("\n")[0][:30], "category": "test",
                               "summary": "[TEST DOUBLE] " + text[:80], "key_points": [text[:60]]}, ensure_ascii=False)
        if "기존 지식과 새 자료를 비교" in last:
            return json.dumps({"relation": "adds", "note": "[TEST DOUBLE] 새 정보 추가"}, ensure_ascii=False)
        if "조사하기 위한 계획" in last:
            topic = last.split("조사 주제:", 1)[-1].split("\n")[0].strip()
            return json.dumps({"questions": [f"{topic}란?"], "queries": [topic, f"{topic} 장점"]}, ensure_ascii=False)
        if "출처들의 내용을 비교" in last:
            return json.dumps({"agreements": ["[TEST DOUBLE] 공통 내용 [S1][S2]"], "disagreements": [],
                               "gaps": ["[TEST DOUBLE] 확인 안 됨"]}, ensure_ascii=False)
        return "{}"
    if "신중한 조사원" in last:
        return "## 요약\n[TEST DOUBLE] 출처 기반 요약 [S1]\n## 결론\n[TEST DOUBLE] 결론 [S1]"
    cites = re.findall(r"^(M\d+|K\d+)", system, re.M)
    suffix = " " + " ".join(f"[{c}]" for c in cites[:2]) if cites else " 관련 자료가 없어 확실하지 않음."
    return f"[TEST DOUBLE] '{last[:60]}'에 대한 고정 응답입니다.{suffix}"


def _known(name: str) -> str | None:
    for m in _installed:
        if name in (m, m.split(":")[0]):
            return m
    return None


def _pieces(text: str, size: int = 4):
    return [text[i:i + size] for i in range(0, len(text), size)]


def _chat_lines(model: str, text: str):
    for p in _pieces(text):
        if DELAY:
            time.sleep(DELAY)
        yield json.dumps({"model": model, "message": {"role": "assistant", "content": p}, "done": False},
                         ensure_ascii=False) + "\n"
    yield json.dumps({"model": model, "message": {"role": "assistant", "content": ""}, "done": True,
                      "prompt_eval_count": 10, "eval_count": 20}) + "\n"


def _pull_lines(name: str):
    yield json.dumps({"status": "pulling manifest"}) + "\n"
    if not name.startswith("fake-"):
        yield json.dumps({"error": "pull model manifest: file does not exist"}) + "\n"
        return
    for done in (0, 50, 100):
        yield json.dumps({"status": "pulling abc123", "digest": "sha256:abc123", "total": 100, "completed": done}) + "\n"
    _installed.add(name if ":" in name else f"{name}:latest")
    yield json.dumps({"status": "success"}) + "\n"


def handler(request: httpx.Request) -> httpx.Response:
    if request.url.path == "/api/tags":
        return httpx.Response(200, json={"models": [{"name": m} for m in sorted(_installed)]})
    if request.url.path == "/api/pull":
        body = json.loads(request.content)
        return httpx.Response(200, content=b"".join(x.encode() for x in _pull_lines(body.get("model") or body["name"])))
    if request.url.path == "/api/chat":
        body = json.loads(request.content)
        model = _known(body.get("model", ""))
        if not model:
            return httpx.Response(404, json={"error": f"model '{body.get('model')}' not found"})
        text = _reply(body)
        if model == THINK_MODEL:
            text = "<think>사용자의 질문을 분석하는 중… (이 부분은 숨겨져야 함)</think>\n\n" + text
        if body.get("stream", True):
            return httpx.Response(200, content=b"".join(x.encode() for x in _chat_lines(body["model"], text)),
                                  headers={"content-type": "application/x-ndjson"})
        return httpx.Response(200, json={"model": body["model"], "message": {"role": "assistant", "content": text},
                                         "done": True, "prompt_eval_count": 10, "eval_count": 20})
    return httpx.Response(404, json={"error": "not found"})


def transport() -> httpx.MockTransport:
    return httpx.MockTransport(handler)


if __name__ == "__main__":
    import argparse

    import uvicorn
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse

    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=11500)
    args = ap.parse_args()
    app = FastAPI(title="fake ollama (TEST DOUBLE)")

    @app.api_route("/api/{path:path}", methods=["GET", "POST"])
    async def any_route(request: Request, path: str):
        from fastapi.responses import StreamingResponse
        raw = await request.body()
        if path == "chat":
            body = json.loads(raw)
            model = _known(body.get("model", ""))
            if model and body.get("stream", True):
                text = _reply(body)
                if model == THINK_MODEL:
                    text = "<think>생각 중… (숨겨져야 함)</think>\n\n" + text
                return StreamingResponse(_chat_lines(body["model"], text), media_type="application/x-ndjson")
        if path == "pull":
            body = json.loads(raw)
            return StreamingResponse(_pull_lines(body.get("model") or body["name"]), media_type="application/x-ndjson")
        r = handler(httpx.Request(request.method, f"http://x/api/{path}", content=raw))
        return JSONResponse(r.json(), status_code=r.status_code)

    uvicorn.run(app, host="127.0.0.1", port=args.port)
