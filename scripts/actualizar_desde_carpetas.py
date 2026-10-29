"""Actualiza el mes desde las carpetas habituales; también admite --mes AAAA-MM."""
from pathlib import Path
import argparse,datetime,json,re,sys
from actualizar import run,ROOT
VICENTE=Path.home()/'Documents/Vicente'
MONTHS=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']
def main():
    p=argparse.ArgumentParser();p.add_argument('--mes',default=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-6))).strftime('%Y-%m'));args=p.parse_args()
    year,month=map(int,args.mes.split('-'))
    if month not in range(1,13):raise ValueError('Mes inválido')
    bases=[f for f in (VICENTE/'Base de tiendas').glob('*.xlsx') if not f.name.startswith('~$')]
    current=[f for f in bases if 'PREVIO' not in f.name.upper()];bases=current or bases
    def basedate(f):
        m=re.search(r'(\d{2})[-_](\d{2})[-_](\d{4})',f.name)
        return (datetime.date(int(m[3]),int(m[2]),int(m[1])) if m else datetime.date.min,f.stat().st_mtime)
    if not bases:raise ValueError('No se encontró base de tiendas')
    base=max(bases,key=basedate)
    rosterfolder=VICENTE/'Asistencias/Invex'/str(year)
    roster=[f for f in rosterfolder.glob('*.xlsx') if not f.name.startswith('~$') and MONTHS[month-1] in f.stem.upper()]
    if not roster:raise ValueError('No se encontró plantilla mensual '+MONTHS[month-1]+' en '+str(rosterfolder))
    plantilla=max(roster,key=lambda f:f.stat().st_mtime)
    details=[]
    for f in (VICENTE/'REPORTE DE PRODUCTIVIDAD').glob('DETALLE_PRODUCTIVIDAD_*.xlsx'):
        matches=re.findall(r'(\d{2})_(\d{2})_(\d{4})',f.stem)
        if matches and all(int(m)==month and int(y)==year for d,m,y in matches):details.append(f)
    details.sort(key=lambda f:(f.stat().st_mtime,f.name))
    manifest=ROOT/'fuentes'/args.mes/'seleccion.json'
    if not details and not manifest.exists():raise ValueError('No hay detalles de productividad del mes')
    # Respaldo del corte original ya leído en este proyecto; no cambia los archivos de origen.
    legacy=ROOT/'.private/source.json'
    if args.mes=='2026-10' and not manifest.exists() and legacy.exists():
        original=json.loads(legacy.read_text(encoding='utf-8'))
        backup=ROOT/'.private/DETALLE_PRODUCTIVIDAD_01_10_2026_AL_25_10_2026_respaldo.json'
        backup.write_text(json.dumps({'rows':original['detail']},ensure_ascii=False),encoding='utf-8')
        details.insert(0,backup)
    run(argparse.Namespace(mes=args.mes,base=str(base),detalle=[str(f) for f in details],plantilla=str(plantilla),nombres_publicos=True,solo_cantidades=False))
if __name__=='__main__':
    try:main()
    except Exception as e:print('No se actualizó el tablero: '+str(e));sys.exit(1)
