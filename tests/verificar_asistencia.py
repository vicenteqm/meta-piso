from pathlib import Path
import json,unicodedata,openpyxl
ROOT=Path(__file__).resolve().parents[1]
snapshot=json.loads((ROOT/'docs/seed.js').read_text(encoding='utf-8').split('=',1)[1].strip().rstrip(';'))
config=json.loads((ROOT/'fuentes/2026-10/seleccion.json').read_text(encoding='utf-8'))
w=openpyxl.load_workbook(ROOT/config['plantilla']['path'],read_only=True,data_only=True)
sheet=w.worksheets[0];it=sheet.values;headers=list(next(it))
def norm(x):return ' '.join(''.join(c for c in unicodedata.normalize('NFD',str(x or '')) if not unicodedata.combining(c)).upper().split())
h=[norm(v) for v in headers];role=next(i for i,v in enumerate(h) if 'PERFIL DE PUESTO' in v)
expected={}
for r in it:
    if norm(r[h.index('ESTATUS')])!='ACTIVO':continue
    chain=norm(r[h.index('SOCIO')]);chain={'WALMART':'WM',"SAM'S CLUB":'SAMS','SAMS CLUB':'SAMS'}.get(chain,chain)
    if chain not in ('WM','SAMS'):continue
    det=r[h.index('DETERMINANTE')]
    try:det=str(int(det))
    except (ValueError,TypeError):continue
    name=str(r[h.index('NOMBRE COMPLETO')] or '')
    if not any(x in norm(r[role]) for x in ['PROMOTOR','SUBLIDER','SUB LIDER']):continue
    codes={f'2026-10-{int(day):02d}':str(r[i]).strip() if r[i] is not None else '' for i,day in enumerate(headers) if str(day).isdigit() and 1<=int(day)<=31}
    expected.setdefault((chain+':'+det,name),[]).append(codes)
count=0
for key,employees in snapshot['employees'].items():
    for e in employees:
        if e['coverage']:
            candidates=expected[(key,e['name'])]
            assert e['attendance'] in candidates,'La asistencia no coincide con el Excel'
            candidates.remove(e['attendance']);count+=1
w.close()
assert not any(expected.values())
print('Verificadas contra Excel:',count,'personas; claves por día idénticas a la fuente, sin usar Entrada/Salida.')
