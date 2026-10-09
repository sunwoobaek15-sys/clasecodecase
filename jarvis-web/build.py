"""jarvis.html (claude.ai 아티팩트용 본문) → index.html (GitHub 등에서 바로 여는 독립 실행 파일)."""
from pathlib import Path

here = Path(__file__).parent
body = (here / "jarvis.html").read_text(encoding="utf-8")
head = (
    "<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\">"
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">"
    "<meta name=\"theme-color\" content=\"#03070F\">"
    "<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);box-sizing:border-box;height:100%}"
    "body{margin:0}[hidden]{display:none!important}</style></head><body>\n"
)
(here / "index.html").write_text(
    "<!-- 생성 파일: jarvis.html 을 고친 뒤 `python3 jarvis-web/build.py` 로 다시 만드세요 -->\n"
    + head + body + "\n</body></html>\n",
    encoding="utf-8",
)
print("wrote index.html")
