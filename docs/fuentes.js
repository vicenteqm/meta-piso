(function(root){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Intl.DateTimeFormat('es-MX',{timeZone:'America/Mexico_City',dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'Sin fecha registrada';
function render(state){
 document.getElementById('monthSource').value=state.month;
 if(state.month==='all'){document.getElementById('sourceUpdated').textContent='Historial combinado: '+state.data.start+' al '+state.data.end+' · Cada fecha utiliza la base y plantilla de su mes.';document.getElementById('sourceCards').innerHTML=Object.values(state.data.snapshots).map(s=>'<article><h3>'+esc(s.month)+'</h3><p>Corte: '+esc(s.data.start)+' al '+esc(s.data.end)+'</p><p>Actualizado: '+esc(date(s.generatedAt))+'</p></article>').join('');return;}
 document.getElementById('sourceUpdated').textContent='Datos preparados: '+date(state.generatedAt)+' · Horario de Ciudad de México · Corte de productividad: '+state.data.start+' al '+state.data.end;
 document.getElementById('sourceCards').innerHTML=[['base','Base de tiendas'],['detalle','Productividad / Records'],['plantilla','Plantilla activa']].map(([key,title])=>{
  const files=state.sources?.[key]||[],last=files.at(-1);
  return `<article><h3>${title}</h3><b>${esc(last?.name||'Sin fuente incorporada')}</b><p>Archivo modificado: ${esc(date(last?.modifiedAt))}<br>Incorporado: ${esc(date(last?.importedAt))}</p>${files.length>1?`<details><summary>${files.length} archivos del mes</summary>${files.map(f=>`<p><b>${esc(f.name)}</b><br>${esc(f.periodStart||'')} a ${esc(f.periodEnd||'')}<br>Modificado: ${esc(date(f.modifiedAt))}<br>Incorporado: ${esc(date(f.importedAt))}</p>`).join('')}</details>`:''}</article>`;
 }).join('');
}
function init(onChange){const el=document.getElementById('monthSource');el.replaceChildren(...(root.META_CATALOG?.months||[root.META_SEED.month]).map(m=>new Option(m,m)));el.add(new Option('Todos los meses · comparar fechas','all'),0);el.value=root.META_SEED.month;el.onchange=async()=>{el.disabled=true;try{await onChange(el.value);}finally{el.disabled=false;}};}
async function load(month){if(month==='all'){const snapshots={};for(const m of root.META_CATALOG.months)snapshots[m]=await load(m);const values=Object.values(snapshots),latest=values.find(s=>s.month===root.META_CATALOG.latest)||values[0];return {...latest,month:'all',stores:[...new Map(values.flatMap(s=>s.stores.filter(t=>t.status==='OPERANDO'&&['WM','SAMS'].includes(t.chain))).map(t=>[t.key,t])).values()],data:{...latest.data,snapshots,start:values.map(s=>s.data.start).sort()[0],end:values.map(s=>s.data.end).sort().at(-1),counts:Object.assign({},...values.map(s=>s.data.counts))}};}if(!/^\d{4}-\d{2}$/.test(month)||!root.META_CATALOG.months.includes(month))return Promise.reject(Error('Mes no disponible'));return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='data/'+month+'/snapshot.js?v='+encodeURIComponent(root.META_CATALOG.updatedAt);s.onload=()=>{s.remove();if(root.META_SEED.month!==month)reject(Error('El archivo no corresponde al mes'));else resolve(root.META_SEED);};s.onerror=()=>{s.remove();reject(Error('No se pudo abrir la fuente del mes'));};document.head.append(s);});}
root.MetaFuentes={render,init,load};
})(window);
