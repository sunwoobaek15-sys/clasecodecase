"""Web search provider adapters + guarded page fetcher for the Research Agent.

Nothing here touches the network unless the user turned on
`external_network_enabled` in Settings and picked a provider.
"""
from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx

from ..config import get_settings
from .files import html_to_text

USER_AGENT = "SELF-AI-Research/1.0 (personal research assistant)"
# Test hook: tests set this to an httpx.MockTransport.
transport: httpx.BaseTransport | None = None


@dataclass
class SearchHit:
    title: str
    url: str
    snippet: str


class SearchUnavailable(Exception):
    pass


def _client(timeout: float = 15) -> httpx.Client:
    return httpx.Client(timeout=timeout, transport=transport, headers={"User-Agent": USER_AGENT},
                        follow_redirects=False)


class NoSearch:
    name = "none"
    label = "연결 안 됨"

    def configured(self) -> tuple[bool, str]:
        return False, "검색 제공자가 선택되지 않았습니다. Settings > 조사(Research)에서 선택하세요."

    def search(self, query: str, n: int) -> list[SearchHit]:
        raise SearchUnavailable(self.configured()[1])


class SearxngSearch(NoSearch):
    name = "searxng"
    label = "SearXNG (직접 설치, 무료)"

    def configured(self):
        url = get_settings().SEARXNG_URL
        return (True, url) if url else (False, "서버 .env에 SEARXNG_URL을 설정해야 합니다.")

    def search(self, query, n):
        ok, msg = self.configured()
        if not ok:
            raise SearchUnavailable(msg)
        with _client() as c:
            r = c.get(f"{msg.rstrip('/')}/search", params={"q": query, "format": "json"})
            r.raise_for_status()
            res = r.json().get("results", [])
        return [SearchHit(x.get("title", ""), x.get("url", ""), x.get("content", "")) for x in res[:n]]


class WikipediaSearch(NoSearch):
    name = "wikipedia"
    label = "Wikipedia (무료, 키 불필요)"

    def configured(self):
        return True, "Wikipedia 공개 API"

    def search(self, query, n):
        lang = "ko" if any("가" <= ch <= "힣" for ch in query) else "en"
        with _client() as c:
            r = c.get(f"https://{lang}.wikipedia.org/w/api.php",
                      params={"action": "query", "list": "search", "srsearch": query, "format": "json",
                              "srlimit": n, "utf8": 1})
            r.raise_for_status()
            res = r.json().get("query", {}).get("search", [])
        import re
        return [SearchHit(x["title"], f"https://{lang}.wikipedia.org/wiki/{x['title'].replace(' ', '_')}",
                          re.sub(r"<[^>]+>", "", x.get("snippet", ""))) for x in res]


class BraveSearch(NoSearch):
    name = "brave"
    label = "Brave Search API (API 키 필요)"

    def configured(self):
        return (True, "키 설정됨") if get_settings().BRAVE_API_KEY else (False, "서버 .env에 BRAVE_API_KEY가 필요합니다.")

    def search(self, query, n):
        ok, msg = self.configured()
        if not ok:
            raise SearchUnavailable(msg)
        with _client() as c:
            r = c.get("https://api.search.brave.com/res/v1/web/search", params={"q": query, "count": n},
                      headers={"X-Subscription-Token": get_settings().BRAVE_API_KEY, "Accept": "application/json"})
            r.raise_for_status()
            res = r.json().get("web", {}).get("results", [])
        return [SearchHit(x.get("title", ""), x.get("url", ""), x.get("description", "")) for x in res[:n]]


class TavilySearch(NoSearch):
    name = "tavily"
    label = "Tavily API (API 키 필요)"

    def configured(self):
        return (True, "키 설정됨") if get_settings().TAVILY_API_KEY else (False, "서버 .env에 TAVILY_API_KEY가 필요합니다.")

    def search(self, query, n):
        ok, msg = self.configured()
        if not ok:
            raise SearchUnavailable(msg)
        with _client() as c:
            r = c.post("https://api.tavily.com/search",
                       json={"api_key": get_settings().TAVILY_API_KEY, "query": query, "max_results": n})
            r.raise_for_status()
            res = r.json().get("results", [])
        return [SearchHit(x.get("title", ""), x.get("url", ""), x.get("content", "")) for x in res[:n]]


PROVIDERS = {p.name: p for p in (NoSearch(), SearxngSearch(), WikipediaSearch(), BraveSearch(), TavilySearch())}


def get_provider(name: str):
    return PROVIDERS.get(name, PROVIDERS["none"])


def provider_status(cfg: dict) -> dict:
    p = get_provider(cfg["search_provider"])
    ok, detail = p.configured()
    if p.name != "none" and not cfg["external_network_enabled"]:
        ok, detail = False, "Settings에서 외부 네트워크 접근이 꺼져 있습니다."
    return {"provider": p.name, "label": p.label, "connected": ok, "detail": detail,
            "options": [{"name": x.name, "label": x.label, "configured": x.configured()[0]} for x in PROVIDERS.values()]}


# ---------------- guarded fetch ----------------

def _public_host(host: str) -> bool:
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            return False
    return True


MAX_PAGE_BYTES = 1_000_000


CHECK_HOSTS = True  # tests turn this off (no DNS in CI); never disable in production


def fetch_page(url: str, check_host: bool | None = None) -> str:
    """Fetch a public http(s) page as plain text. Blocks private/loopback addresses (SSRF guard)."""
    for _ in range(3):  # follow up to 2 redirects, re-checking each hop
        u = urlparse(url)
        if u.scheme not in ("http", "https") or not u.hostname:
            raise ValueError("http/https 주소만 가져올 수 있습니다.")
        if (CHECK_HOSTS if check_host is None else check_host) and not _public_host(u.hostname):
            raise ValueError("내부 네트워크 주소는 가져올 수 없습니다.")
        with _client(12) as c:
            with c.stream("GET", url) as r:
                if r.is_redirect and r.headers.get("location"):
                    url = str(httpx.URL(url).join(r.headers["location"]))
                    continue
                r.raise_for_status()
                ctype = r.headers.get("content-type", "")
                if not any(t in ctype for t in ("text/html", "text/plain", "application/xhtml")):
                    raise ValueError(f"지원하지 않는 형식: {ctype[:50]}")
                buf = b""
                for chunk in r.iter_bytes():
                    buf += chunk
                    if len(buf) > MAX_PAGE_BYTES:
                        break
        text = buf.decode(r.encoding or "utf-8", errors="replace")
        return html_to_text(text) if "html" in ctype else text
    raise ValueError("리디렉션이 너무 많습니다.")
