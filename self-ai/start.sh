#!/usr/bin/env bash
# SELF AI (macOS / Linux):  ./start.sh   or   ./start.sh --lan
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then PY=python3; elif command -v python >/dev/null 2>&1; then PY=python; else
  echo "Python 3.11 이상이 필요합니다: https://www.python.org/downloads/"; exit 1; fi
exec "$PY" launcher.py "$@"
