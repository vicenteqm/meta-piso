@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "META_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if not "%~1"=="" goto argumentos
"%META_PYTHON%" -X utf8 scripts\actualizar_desde_carpetas.py --seleccionar-mes
goto resultado
:argumentos
"%META_PYTHON%" -X utf8 scripts\actualizar_desde_carpetas.py %*
:resultado
if errorlevel 1 goto fin
"%META_PYTHON%" -X utf8 scripts\publicar_actualizacion.py
:fin
pause
