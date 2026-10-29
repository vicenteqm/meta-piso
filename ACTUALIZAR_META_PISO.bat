@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "META_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
"%META_PYTHON%" -X utf8 scripts\actualizar_desde_carpetas.py %*
if errorlevel 1 goto fin
"%META_PYTHON%" -X utf8 scripts\publicar_actualizacion.py
:fin
pause
