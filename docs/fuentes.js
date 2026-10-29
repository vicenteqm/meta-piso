(function(root){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Intl.DateTimeFormat('es-MX',{timeZone:'America/Mexico_City',dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'Sin fecha registrada';
function render(state){
 document.getElementById('monthSource').value=state.month;
 document.getElementById('sourceUpdated').textContent='Datos preparados: '+date(state.generatedAt)+' · Horario de Ciudad de México · Corte de productividad: '+state.data.start+' al '+state.data.end;
 document.getElementById('sourceCards').innerHTML=[['base','Base de tiendas'],['detalle','Productividad / Records'],['plantilla','Plantilla activa']].map(([key,title])=>{
  const files=state.sources?.[key]||[],last=files.at(-1);
  return `<article><h3>${title}</h3><b>${esc(last?.name||'Sin fuente incorporada')}</b><p>Archivo modificado: ${esc(date(last?.modifiedAt))}<br>Incorporado: ${esc(date(last?.importedAt))}</p>${files.length>1?`<details><summary>${files.length} archivos del mes</summary>${files.map(f=>`<p><b>${esc(f.name)}</b><br>${esc(f.periodStart||'')} a ${esc(f.periodEnd||'')}<br>Modificado: ${esc(date(f.modifiedAt))}<br>Incorporado: ${esc(date(f.importedAt))}</p>`).join('')}</details>`:''}</article>`;
 }).join('');
}
function init(onChange){const el=document.getElementById('monthSource');el.replaceChildren(...(root.META_CATALOG?.months||[root.META_SEED.month]).map(m=>new Option(m,m)));el.value=root.META_SEED.month;el.onchange=async()=>{el.disabled=true;try{await onChange(el.value);}finally{el.disabled=false;}};}
function load(month){if(!/^\d{4}-\d{2}$/.test(month)||!root.META_CATALOG.months.includes(month))return Promise.reject(Error('Mes no disponible'));return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='data/'+month+'/snapshot.js?v='+encodeURIComponent(root.META_CATALOG.updatedAt);s.onload=()=>{s.remove();if(root.META_SEED.month!==month)reject(Error('El archivo no corresponde al mes'));else resolve(root.META_SEED);};s.onerror=()=>{s.remove();reject(Error('No se pudo abrir la fuente del mes'));};document.head.append(s);});}
root.MetaFuentes={render,init,load};
})(window);
