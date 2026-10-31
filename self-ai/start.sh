#!/usr/bin/env bash
# SELF AI launcher (macOS / Linux).
#   ./start.sh         -> this computer only   (http://localhost:3000)
#   ./start.sh --lan   -> also phones on the same Wi-Fi (requires ACCESS_TOKEN in backend/.env)
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"

need() { command -v "$1" >/dev/null 2>&1 || { echo "❌ '$1'이(가) 필요합니다. $2"; exit 1; }; }
need python3 "https://www.python.org/downloads/ 에서 Python 3.11 이상을 설치하세요."
need node "https://nodejs.org/ 에서 Node.js 20 이상을 설치하세요."
need npm "Node.js와 함께 설치됩니다."

HOST=127.0.0.1
if [[ "${1:-}" == "--lan" ]]; then HOST=0.0.0.0; fi

# backend
cd "$ROOT/backend"
[[ -f .env ]] || { cp .env.example .env; echo "✔ backend/.env 생성 (필요하면 수정하세요)"; }
if [[ ! -d .venv ]]; then echo "▶ Python 가상환경 만드는 중…"; python3 -m venv .venv; fi
if [[ ! -f .venv/.installed ]] || [[ requirements.txt -nt .venv/.installed ]]; then
  echo "▶ Python 패키지 설치 중…"; .venv/bin/pip install -q -r requirements.txt && touch .venv/.installed
fi
if [[ "$HOST" == "0.0.0.0" ]] && ! grep -Eq '^ACCESS_TOKEN=.+' .env; then
  echo "❌ --lan 모드는 다른 기기가 접속할 수 있으므로 backend/.env에 ACCESS_TOKEN=원하는비밀번호 를 먼저 설정해야 합니다."
  exit 1
fi

# frontend
cd "$ROOT/frontend"
if [[ ! -d node_modules ]]; then echo "▶ 프론트엔드 패키지 설치 중… (처음 한 번, 몇 분 걸릴 수 있음)"; npm install --no-audit --no-fund; fi
if [[ ! -f .next/BUILD_ID ]] || [[ -n "$(find src next.config.ts -newer .next/BUILD_ID -print -quit 2>/dev/null)" ]]; then
  echo "▶ 프론트엔드 빌드 중…"; npm run build
fi

cd "$ROOT/backend"
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 &
BACK=$!
cd "$ROOT/frontend"
npx next start -H "$HOST" -p 3000 &
FRONT=$!
trap 'kill $BACK $FRONT 2>/dev/null; exit 0' INT TERM

echo ""
echo "✅ SELF AI 실행 중:  http://localhost:3000"
if [[ "$HOST" == "0.0.0.0" ]]; then
  IP=$( (ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}') | head -1)
  [[ -n "$IP" ]] && echo "📱 휴대폰(같은 Wi-Fi):  http://$IP:3000  (Settings에서 접근 토큰 입력)"
fi
echo "   로컬 AI: Ollama가 실행 중이어야 합니다 (https://ollama.com). 종료: Ctrl+C"
wait
