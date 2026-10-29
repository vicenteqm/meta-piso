(function(root){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
let current={stores:[],dates:[],data:{counts:{}},roster:null,name:''};
function collect(stores,dates,data,roster){
 const rows=[];let unknownDays=0;
 if(!roster)return {rows,unknownDays};
 for(const store of stores){
  if(!(roster[store.key]>0))continue;
  const zero=[],unknown=[];let total=0;
  for(const day of dates){const c=data.counts[store.key+'|'+day];
   if(c&&!Number.isFinite(c.ingresos)){unknown.push(day);unknownDays++;continue;}
   const n=c?.ingresos||0;total+=n;if(n===0)zero.push(day);
  }
  if(zero.length)rows.push({store,zero,unknown,total:unknown.length?null:total,coverage:roster[store.key],employees:roster.employees?.[store.key]||[]});
 }
 return {rows:rows.sort((a,b)=>b.zero.length-a.zero.length||a.store.region.localeCompare(b.store.region,'es',{numeric:true})||a.store.name.localeCompare(b.store.name,'es')),unknownDays};
}
function rowHtml(row){const {store:s,employees}=row;
 const attendance=employees.filter(e=>e.coverage).map(e=>`<div class="attendance-person"><strong>${esc(e.name)}</strong><span>${esc(e.role)}</span><div class="attendance-days">${row.zero.map(day=>`<span class="attendance-day"><time>${esc(day)}</time><b>${esc(e.attendance?.[day]||'Sin registro')}</b></span>`).join('')}</div></div>`).join('')||'Sin personal identificado';
 const staff=employees.length?employees.map(e=>`<li><strong>${esc(e.name)}</strong><span>${esc(e.role)}${e.coverage?' · aporta cobertura':''}</span></li>`).join(''):'<li>Nombres no disponibles en la fuente de este mes.</li>';
 return `<tr><td><strong>${esc(s.chain)} ${esc(s.id)}</strong><br>${esc(s.name)}</td><td>${esc(s.region)}</td><td><b>${row.coverage}</b><small>promotores / sublíderes activos</small></td><td><ul class="coverage-staff">${staff}</ul></td><td class="attendance-cell">${attendance}</td><td><b>${row.zero.length} / ${current.dates.length}</b><small>${row.zero.map(esc).join('<br>')}</small></td><td>${row.total===null?'No disponible':row.total}</td></tr>`;
}

function draw(){
 const {stores,dates,data,roster,name}=current;
 $('coverageTable').replaceChildren();
 if(!dates.length){$('coverageStatus').textContent='Selecciona un periodo válido con días disponibles en el calendario.';return;}
 if(!roster){$('coverageStatus').textContent='No hay plantilla incorporada para este mes. Actualiza las fuentes del proyecto.';return;}
 const result=collect(stores,dates,data,roster),query=norm($('coverageSearch').value.trim()),all=$('coverageMode').value==='all';
 const rows=result.rows.filter(r=>(!all||r.zero.length===dates.length)&&(!query||norm([r.store.name,r.store.id,r.store.chain,r.store.region,...r.employees.map(e=>e.name+' '+e.role)].join(' ')).includes(query)));
 $('coverageStatus').textContent=`${rows.length} tiendas · ${rows.reduce((a,r)=>a+r.zero.length,0)} casos tienda/día sin ingresos · Plantilla: ${name}.`+(result.unknownDays?` ${result.unknownDays} casos tienda/día sin datos de ingresos; no se cuentan como cero.`:'');
 if(!rows.length){$('coverageTable').innerHTML='<p class="empty">No hay tiendas con cobertura sin ingresos que coincidan con estos filtros.</p>';return;}
 $('coverageTable').innerHTML='<p class="hint">Asistencia: clave del archivo mensual para cada promotor/sublíder en los días sin ingresos. Una celda vacía se muestra como “Sin registro”, no como falta.</p><table><thead><tr><th>Tienda</th><th>Región</th><th>Cobertura</th><th>Empleados activos</th><th>Asistencia en días sin ingresos</th><th>Días sin ingresos</th><th>Ingresos del periodo</th></tr></thead><tbody>'+rows.map(rowHtml).join('')+'</tbody></table>';
}
function render(stores,dates,data,roster,name){current={stores,dates,data,roster,name};draw();}
root.MetaCobertura={render,collect};
document.addEventListener('DOMContentLoaded',()=>{$('coverageSearch').addEventListener('input',draw);$('coverageMode').addEventListener('change',draw);});
})(window);
