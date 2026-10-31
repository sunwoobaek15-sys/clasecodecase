"""TEST DOUBLE that speaks the Ollama HTTP API. It is NOT an AI.

Used only by the automated tests and the UI smoke test, because a real model
cannot be downloaded in CI. Replies are deterministic and always start with
"[TEST DOUBLE]" so they can never be mistaken for real model output.

Run standalone:  python -m tests.fake_ollama --port 11500
"""
from __future__ import annotations

import json
import re

import httpx

MODEL = "fake-model:latest"


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


def handler(request: httpx.Request) -> httpx.Response:
    if request.url.path == "/api/tags":
        return httpx.Response(200, json={"models": [{"name": MODEL}]})
    if request.url.path == "/api/chat":
        body = json.loads(request.content)
        if body.get("model") not in (MODEL, MODEL.split(":")[0]):
            return httpx.Response(404, json={"error": "model not found"})
        return httpx.Response(200, json={"model": body["model"], "message": {"role": "assistant", "content": _reply(body)},
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
        req = httpx.Request(request.method, f"http://x/api/{path}", content=await request.body())
        r = handler(req)
        return JSONResponse(r.json(), status_code=r.status_code)

    uvicorn.run(app, host="127.0.0.1", port=args.port)
