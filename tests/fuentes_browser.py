from pathlib import Path
import sys,json
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parents[1]/'Cierre de productividad general/.build-deps'))
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    page=browser.new_page(viewport={'width':1500,'height':1050},accept_downloads=True)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto((ROOT/'docs/index.html').as_uri())
    assert page.locator('input[type=file]').count()==0
    assert page.locator('#coverageTable th').all_text_contents()==['Tienda','Región','Cobertura','Empleados activos','Asistencia en días sin ingresos','Días sin ingresos','Ingresos del periodo']
    assert page.locator('#coverageTable details').count()==0
    assert page.locator('#coverageTable tbody tr').count()>0
    assert page.locator('#sourceCards article').count()==3
    assert '2026-10-28' in page.locator('#sourceUpdated').inner_text()
    assert page.locator('#monthSource').input_value()=='2026-10'
    assert page.evaluate("!Object.keys(state).includes('raw')&&Object.values(state.employees).flat().every(e=>Object.keys(e).sort().join()==='attendance,coverage,name,role')")
    assert page.locator('.attendance-person').count()>0
    assert page.evaluate("""() => {
      const result=MetaDiagnostico.plantilla([['SOCIO','DETERMINANTE','ESTATUS','PERFIL DE PUESTO','NOMBRE COMPLETO',19,'Entr','Sal',20,21,22],['WM',1,'ACTIVO','PROMOTOR','PRUEBA','A','10:00','18:00','F','D','']]);
      const a=result.employees['WM:1'][0].attendance;
      return JSON.stringify(a)===JSON.stringify({'19':'A','20':'F','21':'D','22':''});
    }""")
    assert page.evaluate("""() => {
      const rows=MetaCobertura.collect(selected(),lastGroups[0].dates,state.data,plantillaActiva).rows;
      return [...document.querySelectorAll('#coverageTable tbody tr')].every((tr,i)=>{
        const codes=[...tr.querySelectorAll('.attendance-day b')].map(e=>e.textContent);
        const expected=rows[i].employees.filter(e=>e.coverage).flatMap(e=>rows[i].zero.map(d=>e.attendance?.[d]||'Sin registro'));
        return JSON.stringify(codes)===JSON.stringify(expected);
      });
    }""")
    # Reconciliación independiente con los conteos por tienda/día y reglas de meta.
    assert page.evaluate("""() => {
      const stores=selected(),dates=lastGroups[0].dates;
      let a=0,f=0,goal=0;
      for(const day of dates){let dayZero=0;for(const s of stores){const c=state.data.counts[s.key+'|'+day];a+=c?.approved||0;f+=c?.finalized||0;goal+=goals[s.chain][[0,6].includes(new Date(day+'T12:00:00Z').getUTCDay())?'weekend':'weekday'];if(plantillaActiva[s.key]>0&&(!c||c.ingresos===0))dayZero++;}
       const found=MetaCobertura.collect(stores,[day],state.data,plantillaActiva);
       if(found.rows.length!==dayZero)return false;
       const diag=MetaDiagnostico.clasificar(stores,day,state.data,goals,overrides,plantillaActiva,C.metric);if(diag.cubiertasSinIngresos!==dayZero)return false;
      }
      const t=total(stores,dates);return t.approved===a&&t.finalized===f&&t.meta===goal&&t.percent===100*a/goal;
    }""")
    page.select_option('#coverageMode','all')
    assert page.evaluate("[...document.querySelectorAll('#coverageTable tbody tr')].every(tr=>tr.lastElementChild.textContent==='0')")
    page.select_option('#coverageMode','any');page.select_option('#chain','WM')
    assert page.evaluate("[...document.querySelectorAll('#coverageTable tbody tr')].every(tr=>tr.firstElementChild.textContent.startsWith('WM'))")
    page.select_option('#weekMode','closed');page.select_option('#week','2026-10-19')
    n=page.locator('#coverageTable tbody tr').count()
    with page.expect_download() as result:page.locator('[data-download]').first.click()
    result.value.save_as(ROOT/'tests/fuentes-calendario.png')
    assert page.locator('#coverageTable tbody tr').count()==n
    page.evaluate("localStorage.setItem('meta-piso-v1',JSON.stringify({state:{stores:[],data:{counts:{}}}}))")
    page.reload();assert page.locator('#coverageTable tbody tr').count()>0
    # Comprueba que los metadatos y el corte sobreviven recarga y selección de mes.
    page.select_option('#monthSource','2026-10');page.wait_for_function("document.getElementById('message').textContent==='Mes actualizado: 2026-10'")
    assert page.locator('#coverageTable tbody tr').count()>0
    page.locator('.source-panel').screenshot(path=str(ROOT/'tests/fuentes-desktop.png'))
    page.locator('#coverageDetail').scroll_into_view_if_needed()
    page.screenshot(path=str(ROOT/'tests/tabla-publicada.png'))
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    browser.close()
print('OK: fuentes fijas, 7 columnas, claves de asistencia, filtros, corte al 28, conciliación con diagnóstico, exportación, mes y caché antigua.')
