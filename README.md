# META PISO

Tablero: https://vicenteqm.github.io/meta-piso/

La versión publicada vive en **docs/**. No copies `site/` encima de `docs/`: conserva una versión anterior y no incluye las funciones nuevas.

## Actualizar

Haz doble clic en **ACTUALIZAR_META_PISO.bat**. Toma el mes actual, conserva las fuentes en el proyecto, valida, genera los datos públicos y publica en GitHub Pages. Un error de lectura/validación impide publicar. Si GitHub tiene cambios nuevos, se detiene para integrarlos antes.

Orígenes bajo `Documents/Vicente`:

- Base: `Base de tiendas`. Prefiere archivos sin PREVIO y el corte más reciente indicado por el nombre.
- Productividad: `REPORTE DE PRODUCTIVIDAD`. Usa detalles del mes con fechas en el nombre, sin las copias SIN FORMULAS.
- Plantilla: `Asistencias/Invex/AAAA/ASISTENCIA_INVEX_MES.xlsx`. Selecciona el mes solicitado; si hay varias entregas del mismo mes, usa la modificada más recientemente.

Para otro mes, desde una consola en el proyecto:

```bat
ACTUALIZAR_META_PISO.bat --mes 2026-11
```

Cada mes requiere base, productividad y plantilla compatibles. El más reciente se abre inicialmente; los anteriores se consultan con el selector. El personal sale de la hoja con SOCIO, DETERMINANTE, ESTATUS y PERFIL DE PUESTO. No se suman las hojas PRODUCTIVIDAD de asistencia.

Para importar fuentes específicas, usa el Python configurado del equipo:

```text
python scripts/actualizar.py --mes 2026-10 --base "ruta/base.xlsx" --detalle "ruta/detalle.xlsx" --plantilla "ruta/plantilla.xlsx" --nombres-publicos
python scripts/publicar_actualizacion.py
```

Después de la primera importación puedes indicar sólo la fuente que cambió. `--detalle` acepta varios archivos. Soporta XLSX, XLSM y CSV. Una entrega reemplaza los días que cubre, no se suma a cortes anteriores de esos días. Los huecos entre cortes detienen la actualización para no confundir días faltantes con cero. Reimportar el mismo archivo sin cambios conserva su fecha de incorporación.

## Carpetas por mes

```text
fuentes/2026-10/
  base/         # Originales e historial por hash
  detalle/
  plantilla/
  seleccion.json
docs/data/2026-10/
  snapshot.js   # Datos públicos del mes
  historial/
docs/data/catalog.json
```

`fuentes/`, `.private/` y `.build/` están excluidas de Git. No se publican Excel, folios, usuarios, nóminas, PIN, teléfonos ni correos. Sólo tiendas, regiones, conteos, nombres y puestos activos autorizados y metadatos de archivos.

El corte original del 1 al 25 de octubre se conserva como respaldo JSON de los datos extraídos del Excel en la primera preparación. Los detalles posteriores reemplazan sus días correspondientes. La fecha de modificación de ese respaldo es la del JSON, no la del Excel original que ya no está en su ruta anterior.

## Últimas actualizaciones

La parte superior muestra por fuente nombre, modificación e incorporación al proyecto, en horario de Ciudad de México. Productividad permite abrir la lista de archivos. También indica preparación de datos y corte cubierto.

Las fuentes y empleados se toman siempre de la versión publicada. Las cargas antiguas del navegador no reemplazan datos nuevos. Sólo las metas editadas se conservan localmente.

## Tabla de cobertura sin ingresos

Seis columnas: Tienda, Región, Cobertura, Empleados activos, Días sin ingresos e Ingresos del periodo.

- Cobertura: promotores/sublíderes ACTIVO asignados en la plantilla mensual. No representa asistencia diaria ni reconstruye altas/bajas históricas.
- Empleados: nombres y puestos ACTIVO de la tienda, indicando quién aporta cobertura.
- Días sin ingresos: fechas seleccionadas con cero ingresos. Cada tienda aparece una vez. Se puede limitar a cero durante todo el periodo.
- Ingresos del periodo: todos los días seleccionados; puede ser positivo si sólo algunos días tuvieron cero.
- Respeta cadena, región, tienda, fechas y semanas; permite búsqueda por tienda, determinante, región o empleado.
- Un dato desconocido no se cuenta como cero. Los casos tienda/día coinciden con el diagnóstico del calendario.

## Cálculos

Sólo OPERANDO WM/SAMS. WM: 2 lunes a viernes y 3 sábado/domingo. SAMS: 4 y 5, salvo edición. Sólo Aprobada sin garantía. AF exige además Finalizado, por fecha de creación. Cumplimiento = aprobadas/meta; aprobación = aprobadas/ingresos. Los totales usan sumas, no promedios de porcentajes. Alcanzadas cuenta tiendas que cumplen o superan su meta positiva. Se excluyen CH, IKEA, folios inválidos y copias idénticas; solicitudes distintas con igual folio se conservan.

Colores: WM verde >30%, rojo <30%; SAMS verde >60%, rojo <60%. Igualdad neutra; cumplir la meta sigue siendo 100%.

Pruebas de fuentes y tabla: `tests/fuentes_browser.py` (Playwright y Edge). Bibliotecas y logos se incluyen localmente para exportar PNG.
