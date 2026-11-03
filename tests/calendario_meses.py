from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parents[1]/'Cierre de productividad general/.build-deps'))
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 browser=p.chromium.launch(channel='msedge',headless=True)
 page=browser.new_page(accept_downloads=True,viewport={'width':1500,'height':1000})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto((ROOT/'docs/index.html').as_uri())
 page.select_option('#monthSource','all')
 page.wait_for_function("state.month==='all'")
 page.fill('#from','2026-10-26');page.fill('#to','2026-11-02')
 page.select_option('#weekday','1');page.select_option('#chain','WM')
 assert page.evaluate("JSON.stringify(lastGroups[0].dates)")=='["2026-10-26","2026-11-02"]'
 assert page.locator('#reports .tiendas-meta').count()==2
 assert '2026-10' in page.locator('#reports').inner_text()
 assert '2026-11' in page.locator('#reports').inner_text()
 assert page.evaluate('''() => {
  for(const d of lastGroups[0].dates){const s=state.data.snapshots[d.slice(0,7)];const stores=s.stores.filter(t=>t.status==='OPERANDO'&&t.chain==='WM');const expected=stores.reduce((n,t)=>n+(s.data.counts[t.key+'|'+d]?.approved||0),0);const actual=total(selected(),[d]);if(actual.approved!==expected||actual.meta!==stores.length*2)return false;if(Math.abs(actual.percent-100*expected/actual.meta)>1e-9)return false;}return true;
 }''')
 with page.expect_download() as dl:page.click('#downloadAll')
 assert '2026-10-26_2026-11-02' in dl.value.suggested_filename
 with page.expect_download() as dl:page.locator('#reports [data-download]').first.click()
 assert dl.value.suggested_filename.endswith('.png')
 page.select_option('#monthSource','2026-10');page.wait_for_function("state.month==='2026-10'")
 assert not errors,errors
 print('OK: calendario entre meses, lunes, metas, aprobadas, porcentajes, ambas imágenes y retorno a octubre.')
 browser.close()
