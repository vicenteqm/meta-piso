const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),temp=path.join(root,'.build','monthly-test');fs.mkdirSync(temp,{recursive:true});
const metadata={name:'Prueba.xlsx',modifiedAt:'2026-10-29T10:00:00Z',importedAt:'2026-10-29T11:00:00Z',sha256:'prueba',path:'fuentes/privado'};
const bh=['SOCIO','NUMERO DE TIENDA/DETERMINANTE','TIENDA','REGION','ESTATUS','CORREO'];
const rh=['Folio FICO','DET','Aprobación','Estatus del proceso','Fecha Creación','Lugar de venta'];
const ph=['SOCIO','DETERMINANTE','ESTATUS','PERFIL DE PUESTO','NOMBRE COMPLETO','CELULAR','PIN PANDAPE'];
const row=(folio,day,status)=>[folio,1,status,'Finalizado',day,'WM'];
const input={month:'2026-10',publishNames:true,generatedAt:'2026-10-29T12:00:00Z',sources:{base:[metadata],plantilla:[metadata],detalle:[metadata,metadata]},tables:{base:[[[bh,['WM',1,'PRUEBA','R1','OPERANDO','privado@ejemplo']]]],plantilla:[[[ph,['WM',1,'ACTIVO','PROMOTOR','NOMBRE PRUEBA','5551234567','1234']]]],detalle:[[[rh,row(1,'2026-10-19','Aprobada'),row(2,'2026-10-20','Aprobada')]],[[rh,row(3,'2026-10-20','Rechazada')]]]}};
const file=path.join(temp,'in.json'),output=path.join(temp,'out.json');
function run(){fs.writeFileSync(file,JSON.stringify(input));return cp.spawnSync(process.execPath,[path.join(root,'scripts/generar.cjs'),file,output],{encoding:'utf8'});}
assert.equal(run().status,0);let data=JSON.parse(fs.readFileSync(output));
assert.equal(data.data.counts['WM:1|2026-10-20'].ingresos,1);assert.equal(data.data.counts['WM:1|2026-10-20'].approved,0);
assert.equal(data.data.counts['WM:1|2026-10-19'].approved,1);
assert.equal(data.employees['WM:1'][0].name,'NOMBRE PRUEBA');
const publicText=JSON.stringify(data);for(const privateValue of ['5551234567','1234','privado@ejemplo','fuentes/privado','PIN PANDAPE','CELULAR'])assert.ok(!publicText.includes(privateValue));
input.publishNames=false;assert.equal(run().status,0);assert.deepEqual(JSON.parse(fs.readFileSync(output)).employees,{});
input.tables.detalle[1]=[[rh,row(3,'2026-10-22','Aprobada')]];assert.notEqual(run().status,0,'Debe rechazar el hueco del día 21');
console.log('OK: entregas superpuestas reemplazan días, campos privados excluidos, autorización de nombres y rechazo de periodos incompletos.');
