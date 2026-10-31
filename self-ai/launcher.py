#!/usr/bin/env python3
"""SELF AI launcher — one command for Windows, macOS and Linux.

    python launcher.py            this computer only  -> http://localhost:3000
    python launcher.py --lan      also phones on the same Wi-Fi (needs ACCESS_TOKEN in backend/.env)
    python launcher.py --no-browser

First run: creates backend/.env, a Python virtual environment, installs packages,
installs and builds the frontend. Later runs only rebuild what changed.
Stop with Ctrl+C (both servers are stopped).
"""
from __future__ import annotations

import argparse
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
WINDOWS = os.name == "nt"
BACKEND_PORT = 8000  # fixed: the frontend proxy is built to forward /api to this port


def say(msg: str) -> None:
    print(msg, flush=True)


def fail(msg: str) -> None:
    say(f"\n[X] {msg}")
    if WINDOWS and sys.stdin and sys.stdin.isatty():
        input("Enter 키를 누르면 닫힙니다...")
    sys.exit(1)


def run(cmd: list[str], cwd: Path, what: str) -> None:
    say(f"> {what}…")
    r = subprocess.run(cmd, cwd=cwd)
    if r.returncode != 0:
        fail(f"{what} 실패 (종료 코드 {r.returncode}). 위의 메시지를 확인하세요.")


def newer(paths: list[Path], than: Path) -> bool:
    if not than.exists():
        return True
    t = than.stat().st_mtime
    for p in paths:
        if p.is_file() and p.stat().st_mtime > t:
            return True
        if p.is_dir():
            for f in p.rglob("*"):
                if f.is_file() and f.stat().st_mtime > t:
                    return True
    return False


def read_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def port_free(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind((host, port))
            return True
        except OSError:
            return False


def wait_http(url: str, timeout: float, proc: subprocess.Popen | None = None) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        if proc is not None and proc.poll() is not None:
            return False
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.status < 500:
                    return True
        except Exception:  # noqa: BLE001 - not up yet
            pass
        time.sleep(0.5)
    return False


def lan_ip() -> str | None:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))  # no packet is sent; picks the LAN interface
            return s.getsockname()[0]
    except OSError:
        try:
            return socket.gethostbyname(socket.gethostname())
        except OSError:
            return None


def venv_python() -> Path:
    return BACKEND / ".venv" / ("Scripts/python.exe" if WINDOWS else "bin/python")


def setup_backend(lan: bool) -> None:
    env_file = BACKEND / ".env"
    if not env_file.exists():
        shutil.copy(BACKEND / ".env.example", env_file)
        say("[v] backend/.env 를 만들었습니다 (설정은 이 파일에서 바꿀 수 있습니다).")
    if lan and not read_env(env_file).get("ACCESS_TOKEN"):
        fail("--lan 모드는 같은 네트워크의 다른 기기가 접속할 수 있으므로, 먼저 backend/.env 파일에\n"
             "    ACCESS_TOKEN=원하는비밀번호\n    를 적어 주세요. 휴대폰에서는 Settings에 같은 값을 입력합니다.")
    if not venv_python().exists():
        run([sys.executable, "-m", "venv", str(BACKEND / ".venv")], ROOT, "Python 가상환경 만들기")
    stamp = BACKEND / ".venv" / ".installed"
    if newer([BACKEND / "requirements.txt"], stamp):
        run([str(venv_python()), "-m", "pip", "install", "-q", "-r", "requirements.txt"], BACKEND,
            "Python 패키지 설치 (처음 한 번, 1~2분)")
        stamp.touch()


def node_cmd() -> tuple[str, str]:
    node, npm = shutil.which("node"), shutil.which("npm")
    if not node or not npm:
        fail("Node.js 20 이상이 필요합니다: https://nodejs.org/ 에서 LTS 버전을 설치한 뒤 다시 실행하세요.")
    out = subprocess.run([node, "--version"], capture_output=True, text=True).stdout.strip().lstrip("v")
    try:
        if int(out.split(".")[0]) < 20:
            fail(f"Node.js 20 이상이 필요합니다 (현재 {out}).")
    except ValueError:
        pass
    return node, npm


def setup_frontend(npm: str) -> None:
    lock_marker = FRONTEND / "node_modules" / ".package-lock.json"
    if not lock_marker.exists() or newer([FRONTEND / "package-lock.json"], lock_marker):
        run([npm, "install", "--no-audit", "--no-fund"], FRONTEND, "프론트엔드 패키지 설치 (처음 한 번, 몇 분 걸릴 수 있음)")
    build_id = FRONTEND / ".next" / "BUILD_ID"
    if newer([FRONTEND / "src", FRONTEND / "next.config.ts", FRONTEND / "package.json", FRONTEND / "public"], build_id):
        run([npm, "run", "build"], FRONTEND, "프론트엔드 빌드")


def stop(procs: list[subprocess.Popen]) -> None:
    for p in procs:
        if p.poll() is None:
            try:
                p.terminate()
            except OSError:
                pass
    for p in procs:
        try:
            p.wait(timeout=10)
        except subprocess.TimeoutExpired:
            p.kill()


def main() -> None:
    ap = argparse.ArgumentParser(description="SELF AI launcher")
    ap.add_argument("--lan", action="store_true", help="같은 Wi-Fi의 휴대폰에서도 접속 (ACCESS_TOKEN 필요)")
    ap.add_argument("--port", type=int, default=3000, help="웹 화면 포트 (기본 3000)")
    ap.add_argument("--no-browser", action="store_true", help="브라우저를 자동으로 열지 않음")
    ap.add_argument("--setup-only", action="store_true", help="설치·빌드만 하고 실행하지 않음")
    args = ap.parse_args()

    if sys.version_info < (3, 11):
        fail(f"Python 3.11 이상이 필요합니다 (현재 {sys.version.split()[0]}). https://www.python.org/downloads/")
    say("SELF AI 준비 중…")
    setup_backend(args.lan)
    node, npm = node_cmd()
    setup_frontend(npm)
    if args.setup_only:
        say("[v] 설치와 빌드가 끝났습니다.")
        return

    host = "0.0.0.0" if args.lan else "127.0.0.1"
    if not port_free(BACKEND_PORT):
        fail(f"포트 {BACKEND_PORT}을(를) 다른 프로그램이 쓰고 있습니다. SELF AI가 이미 실행 중인지 확인하세요.")
    if not port_free(args.port, host):
        fail(f"포트 {args.port}을(를) 다른 프로그램이 쓰고 있습니다. --port 3001 처럼 다른 포트를 지정하세요.")

    procs: list[subprocess.Popen] = []
    kw: dict = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if WINDOWS else {"start_new_session": True}
    try:
        backend = subprocess.Popen([str(venv_python()), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1",
                                    "--port", str(BACKEND_PORT)], cwd=BACKEND, **kw)
        procs.append(backend)
        if not wait_http(f"http://127.0.0.1:{BACKEND_PORT}/api/health", 60, backend):
            fail("백엔드 서버가 시작되지 않았습니다. 위의 오류 메시지를 확인하세요.")
        frontend = subprocess.Popen([node, str(FRONTEND / "node_modules" / "next" / "dist" / "bin" / "next"), "start",
                                     "-H", host, "-p", str(args.port)], cwd=FRONTEND, **kw)
        procs.append(frontend)
        url = f"http://localhost:{args.port}"
        if not wait_http(url, 60, frontend):
            fail("웹 화면 서버가 시작되지 않았습니다. 위의 오류 메시지를 확인하세요.")

        env = read_env(BACKEND / ".env")
        ollama = os.environ.get("OLLAMA_BASE_URL") or env.get("OLLAMA_BASE_URL") or "http://127.0.0.1:11434"
        ollama_ok = wait_http(f"{ollama.rstrip('/')}/api/tags", 2)
        say("")
        say("=" * 56)
        say(f"  SELF AI 실행 중:  {url}")
        if args.lan:
            ip = lan_ip()
            if ip:
                say(f"  휴대폰(같은 Wi-Fi): http://{ip}:{args.port}")
                say("  -> 휴대폰 화면의 Settings > 접근 토큰에 ACCESS_TOKEN 값을 입력하세요")
        if not ollama_ok:
            say(f"  [!] Ollama({ollama})가 응답하지 않습니다. Ollama 앱을 실행하세요: https://ollama.com")
        say("  종료: 이 창에서 Ctrl+C")
        say("=" * 56)
        if not args.no_browser:
            webbrowser.open(url)

        while True:
            for p, name in ((backend, "백엔드"), (frontend, "웹 화면")):
                if p.poll() is not None:
                    fail(f"{name} 서버가 종료되었습니다 (코드 {p.returncode}).")
            time.sleep(1)
    except KeyboardInterrupt:
        say("\n종료하는 중…")
    finally:
        stop(procs)


def _on_sigterm(*_args) -> None:
    raise KeyboardInterrupt  # same clean shutdown as Ctrl+C


if __name__ == "__main__":
    if not WINDOWS:
        signal.signal(signal.SIGTERM, _on_sigterm)
    main()
