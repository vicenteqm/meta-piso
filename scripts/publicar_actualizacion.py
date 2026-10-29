"""Publica docs y el proceso de actualización sin copiar la versión antigua de site."""
from pathlib import Path
import os,subprocess
ROOT=Path(__file__).resolve().parents[1]
env=dict(os.environ,GIT_TERMINAL_PROMPT='0',GCM_INTERACTIVE='never')
def git(*args):
    r=subprocess.run(['git',*args],cwd=ROOT,env=env,text=True,capture_output=True)
    if r.returncode:raise RuntimeError(r.stderr or r.stdout)
    return r.stdout.strip()
git('fetch','origin')
ahead=git('rev-list','HEAD..origin/main','--count')
if ahead!='0':raise RuntimeError('GitHub tiene cambios nuevos. Revisa e integra esos cambios antes de publicar.')
git('add','--','docs','scripts/actualizar.py','scripts/generar.cjs','scripts/actualizar_desde_carpetas.py','scripts/publicar_actualizacion.py','ACTUALIZAR_META_PISO.bat','.gitignore','README.md','tests/fuentes_browser.py','tests/monthly.cjs')
staged=git('diff','--cached','--name-only').splitlines()
if any(f.startswith(('fuentes/','.private/','.build/')) or f.lower().endswith(('.xlsx','.xlsm','.xls','.csv','.xlsb')) for f in staged):raise RuntimeError('Se detectó una fuente privada en el índice')
git('diff','--cached','--check')
if staged:git('commit','-m','Incorporar fuentes mensuales y tabla de cobertura sin ingresos')
git('push','origin','main')
print('Publicado: https://vicenteqm.github.io/meta-piso/\nCommit: '+git('rev-parse','HEAD'))
