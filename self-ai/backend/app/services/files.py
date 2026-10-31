"""Safe upload handling: type/size limits and text extraction. Files are never executed."""
from __future__ import annotations

import io
import json
import re
from html.parser import HTMLParser
from pathlib import PurePath

from ..config import get_settings

ALLOWED = {".txt": "text", ".md": "text", ".markdown": "text", ".csv": "text", ".json": "json",
           ".html": "html", ".htm": "html", ".pdf": "pdf", ".docx": "docx"}
MAX_DOCX_XML = 30 * 1024 * 1024  # uncompressed document.xml limit (zip-bomb guard)


class UploadError(ValueError):
    pass


def safe_filename(name: str) -> str:
    base = PurePath(name or "").name  # strip any directory parts ("../../etc/passwd" -> "passwd")
    base = re.sub(r"[^\w.\- ()\[\]가-힣]", "_", base).strip(" .")
    return base[:150] or "upload"


def max_bytes() -> int:
    return int(get_settings().MAX_UPLOAD_MB * 1024 * 1024)


class _Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript", "svg", "head"):
            self._skip += 1
        elif tag in ("p", "br", "div", "li", "h1", "h2", "h3", "h4", "tr", "section", "article"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "svg", "head") and self._skip:
            self._skip -= 1
        elif tag in ("p", "div", "li", "h1", "h2", "h3", "h4", "section", "article"):
            self.parts.append("\n")

    def handle_data(self, data):
        if not self._skip:
            self.parts.append(data)


def html_to_text(html: str) -> str:
    p = _Text()
    try:
        p.feed(html)
    except Exception:  # noqa: BLE001 - malformed html: fall back to tag stripping
        return re.sub(r"<[^>]+>", " ", html)
    text = "".join(p.parts)
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    return re.sub(r"\n\s*\n+", "\n\n", text).strip()


def _docx_text(data: bytes) -> str:
    import zipfile
    import xml.etree.ElementTree as ET
    if not data.startswith(b"PK"):
        raise UploadError("Word(.docx) 파일 형식이 올바르지 않습니다.")
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            info = z.getinfo("word/document.xml")
            if info.file_size > MAX_DOCX_XML:
                raise UploadError("문서 내용이 너무 큽니다.")
            xml = z.read(info)
        root = ET.fromstring(xml)  # ElementTree never resolves external entities
    except UploadError:
        raise
    except (KeyError, zipfile.BadZipFile, ET.ParseError) as e:
        raise UploadError("Word(.docx) 파일을 읽을 수 없습니다 (손상되었거나 다른 형식).") from e
    w = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    paras = []
    for p in root.iter(f"{w}p"):
        parts = []
        for el in p.iter():
            if el.tag == f"{w}t" and el.text:
                parts.append(el.text)
            elif el.tag in (f"{w}tab",):
                parts.append("\t")
            elif el.tag in (f"{w}br", f"{w}cr"):
                parts.append("\n")
        paras.append("".join(parts))
    text = "\n\n".join(p for p in paras if p.strip())
    if not text.strip():
        raise UploadError("문서에서 텍스트를 찾지 못했습니다.")
    return text


def extract_text(filename: str, data: bytes) -> str:
    ext = PurePath(filename).suffix.lower()
    kind = ALLOWED.get(ext)
    if not kind:
        raise UploadError(f"지원하지 않는 파일 형식입니다 ({ext or '확장자 없음'}). 허용: {', '.join(sorted(ALLOWED))}")
    if len(data) > max_bytes():
        raise UploadError(f"파일이 너무 큽니다. 최대 {get_settings().MAX_UPLOAD_MB:g}MB")
    if not data:
        raise UploadError("빈 파일입니다.")
    if kind == "pdf":
        if not data.startswith(b"%PDF"):
            raise UploadError("PDF 파일 형식이 올바르지 않습니다.")
        from pypdf import PdfReader
        try:
            reader = PdfReader(io.BytesIO(data))
            text = "\n\n".join((p.extract_text() or "") for p in reader.pages[:300])
        except Exception as e:  # noqa: BLE001
            raise UploadError("PDF를 읽을 수 없습니다 (암호화되었거나 손상된 파일).") from e
        if not text.strip():
            raise UploadError("PDF에서 텍스트를 찾지 못했습니다 (스캔 이미지 PDF는 지원하지 않습니다).")
        return text
    if kind == "docx":
        return _docx_text(data)
    if b"\x00" in data[:4096]:
        raise UploadError("텍스트 파일이 아닌 것 같습니다 (바이너리 데이터).")
    for enc in ("utf-8-sig", "cp949", "latin-1"):
        try:
            raw = data.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    if kind == "json":
        try:
            raw = json.dumps(json.loads(raw), ensure_ascii=False, indent=1)
        except ValueError as e:
            raise UploadError("JSON 형식이 올바르지 않습니다.") from e
    if kind == "html":
        raw = html_to_text(raw)
    return raw
