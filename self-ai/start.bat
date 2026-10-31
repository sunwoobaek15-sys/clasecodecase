@echo off
rem SELF AI launcher (Windows).  start.bat  or  start.bat --lan
setlocal
cd /d "%~dp0"
set ROOT=%cd%
where python >nul 2>nul || (echo Python 3.11+ is required: https://www.python.org/downloads/ & pause & exit /b 1)
where npm >nul 2>nul || (echo Node.js 20+ is required: https://nodejs.org/ & pause & exit /b 1)
set HOST=127.0.0.1
if "%1"=="--lan" set HOST=0.0.0.0

cd "%ROOT%\backend"
if not exist .env copy .env.example .env >nul
if not exist .venv (echo Creating Python environment... & python -m venv .venv)
if not exist .venv\.installed (echo Installing Python packages... & .venv\Scripts\pip install -q -r requirements.txt && type nul > .venv\.installed)
if "%HOST%"=="0.0.0.0" (
  findstr /R "^ACCESS_TOKEN=." .env >nul || (echo --lan needs ACCESS_TOKEN=yourpassword in backend\.env first. & pause & exit /b 1)
)

cd "%ROOT%\frontend"
if not exist node_modules (echo Installing frontend packages, first time only... & call npm install --no-audit --no-fund)
if not exist .next\BUILD_ID (echo Building frontend... & call npm run build)

start "SELF AI backend" cmd /k "cd /d %ROOT%\backend && .venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000"
start "SELF AI frontend" cmd /k "cd /d %ROOT%\frontend && npx next start -H %HOST% -p 3000"
echo.
echo SELF AI: http://localhost:3000   (Ollama must be running for AI answers)
timeout /t 4 >nul
start http://localhost:3000
