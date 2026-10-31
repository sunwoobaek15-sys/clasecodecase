"""Text utilities: normalisation, tokenising (Korean-aware), similarity, BM25 ranking.

Korean words carry particles ("서울에서", "서울은"), so whole-word matching misses
most hits. Hangul runs are therefore also indexed as character bigrams. This is a
pure-Python index good for a personal database (thousands of rows). The `rank`
function is the single place to swap in vector search later.
"""
from __future__ import annotations

import hashlib
import math
import re
from collections import Counter
from collections.abc import Callable, Iterable, Sequence
from typing import TypeVar

T = TypeVar("T")

_WORD = re.compile(r"[0-9a-zA-ZÀ-ɏ]+|[가-힣]+|[぀-ヿ一-鿿]+")
_HANGUL = re.compile(r"^[가-힣]+$")
_CJK = re.compile(r"^[぀-ヿ一-鿿]+$")

STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "to", "of", "and", "or", "in", "on", "for",
    "with", "that", "this", "it", "as", "at", "by", "from", "what", "how", "why", "do", "does", "i",
    "you", "me", "my", "your", "we", "our", "can", "will", "about",
    "그리고", "그러나", "하지만", "그래서", "이것", "저것", "그것", "있다", "없다", "하다", "합니다",
    "입니다", "있습니다", "무엇", "어떻게", "왜", "나는", "저는", "내가", "제가", "알려줘", "뭐야", "대해",
}


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def content_hash(text: str) -> str:
    return hashlib.sha256(normalize(re.sub(r"[^\w\s]", "", text or "")).encode()).hexdigest()


def tokens(text: str) -> list[str]:
    out: list[str] = []
    for w in _WORD.findall((text or "").lower()):
        if w in STOPWORDS:
            continue
        if _HANGUL.match(w) or _CJK.match(w):
            if len(w) == 1:
                out.append(w)
            else:
                out.extend(w[i:i + 2] for i in range(len(w) - 1))
            if len(w) >= 2:
                out.append(w)  # whole word too, rewards exact word matches
        elif len(w) > 1 or w.isdigit():
            out.append(w)
    return out


def similarity(a: str, b: str) -> float:
    """Jaccard similarity of token sets, 0..1."""
    ta, tb = set(tokens(a)), set(tokens(b))
    if not ta or not tb:
        return 1.0 if normalize(a) == normalize(b) else 0.0
    return len(ta & tb) / len(ta | tb)


def rank(query: str, items: Sequence[T], text_of: Callable[[T], str], limit: int = 5,
         min_score: float = 0.0) -> list[tuple[T, float]]:
    """BM25 ranking of `items` against `query`. Returns (item, score) best first."""
    q = [t for t in tokens(query)]
    if not q or not items:
        return []
    docs = [Counter(tokens(text_of(it))) for it in items]
    n = len(docs)
    avgdl = (sum(sum(d.values()) for d in docs) / n) or 1.0
    df: Counter[str] = Counter()
    for d in docs:
        df.update(set(d))
    k1, b = 1.5, 0.75
    scored = []
    for it, d in zip(items, docs):
        dl = sum(d.values()) or 1
        s = 0.0
        for t in set(q):
            f = d.get(t)
            if not f:
                continue
            idf = math.log(1 + (n - df[t] + 0.5) / (df[t] + 0.5))
            s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * dl / avgdl))
        if s > min_score:
            scored.append((it, s))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:limit]


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?。！？])\s+|(?<=다\.)\s*|\n+", text or "")
    return [p.strip() for p in parts if p and len(p.strip()) > 3]


def chunk_text(text: str, target: int = 900, hard_max: int = 1500) -> list[str]:
    """Split text into chunks on paragraph, then sentence boundaries."""
    paras = [p.strip() for p in re.split(r"\n\s*\n", text or "") if p.strip()]
    chunks: list[str] = []
    buf = ""
    for p in paras:
        pieces = [p] if len(p) <= hard_max else split_sentences(p)
        for piece in pieces:
            while len(piece) > hard_max:  # a single enormous sentence
                chunks.append(piece[:hard_max])
                piece = piece[hard_max:]
            if buf and len(buf) + len(piece) + 1 > target:
                chunks.append(buf)
                buf = piece
            else:
                buf = f"{buf}\n{piece}" if buf else piece
    if buf:
        chunks.append(buf)
    return chunks


def extractive_points(text: str, n: int = 5) -> list[str]:
    """Pick the n most representative sentences (term-frequency scoring), in original order."""
    sents = split_sentences(text)
    if len(sents) <= n:
        return sents
    tf = Counter(tokens(text))
    scored = []
    for i, s in enumerate(sents):
        toks = tokens(s)
        if not toks:
            continue
        score = sum(tf[t] for t in set(toks)) / (len(set(toks)) ** 0.5)
        scored.append((score, i, s))
    best = sorted(scored, reverse=True)[:n]
    return [s for _, _, s in sorted(best, key=lambda x: x[1])]


def keywords(text: str, n: int = 6) -> list[str]:
    words = [w for w in _WORD.findall((text or "").lower()) if w not in STOPWORDS and len(w) > 1]
    return [w for w, _ in Counter(words).most_common(n)]


def make_title(text: str, max_len: int = 60) -> str:
    first = (text or "").strip().split("\n", 1)[0].strip().lstrip("#").strip()
    return first[:max_len] + ("…" if len(first) > max_len else "") if first else "제목 없음"


def first_unique(items: Iterable[str]) -> list[str]:
    seen, out = set(), []
    for it in items:
        k = normalize(it)
        if k and k not in seen:
            seen.add(k)
            out.append(it)
    return out
