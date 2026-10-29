'use strict';
const fs=require('node:fs'),vm=require('node:vm'),C=require('../docs/core.js');
const context={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../docs/diagnostico.js'),'utf8'),context);const D=context.window.MetaDiagnostico;
const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
function parse(sheets,fn){let error;for(const rows of sheets){try{return fn(rows);}catch(e){error=e;}}throw error||Error('Archivo sin hojas compatibles');}
const base=parse(input.tables.base[0],C.stores),roster=parse(input.tables.plantilla[0],D.plantilla);
if(!Object.values(roster).some(n=>n>0))throw Error('La plantilla no contiene promotores/sublíderes activos WM/SAMS.');
// Una nueva entrega reemplaza los días que cubre: nunca se suman dos cortes del mismo día.
const byDay=new Map(),sources=[];let audit={input:0,invalid:0,duplicates:0,ikea:0};
input.tables.detalle.forEach((sheets,i)=>{
 const detail=parse(sheets,C.records);if(!detail.start.startsWith(input.month)||!detail.end.startsWith(input.month))throw Error('El detalle debe pertenecer al mes '+input.month);
 const days=C.days(detail.start,detail.end);for(const day of days)byDay.set(day,[]);
 for(const row of detail.rows)byDay.get(row.day).push(row);
 for(const k of Object.keys(audit))audit[k]+=detail.audit[k]||0;
 sources.push({...input.sources.detalle[i],periodStart:detail.start,periodEnd:detail.end});
});
const dates=[...byDay.keys()].sort(),expected=C.days(dates[0],dates.at(-1));
if(expected.some(d=>!byDay.has(d)))throw Error('Faltan días entre cortes. Agrega el detalle faltante; no se supondrán ingresos cero.');
const detail={rows:[...byDay.values()].flat(),start:dates[0],end:dates.at(-1),audit};
const data=C.aggregate(detail,base);
for(const n of Object.values(data.counts))if(n.finalized>n.approved||n.approved>n.ingresos)throw Error('No concilian ingresos, aprobadas y AF.');
// Campos públicos explícitos. Nunca se exportan las filas originales ni los datos de contacto.
const stores=base.map(({id,key,chain,name,region,status})=>({id,key,chain,name,region,status}));
const employees={};if(input.publishNames)for(const [key,items]of Object.entries(roster.employees))employees[key]=items.map(({name,role,coverage})=>({name,role,coverage}));
const publicSource=s=>{const {path,...rest}=s;return rest;};
const result={stores,data,roster:{...roster},employees,publishNames:input.publishNames,month:input.month,generatedAt:input.generatedAt,baseName:input.sources.base[0].name,detailName:sources.at(-1).name,plantillaName:input.sources.plantilla[0].name,sources:{base:input.sources.base.map(publicSource),detalle:sources.map(publicSource),plantilla:input.sources.plantilla.map(publicSource)},auditNote:'Filas de entrada y descartes describen archivos importados; los días solapados se reemplazan con la última entrega.'};
fs.writeFileSync(process.argv[3],JSON.stringify(result));
