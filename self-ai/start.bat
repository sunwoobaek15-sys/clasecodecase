@echo off
rem SELF AI (Windows):  start.bat   or   start.bat --lan
cd /d "%~dp0"
where py >nul 2>nul && (py -3 launcher.py %* & goto :end)
where python >nul 2>nul && (python launcher.py %* & goto :end)
echo Python 3.11+ is required: https://www.python.org/downloads/  (check "Add python.exe to PATH")
pause
:end
