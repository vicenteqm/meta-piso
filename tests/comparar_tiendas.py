from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parents[1]/'Cierre de productividad general/.build-deps'))
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(channel='msedge',headless=True);page=b.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto((ROOT/'docs/index.html').as_uri())
 page.select_option('#chain','WM');page.fill('#from','2026-11-09');page.fill('#to','2026-11-12');page.locator('#to').dispatch_event('change')
 assert '24 de 51' in page.locator('#targetSummary').inner_text()
 assert page.locator('#targetTable tbody tr').count()==24
 page.select_option('#targetResult','no');assert page.locator('#targetTable tbody tr').count()==27
 page.select_option('#targetResult','all');assert page.locator('#targetTable tbody tr').count()==51
 page.select_option('#targetMode','daily');page.select_option('#targetResult','yes')
 expected=page.evaluate("selected().filter(s=>lastGroups[0].dates.every(d=>(state.data.counts[s.key+'|'+d]?.approved||0)>=4)).length")
 assert page.locator('#targetTable tbody tr').count()==expected
 page.fill('#targetCount','0');assert 'mayor que cero' in page.locator('#targetSummary').inner_text()
 assert not errors,errors
 b.close();print('OK: 24/51 acumuladas, no alcanzadas, todas, criterio diario y validación.')
