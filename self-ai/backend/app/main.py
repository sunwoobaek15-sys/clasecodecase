"""SELF AI API server."""
import logging
import secrets
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings, redact
from .db import init_engine
from .routers import autonomy, chat, evaluation, knowledge, learning, memory, research, system

logger = logging.getLogger("self_ai")


def _autonomy_loop(stop: threading.Event, minutes: float) -> None:
    """Periodic scan. It only creates proposals (and auto-runs low-risk ones if the user allowed it)."""
    from .db import SessionLocal
    from .services import autonomy
    while not stop.wait(minutes * 60):
        db = SessionLocal()
        try:
            autonomy.scan(db)
        except Exception:  # noqa: BLE001
            logger.exception("autonomy scan failed")
        finally:
            db.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    minutes = get_settings().AUTONOMY_SCAN_MINUTES
    stop = threading.Event()
    if minutes > 0:
        threading.Thread(target=_autonomy_loop, args=(stop, minutes), daemon=True, name="autonomy").start()
    yield
    stop.set()


def create_app() -> FastAPI:
    env = get_settings()
    init_engine()
    app = FastAPI(title="SELF AI", version="1.0.0", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in env.CORS_ORIGINS.split(",") if o.strip()],
                       allow_methods=["*"], allow_headers=["*"])

    @app.middleware("http")
    async def access_token(request: Request, call_next):
        token = get_settings().ACCESS_TOKEN
        if token and request.url.path.startswith("/api") and request.url.path != "/api/health" \
                and request.method != "OPTIONS":
            given = request.headers.get("x-access-token", "")
            if not secrets.compare_digest(given, token):
                return JSONResponse({"detail": "접근 토큰이 필요합니다. Settings에서 토큰을 입력하세요."}, status_code=401)
        return await call_next(request)

    @app.exception_handler(HTTPException)
    async def http_error(_: Request, exc: HTTPException):
        detail = exc.detail
        if isinstance(detail, str):
            detail = redact(detail)
        return JSONResponse({"detail": detail}, status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        errs = [{"field": ".".join(str(x) for x in e.get("loc", [])[1:]), "message": e.get("msg", "")} for e in exc.errors()]
        return JSONResponse({"detail": "입력값이 올바르지 않습니다.", "errors": errs}, status_code=422)

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception):
        logger.exception("unhandled error")  # full detail only in the server console
        return JSONResponse({"detail": "서버 내부 오류가 발생했습니다."}, status_code=500)

    for r in (system.router, chat.router, memory.router, knowledge.router, learning.router, research.router,
              evaluation.router, autonomy.router):
        app.include_router(r)
    return app


app = create_app()
