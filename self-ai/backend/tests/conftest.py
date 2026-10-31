import os
import tempfile

import pytest

_tmp = tempfile.mkdtemp(prefix="selfai-test-")
os.environ.update(DATA_DIR=_tmp, DATABASE_URL="", ACCESS_TOKEN="", CLOUD_ENABLED="false", CLOUD_API_KEY="",
                  OLLAMA_MODEL="fake-model", SEARXNG_URL="", BRAVE_API_KEY="", TAVILY_API_KEY="", AUTONOMY_SCAN_MINUTES="0")

from fastapi.testclient import TestClient  # noqa: E402

from app.ai import providers, router as ai_router  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.db import Base, get_engine  # noqa: E402
from app.services import search  # noqa: E402

from . import fake_ollama  # noqa: E402


class _Offline(providers.OllamaProvider):
    def __init__(self, **kw):
        import httpx

        def down(_):
            raise httpx.ConnectError("connection refused")
        super().__init__(transport=httpx.MockTransport(down), **kw)


@pytest.fixture
def ollama_up(monkeypatch):
    monkeypatch.setattr(ai_router, "local_factory",
                        lambda **kw: providers.OllamaProvider(transport=fake_ollama.transport(), **kw))


@pytest.fixture
def ollama_down(monkeypatch):
    monkeypatch.setattr(ai_router, "local_factory", lambda **kw: _Offline(**kw))


@pytest.fixture
def client(ollama_up):
    from app.main import app
    eng = get_engine()
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    from app.db import ensure_owner
    ensure_owner()
    search.transport = None
    search.CHECK_HOSTS = True
    fake_ollama.reset()
    with TestClient(app) as c:
        yield c
    get_settings.cache_clear()
