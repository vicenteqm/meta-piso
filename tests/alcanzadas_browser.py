from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parents[1]/'Cierre de productividad general/.build-deps'))
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    page=browser.new_page(viewport={'width':1500,'height':1050},accept_downloads=True)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto((ROOT/'docs/index.html').as_uri())
    for chain,expected in [('WM',11),('SAMS',11)]:
        page.select_option('#chain',chain);page.fill('#from','2026-10-19');page.locator('#from').dispatch_event('change');page.fill('#to','2026-10-25');page.locator('#to').dispatch_event('change')
        assert page.locator('.tiendas-meta').count()==7
        assert page.locator('.tiendas-meta').first.inner_text().strip()==f'Alcanzadas {expected}/{64 if chain=="WM" else 49} tiendas'
        assert page.locator('.diag-pendiente').count()==7
        # El diagnóstico existente se conserva y no modifica el conteo de alcanzadas.
        page.evaluate("plantillaActiva={};render()")
        assert page.locator('.diagnostico-tiendas').count()==7
        assert page.locator('.tiendas-meta').first.evaluate('(e)=>e===e.parentElement.lastElementChild')
        assert page.evaluate("lastGroups.every(g=>g.dates.every(d=>{const a=tiendasConMeta(g.stores,d);const b=MetaDiagnostico.clasificar(g.stores,d,state.data,goals,overrides,plantillaActiva,C.metric);return a.lograron===b.alcanzada&&b.sinCobertura+b.cubiertasSinIngresos+b.bajoMeta+b.alcanzada===a.total;}))")
        with page.expect_download() as result:page.locator('[data-download]').first.click()
        result.value.save_as(ROOT/'tests'/f'alcanzadas-{chain}.png')
        page.evaluate('plantillaActiva=null')
    # Caso sintético: igualdad cuenta, exceso no compensa otras tiendas, cero no es alcanzada.
    checks=page.evaluate("""() => {
      state.data.counts={'WM:1|2026-10-19':{approved:2},'WM:2|2026-10-19':{approved:100},'WM:3|2026-10-19':{approved:1}};
      const s=[1,2,3,4].map(n=>({key:'WM:'+n,chain:'WM'}));
      const a=tiendasConMeta(s,'2026-10-19');
      overrides={'WM:1':{weekday:3,weekend:3},'WM:4':{weekday:0,weekend:0}};
      const b=tiendasConMeta(s,'2026-10-19');
      state.data.counts={'WM:1|2026-10-24':{approved:2}};overrides={};
      return [a,b,tiendasConMeta([s[0]],'2026-10-24')];
    }""")
    assert checks==[{'lograron':2,'total':4},{'lograron':1,'total':4},{'lograron':0,'total':1}],checks
    assert not errors,errors
    browser.close()
print('OK: cuadro final en siete días y PNG de ambas cadenas, con/sin plantilla, igualdad, exceso, excepciones, cero y fin de semana.')
