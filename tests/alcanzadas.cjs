const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const C=require('../docs/core.js');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../docs/seed.js'),'utf8'),ctx);
const seed=ctx.window.META_SEED,base=seed.stores.filter(s=>s.status==='OPERANDO'&&['WM','SAMS'].includes(s.chain));
const data=C.aggregate(seed.raw,seed.stores);
for(const day of C.days(data.start,data.end)){
 const expected={approved:0,finalized:0,ingresos:0,meta:0};
 for(const s of base){
  expected.meta+=C.defaults[s.chain][[0,6].includes(new Date(day+'T12:00:00Z').getUTCDay())?'weekend':'weekday'];
  for(const r of seed.raw.rows.filter(r=>r.det===s.id&&r.day===day)){
   expected.ingresos+=r.count||1;expected.approved+=(r.count||1)*Number(r.approved);expected.finalized+=(r.count||1)*Number(r.finalized);
  }
 }
 const m=C.metric(base,data,day,C.defaults);
 for(const k of Object.keys(expected))assert.equal(m[k],expected[k],day+' '+k);
 assert.equal(m.percent,expected.approved/expected.meta*100);
 assert.equal(m.approvalRate,expected.approved/expected.ingresos*100);
}
const stores=[{key:'WM:1',chain:'WM'},{key:'SAMS:2',chain:'SAMS'}];
const missing=C.metric(stores,{counts:{'WM:1|2026-10-19':{approved:2,finalized:1},'SAMS:2|2026-10-19':{approved:1,finalized:1,ingresos:5}}},'2026-10-19',C.defaults);
assert.equal(missing.ingresos,null);assert.equal(missing.approvalRate,null);assert.equal(missing.percent,50);
console.log('OK: conciliación independiente diaria de metas, aprobadas, AF, ingresos y ambos porcentajes; ingresos incompletos no producen tasa falsa.');
