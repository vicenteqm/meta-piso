(function(root){
'use strict';
const iso=d=>d.toISOString().slice(0,10);
function monday(day){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return iso(d);}
function add(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return iso(d);}
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function list(from,to,cutoff=today()){
 const out=[];for(let start=monday(from);start<=to;start=add(start,7)){
  const end=add(start,6),a=start<from?from:start,b=end>to?to:end;
  out.push({start,end,from:a,to:b,complete:start>=from&&end<=to&&end<cutoff,dates:MetaPiso.days(a,b)});
 }return out;
}
function select(weeks,mode,key){return weeks.filter(w=>(!key||w.start===key)&&(mode==='all'||w.complete));}
const api={monday,add,today,list,select};root.MetaWeeks=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
