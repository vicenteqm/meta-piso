from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parents[1]/'Cierre de productividad general/.build-deps'))
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(channel='msedge',headless=True);page=b.new_page()
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto((ROOT/'docs/index.html').as_uri())
 assert page.evaluate('''() => {
 const stores=[{key:'WM:1',chain:'WM'},{key:'SAMS:1',chain:'SAMS'}], data={counts:{}};
 for(const [day,expected] of [['2026-10-31',8],['2026-11-05',6],['2026-11-06',10],['2026-11-07',10],['2026-11-09',10]])if(C.metric(stores,data,day,goals,overrides).meta!==expected)return false;
 return true;}''')
 page.click('#settingsButton');page.fill('#goalFrom','2026-12-01');page.locator('#goalFrom').dispatch_event('change');page.fill('#wmWeek','8');page.click('#goalsForm button[type=submit]')
 assert page.evaluate("C.goalsAt(goals,'2026-11-30').WM.weekday===6 && C.goalsAt(goals,'2026-12-01').WM.weekday===8 && C.goalsAt(goals,'2026-11-05').WM.weekday===2")
 page.reload();assert page.evaluate("C.goalsAt(goals,'2026-12-01').WM.weekday===8")
 page.evaluate("localStorage.removeItem('meta-piso-repair-sams-20261107'); const saved=JSON.parse(localStorage.getItem('meta-piso-goals-v3')); saved.goals.history.find(r=>r.from==='2026-11-06').SAMS.weekend=0; localStorage.setItem('meta-piso-goals-v3',JSON.stringify(saved));")
 page.reload()
 assert page.locator('#samsRule').inner_text()=='4 / 4'
 assert page.evaluate("C.goalsAt(goals,'2026-11-01').SAMS.weekend===5 && C.goalsAt(goals,'2026-12-01').WM.weekday===8")
 assert not errors,errors
 b.close();print('OK: vigencias originales, 6/nov, cambio futuro y persistencia sin alterar fechas anteriores.')
