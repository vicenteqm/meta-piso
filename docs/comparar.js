(function(){
'use strict';
const panel=document.createElement('section');
panel.className='source-panel';
panel.innerHTML=`<h2>Comparar fechas entre meses</h2>
<p class="hint">Elige dos fechas, por ejemplo lunes 26 de octubre y lunes 2 de noviembre. Cada día utiliza las tiendas OPERANDO de su mes y las metas configuradas actualmente. Estos filtros son independientes del calendario.</p>
<div class="filters">
<label>Fecha base<input id="compareA" type="date"></label>
<label>Fecha a comparar<input id="compareB" type="date"></label>
<label>Cadena<select id="compareChain"><option value="">WM + SAMS</option><option>WM</option><option>SAMS</option></select></label>
<label>Región<select id="compareRegion"></select></label>
<label>Tienda<select id="compareStore"></select></label>
<button id="compareImage">↓ Imagen comparativa</button></div>
<p id="compareStatus" role="status"></p><div id="compareResult" class="coverage-scroll"></div>`;
document.querySelector('.filters').before(panel);
const el=id=>document.getElementById(id);
const cache=new Map([[state.month,structuredClone(state)]]);
let sequence=0;
// Independent namespace prevents changing the calendar's monthly snapshot.
async function snapshot(month){
 if(cache.has(month))return cache.get(month);
 if(!window.META_CATALOG.months.includes(month))throw Error('No hay datos publicados de '+month+'.');
 const response=await fetch('data/'+month+'/snapshot.js?v='+encodeURIComponent(META_CATALOG.updatedAt));
 if(!response.ok)throw Error('No se pudo cargar '+month+'.');
 const source=await response.text();
 const match=source.match(/^\s*(?:window\.)?META_SEED\s*=\s*([\s\S]*?);?\s*$/);
 if(!match)throw Error('Formato de datos no reconocido.');
 const data=JSON.parse(match[1].replace(/;\s*$/,''));
 if(data.month!==month)throw Error('El archivo no corresponde al mes seleccionado.');
 cache.set(month,data);return data;
}
const eligible=s=>s.stores.filter(t=>t.status==='OPERANDO'&&['WM','SAMS'].includes(t.chain));
const label=d=>new Intl.DateTimeFormat('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));
function choices(node,items,title){const old=node.value;node.replaceChildren(new Option(title,''),...items.map(([v,t])=>new Option(t,v)));if(items.some(([v])=>v===old))node.value=old;}
async function update(){
 const ticket=++sequence;el('compareImage').disabled=true;el('compareResult').replaceChildren();
 const dates=[el('compareA').value,el('compareB').value];
 if(dates.some(d=>!d)){el('compareStatus').textContent='Selecciona ambas fechas.';return;}
 el('compareStatus').textContent='Cargando comparación…';
 try{
  const snapshots=await Promise.all(dates.map(d=>snapshot(d.slice(0,7))));
  if(ticket!==sequence)return;
  dates.forEach((d,i)=>{if(d<snapshots[i].data.start||d>snapshots[i].data.end)throw Error('Sin datos de productividad para '+d+'. Corte disponible: '+snapshots[i].data.start+' al '+snapshots[i].data.end+'.');});
  const chain=el('compareChain').value;
  const union=[...new Map(snapshots.flatMap(eligible).map(s=>[s.key,s])).values()].filter(s=>!chain||s.chain===chain);
  choices(el('compareRegion'),[...new Set(union.map(s=>s.region))].sort().map(r=>[r,r]),'Todas las regiones');
  const region=el('compareRegion').value;
  choices(el('compareStore'),union.filter(s=>!region||s.region===region).sort((a,b)=>a.name.localeCompare(b.name)).map(s=>[s.key,s.chain+' '+s.id+' · '+s.name]),'Todas las tiendas');
  const key=el('compareStore').value;
  const stores=snapshots.map(s=>eligible(s).filter(t=>(!chain||t.chain===chain)&&(!region||t.region===region)&&(!key||t.key===key)));
  const metrics=snapshots.map((s,i)=>stores[i].length?C.metric(stores[i],s.data,dates[i],goals,overrides):null);
  const reached=snapshots.map((s,i)=>stores[i].filter(t=>{const m=C.metric([t],s.data,dates[i],goals,overrides);return m.meta>0&&m.approved>=m.meta;}).length);
  const rows=[['Tiendas OPERANDO',...stores.map(s=>s.length),false],...['meta','approved','finalized','ingresos','percent','approvalRate'].map((k,i)=>[['Meta','Aprobadas','Aprobadas finalizadas','Ingresos','Cumplimiento','Aprobación'][i],...metrics.map(m=>m?.[k]??null),i>3])];
  el('compareResult').innerHTML=`<h3>${esc(chain||'WM + SAMS')} · ${esc(region||'Todas las regiones')}${key?' · '+esc(el('compareStore').selectedOptions[0].text):''}</h3><table class="day-metrics"><thead><tr><th>Indicador</th>${dates.map(d=>'<th>'+esc(label(d))+'</th>').join('')}<th>Diferencia (segunda − primera)</th></tr></thead><tbody>${rows.map(([title,a,b,percent])=>`<tr><th>${title}</th><td>${percent?pct(a):a===null?'—':fmt(a)}</td><td>${percent?pct(b):b===null?'—':fmt(b)}</td><td>${a===null||b===null?'—':(b-a>0?'+':'')+fmt(b-a)+(percent?' puntos porcentuales':'')}</td></tr>`).join('')}<tr><th>Alcanzadas</th>${stores.map((s,i)=>'<td>'+reached[i]+'/'+s.length+' tiendas</td>').join('')}<td>—</td></tr></tbody></table><p class="hint">Cumplimiento = aprobadas ÷ meta × 100. Aprobación = aprobadas ÷ ingresos × 100. — indica que no hay una base de cálculo disponible. Metas actuales aplicadas a ambas fechas.</p>`;
  el('compareStatus').textContent=stores.some(s=>!s.length)?'No hay tiendas OPERANDO para este filtro en una de las fechas.':stores[0].map(s=>s.key).sort().join()!==stores[1].map(s=>s.key).sort().join()?'La composición de tiendas cambia entre ambas fechas; cada columna refleja su base mensual.':'Comparación lista.';
  el('compareImage').disabled=false;
 }catch(e){if(ticket===sequence)el('compareStatus').textContent=e.message;}
}
el('compareB').value=state.data.end;
el('compareA').value=MetaWeeks.add(state.data.end,-7);
for(const id of ['compareA','compareB','compareChain','compareRegion','compareStore'])el(id).addEventListener('change',()=>{if(id==='compareChain'){el('compareRegion').value='';el('compareStore').value='';}if(id==='compareRegion')el('compareStore').value='';update();});
el('goalsForm').addEventListener('submit',()=>setTimeout(update,0));
el('restoreGoals').addEventListener('click',()=>setTimeout(update,0));
el('compareImage').onclick=async()=>{
 const button=el('compareImage');button.disabled=true;
 const wrap=document.createElement('div');wrap.className='exporting';wrap.style.cssText='position:absolute;left:-20000px;width:1400px;padding:32px;background:#100c18;color:white';
 wrap.innerHTML='<h2>META PISO · Comparación entre fechas</h2>'+el('compareResult').innerHTML+'<p>'+esc(el('compareStatus').textContent)+'</p>';document.body.append(wrap);
 try{const canvas=await html2canvas(wrap,{scale:2,backgroundColor:'#100c18'});const a=document.createElement('a');a.download='META_PISO_comparacion_'+el('compareA').value+'_'+el('compareB').value+'.png';a.href=canvas.toDataURL('image/png');a.click();}catch(e){el('compareStatus').textContent='No se pudo descargar: '+e.message;}finally{wrap.remove();button.disabled=false;}
};
update();
})();
