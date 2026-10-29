"""Importa fuentes locales por mes, genera una instantánea y conserva el historial.
Uso: python scripts/actualizar.py --mes 2026-10 --base archivo.xlsx --detalle archivo.xlsx --plantilla archivo.xlsx
Después: python scripts/publicar_actualizacion.py
"""
import argparse,csv,datetime,hashlib,json,os,re,shutil,subprocess,tempfile,unicodedata
from pathlib import Path
import openpyxl
ROOT=Path(__file__).resolve().parents[1]
NODE=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rows(p,kind):
    if p.suffix.lower()=='.json':return json.loads(p.read_text(encoding='utf-8'))['rows']
    if p.suffix.lower()=='.csv':
        content=p.read_bytes()
        try:text=content.decode('utf-8-sig')
        except UnicodeDecodeError:text=content.decode('cp1252')
        try:dialect=csv.Sniffer().sniff(text[:10000],delimiters=',;\t')
        except csv.Error:dialect=csv.excel
        return list(csv.reader(text.splitlines(),dialect))
    if p.suffix.lower() not in ('.xlsx','.xlsm'):raise ValueError('Usa XLSX, XLSM o CSV: '+p.name)
    w=openpyxl.load_workbook(p,read_only=True,data_only=True)
    result=[]
    def norm(v):return ' '.join(''.join(c for c in unicodedata.normalize('NFD',str(v or '')) if not unicodedata.combining(c)).upper().split())
    required={'base':['SOCIO','NUMERO DE TIENDA/DETERMINANTE','ESTATUS'],'detalle':['FOLIO FICO','APROBACION','ESTATUS DEL PROCESO'],'plantilla':['SOCIO','DETERMINANTE','ESTATUS']}[kind]
    for s in w:
        s.reset_dimensions()
        top=list(s.iter_rows(max_row=35,values_only=True))
        if not any(all(h in [norm(v) for v in r] for h in required) and (kind!='plantilla' or any('PERFIL DE PUESTO' in norm(v) for v in r)) for r in top):continue
        result.append([list(r) for r in s.values if any(v is not None for v in r)])
        break
    w.close();return result
def serialize(v):return v.isoformat() if isinstance(v,(datetime.datetime,datetime.date)) else str(v)
def run(args):
    if not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])',args.mes):raise ValueError('Mes inválido: usa AAAA-MM')
    folder=ROOT/'fuentes'/args.mes;folder.mkdir(parents=True,exist_ok=True)
    manifest=folder/'seleccion.json'
    config=json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists() else {'month':args.mes,'base':None,'detalle':[],'plantilla':None,'publishNames':False}
    if args.nombres_publicos:config['publishNames']=True
    if args.solo_cantidades:config['publishNames']=False
    for kind,value in [('base',args.base),('detalle',args.detalle),('plantilla',args.plantilla)]:
        if not value:continue
        paths=value if isinstance(value,list) else [value]
        for value in paths:
            source=Path(value).resolve();digest=sha(source);target=folder/kind/(digest[:12]+'_'+source.name)
            previous=config[kind] if kind=='detalle' else ([config[kind]] if config[kind] else [])
            if any(x['name']==source.name and x['sha256']==digest for x in previous):continue
            target.parent.mkdir(exist_ok=True)
            if not target.exists():shutil.copy2(source,target)
            entry={'path':str(target.relative_to(ROOT)).replace('\\','/'),'name':source.name,'sha256':digest,'modifiedAt':datetime.datetime.fromtimestamp(source.stat().st_mtime,datetime.timezone.utc).isoformat(),'importedAt':now()}
            if kind=='detalle':
                config[kind]=[x for x in config[kind] if x['name']!=entry['name']]+[entry]
            else:config[kind]=entry
    if not config['base'] or not config['detalle'] or not config['plantilla']:raise ValueError('Se necesitan base, detalle y plantilla para la primera actualización del mes.')
    payload={'month':args.mes,'publishNames':config['publishNames'],'generatedAt':now(),'sources':{},'tables':{}}
    for kind in ['base','detalle','plantilla']:
        entries=config[kind] if kind=='detalle' else [config[kind]]
        payload['sources'][kind]=entries;payload['tables'][kind]=[]
        for entry in entries:
            source=ROOT/entry['path']
            if sha(source)!=entry['sha256']:raise ValueError('Archivo modificado sin importar: '+entry['name'])
            value=rows(source,kind)
            # JSON/CSV contienen una hoja; Excel contiene una lista de hojas.
            sheets=value if source.suffix.lower() in ('.xlsx','.xlsm') else [value]
            payload['tables'][kind].append(sheets)
    build=ROOT/'.build';build.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=build) as temporary:
        inp=Path(temporary)/'input.json';out=Path(temporary)/'snapshot.json'
        inp.write_text(json.dumps(payload,default=serialize,ensure_ascii=False),encoding='utf-8')
        subprocess.run([str(NODE),str(ROOT/'scripts/generar.cjs'),str(inp),str(out)],check=True)
        snapshot=json.loads(out.read_text(encoding='utf-8'))
        # Sólo se reemplaza la versión pública después de validar las tres fuentes.
        public=ROOT/'docs/data'/args.mes;public.mkdir(parents=True,exist_ok=True)
        text='window.META_SEED='+json.dumps(snapshot,ensure_ascii=False,separators=(',',':'))+';\n'
        stamp=payload['generatedAt'].replace(':','').replace('.','').replace('+','')
        (public/'historial').mkdir(exist_ok=True)
        (public/'historial'/f'{stamp}.js').write_text(text,encoding='utf-8')
        (public/'snapshot.js').write_text(text,encoding='utf-8')
        catalogPath=ROOT/'docs/data/catalog.json'
        catalog=json.loads(catalogPath.read_text()) if catalogPath.exists() else {'months':[]}
        catalog['months']=sorted(set(catalog['months']+[args.mes]),reverse=True)
        catalog['latest']=catalog['months'][0];catalog['updatedAt']=payload['generatedAt']
        catalogPath.write_text(json.dumps(catalog,indent=2),encoding='utf-8')
        (ROOT/'docs/data/catalog.js').write_text('window.META_CATALOG='+json.dumps(catalog)+';',encoding='utf-8')
        # La página inicia con el mes más reciente; los meses anteriores permanecen disponibles.
        latest=ROOT/'docs/data'/catalog['latest']/'snapshot.js'
        shutil.copyfile(latest,ROOT/'docs/seed.js')
        page=ROOT/'docs/index.html'
        html=page.read_text(encoding='utf-8')
        for name in ['seed.js','data/catalog.js']:
            html=re.sub(r'src="'+re.escape(name)+r'(?:\?[^"]*)?"','src="'+name+'?v='+stamp+'"',html)
        page.write_text(html,encoding='utf-8')
        manifest.write_text(json.dumps(config,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({'month':args.mes,'period':[snapshot['data']['start'],snapshot['data']['end']],'stores':len(snapshot['stores']),'staff':sum(snapshot['roster'].values()),'generatedAt':payload['generatedAt']},ensure_ascii=False))
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--mes',required=True);p.add_argument('--base');p.add_argument('--detalle',nargs='+');p.add_argument('--plantilla');p.add_argument('--nombres-publicos',action='store_true');p.add_argument('--solo-cantidades',action='store_true')
    run(p.parse_args())
