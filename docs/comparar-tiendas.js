(function(root){
'use strict';
const section=document.createElement('section');section.className='coverage-detail';section.id='compareStores';
section.innerHTML=`<h2>Comparar tiendas por meta</h2><p class="hint">Usa las fechas, cadena, región, tienda y días seleccionados en los filtros del calendario. Esta comparación no modifica las metas oficiales.</p>
<div class="coverage-controls"><label>Meta de aprobadas<input id="targetCount" type="number" min="1" step="1" value="4"></label>
<label>Cómo comparar<select id="targetMode"><option value="period">Acumuladas en el periodo</option><option value="daily">Alcanzar la meta cada día</option></select></label>
<label>Mostrar<select id="targetResult"><option value="yes">Tiendas que alcanzaron</option><option value="no">Tiendas que no alcanzaron</option><option value="all">Todas las tiendas</option></select></label>
<label>Buscar tienda<input id="targetSearch" type="search" placeholder="Nombre, número o región"></label></div><p id="targetSummary" role="status"></p><div id="targetTable" class="coverage-scroll"></div>`;
document.getElementById('coverageDetail').before(section);
const el=id=>document.getElementById(id);let scope={stores:[],dates:[]};
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function draw(){
 const {stores,dates}=scope,target=Number(el('targetCount').value),daily=el('targetMode').value==='daily';
 el('targetTable').replaceChildren();
 if(!Number.isSafeInteger(target)||target<1){el('targetSummary').textContent='Escribe una meta entera mayor que cero.';return;}
 if(!dates.length||!stores.length){el('targetSummary').textContent='Selecciona fechas y tiendas con datos en el calendario.';return;}
 const rows=stores.map(store=>{
  const eligible=dates.filter(day=>dayStores([store],day).length);
  const values=eligible.map(day=>({day,n:C.metric([store],state.data,day,goals,overrides).approved}));
  const approved=values.reduce((n,v)=>n+v.n,0),reached=values.filter(v=>v.n>=target);
  const required=daily?target*eligible.length:target;
  return {store,eligible,approved,reached,required,ok:eligible.length>0&&(daily?reached.length===eligible.length:approved>=target)};
 }).filter(r=>r.eligible.length).sort((a,b)=>b.approved-a.approved||a.store.name.localeCompare(b.store.name));
 const success=rows.filter(r=>r.ok).length,query=normalize(el('targetSearch').value),result=el('targetResult').value;
 const shown=rows.filter(r=>(result==='all'||r.ok===(result==='yes'))&&normalize([r.store.id,r.store.name,r.store.region].join(' ')).includes(query));
 el('targetSummary').textContent=`${success} de ${rows.length} tiendas alcanzaron ${target} aprobadas ${daily?'en cada día con tienda OPERANDO':'acumuladas en el periodo'} · ${dates[0]} al ${dates.at(-1)} · ${dates.length} días seleccionados · ${shown.length} tiendas en la tabla. Sólo Aprobada; sin aprobadas con garantía.`;
 el('targetTable').innerHTML=`<table><thead><tr><th>Tienda</th><th>Región</th><th>Aprobadas acumuladas</th><th>Meta ${daily?'del periodo':'comparada'}</th><th>Alcance acumulado</th><th>Días con ${target} o más</th><th>Resultado</th></tr></thead><tbody>${shown.map(r=>`<tr><td>${escape(r.store.chain)} ${escape(r.store.id)} · ${escape(r.store.name)}</td><td>${escape(r.store.region)}</td><td>${r.approved}</td><td>${r.required}</td><td>${(100*r.approved/r.required).toFixed(1)}%</td><td>${r.reached.length}/${r.eligible.length}<details><summary>Ver fechas</summary>${r.reached.map(v=>escape(v.day)+': '+v.n).join('<br>')||'Ningún día'}</details></td><td>${r.ok?'Alcanzó':'No alcanzó'}</td></tr>`).join('')}</tbody></table>${shown.length?'':'<p>No hay tiendas que coincidan con esta selección.</p>'}<p class="hint">${daily?'Para alcanzar cada día no basta con compensar días bajos con días altos.':'Se suman las aprobadas de los días seleccionados; alcanzar el acumulado no significa cumplir la meta diaria.'} Si el periodo cruza meses, sólo se consideran los días en que la tienda aparece OPERANDO en la base de su mes.</p>`;
}
for(const id of ['targetCount','targetMode','targetResult','targetSearch'])el(id).addEventListener('input',draw);
root.MetaCompararTiendas={render(stores,dates){scope={stores,dates};draw();}};
})(window);
