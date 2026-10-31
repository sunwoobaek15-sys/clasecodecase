"""Server-side configuration loaded from environment / `.env`.

Secrets (API keys, access token) live only here, on the server. They are never
returned by any API endpoint; `public_view()` reports only whether they are set.
"""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BACKEND_DIR / ".env"), extra="ignore")

    AI_MODE: str = "AUTO"
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    OLLAMA_MODEL: str = "qwen2.5:3b"
    OLLAMA_TIMEOUT_SECONDS: float = 180

    CLOUD_ENABLED: bool = False
    CLOUD_PROVIDER: str = "openai_compatible"
    CLOUD_BASE_URL: str = "https://api.openai.com/v1"
    CLOUD_MODEL: str = ""
    CLOUD_API_KEY: str = ""

    DATABASE_URL: str = ""
    DATA_DIR: str = "./data"
    ACCESS_TOKEN: str = ""

    SEARXNG_URL: str = ""
    BRAVE_API_KEY: str = ""
    TAVILY_API_KEY: str = ""

    MAX_UPLOAD_MB: float = 5
    AUTONOMY_SCAN_MINUTES: float = 60  # 0 disables the periodic scan
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def data_path(self) -> Path:
        p = Path(self.DATA_DIR)
        if not p.is_absolute():
            p = BACKEND_DIR / p
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            url = self.DATABASE_URL
            if url.startswith("sqlite:///./"):
                url = "sqlite:///" + str(BACKEND_DIR / url[len("sqlite:///./"):])
            return url
        return f"sqlite:///{self.data_path / 'self_ai.db'}"

    @property
    def backup_path(self) -> Path:
        p = self.data_path / "backups"
        p.mkdir(parents=True, exist_ok=True)
        return p

    def secrets(self) -> list[str]:
        return [s for s in (self.CLOUD_API_KEY, self.ACCESS_TOKEN, self.BRAVE_API_KEY, self.TAVILY_API_KEY) if s]


@lru_cache
def get_settings() -> Settings:
    return Settings()


def redact(text: str) -> str:
    """Remove any configured secret from a string before it leaves the server."""
    out = str(text)
    for s in get_settings().secrets():
        if len(s) >= 4:
            out = out.replace(s, "***")
    return out
