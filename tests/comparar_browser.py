from pathlib import Path
import sys, threading, functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parents[1]/'Cierre de productividad general/.build-deps'))
from playwright.sync_api import sync_playwright
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(SimpleHTTPRequestHandler,directory=str(ROOT/'docs')))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='msedge',headless=True)
  page=browser.new_page(accept_downloads=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}')
  page.locator('#compareA').fill('2026-10-26')
  page.locator('#compareB').fill('2026-11-02')
  page.locator('#compareB').dispatch_event('change')
  page.wait_for_function("document.querySelector('#compareResult tbody')!==null")
  assert 'lunes, 26 de octubre' in page.locator('#compareResult').inner_text()
  assert 'lunes, 2 de noviembre' in page.locator('#compareResult').inner_text()
  page.select_option('#compareChain','WM')
  page.wait_for_function("document.querySelector('#compareResult h3')?.textContent.startsWith('WM ·')")
  # Independently reconcile published counts and weekday goals for both months.
  import json
  snapshots=[json.loads((ROOT/f'docs/data/{m}/snapshot.js').read_text(encoding='utf-8').split('=',1)[1].rstrip(';\n\r ')) for m in ['2026-10','2026-11']]
  expected=[]
  for s,d in zip(snapshots,['2026-10-26','2026-11-02']):
   stores=[t for t in s['stores'] if t['status']=='OPERANDO' and t['chain']=='WM']
   approved=sum(s['data']['counts'].get(t['key']+'|'+d,{}).get('approved',0) for t in stores)
   expected.append((len(stores)*2,approved))
  rows=page.locator('#compareResult tbody tr')
  for i,(target,approved) in enumerate(expected):
   assert float(rows.nth(1).locator('td').nth(i).inner_text().replace(',',''))==target
   assert float(rows.nth(2).locator('td').nth(i).inner_text().replace(',',''))==approved
  with page.expect_download() as downloaded:page.click('#compareImage')
  assert downloaded.value.suggested_filename.endswith('.png')
  page.locator('#compareA').fill('2025-10-26');page.locator('#compareA').dispatch_event('change')
  page.wait_for_function("document.querySelector('#compareStatus').textContent.includes('No hay datos publicados')")
  assert page.locator('#compareResult tbody').count()==0
  assert page.locator('#compareImage').is_disabled()
  assert not errors,errors
  browser.close()
  print('OK: comparación octubre/noviembre, metas, aprobadas, filtro, PNG y mes ausente.')
finally:server.shutdown()
