# META PISO

Calendario de productividad INVEX con tema Halloween. Aplicación estática para GitHub Pages; también abre `site/index.html` sin servidor.

## Uso

1. El sitio inicia con el detalle del 1 al 25 de octubre de 2026 y la base del 23 de octubre.
2. **Cargar detalle / Records** acepta XLSX, XLS o CSV. Identifica la hoja por encabezados; no suma las hojas de resumen. Cada carga reemplaza al detalle anterior.
3. **Actualizar base de tiendas** acepta otra base con SOCIO, NUMERO DE TIENDA/DETERMINANTE, TIENDA, REGION y ESTATUS. Recalcula el detalle vigente con la nueva base.
4. Filtra fechas, cadena, región y tienda. Cambia la vista a general, cadena, región o tienda.
5. **Editar metas** cambia la meta por cadena o añade una excepción por tienda. Un cero es válido; ambos campos vacíos eliminan la excepción. Las ediciones aplican a todo el periodo mostrado.
6. **Imagen general** exporta el total de la selección. **Imagen** en cada tabla exporta ese calendario individual. Los PNG respetan fechas y filtros.

## Reglas

- Sólo tiendas WM y SAMS con estatus OPERANDO de la base vigente. CH se omite.
- WM: 2 lunes a viernes; 3 sábado y domingo. SAMS: 4 y 5.
- Sólo `Aprobada`; `Aprobada con Garantía` no cuenta.
- AF: `Aprobada` con proceso `Finalizado`, agrupada por fecha de creación.
- Cumplimiento: suma de aprobadas / suma de metas. Meta cero se muestra con porcentaje no aplicable.
- Tiendas sin operaciones aportan su meta. Un día sin operaciones dentro del rango cargado cuenta como cero; fuera del rango se muestra Sin datos.
- Excluye IKEA, folios no numéricos y filas idénticas. Solicitudes distintas con un mismo folio se conservan como en el detalle existente.
- Un registro sin coincidencia inequívoca con la base no se atribuye a una tienda. Se informa en Fuentes y criterios.
- La base vigente se aplica a todo el periodo; no se reconstruyen fechas históricas de apertura o cierre.

## Datos y almacenamiento

Los archivos se procesan en el navegador. Las cargas y metas se conservan localmente; no se publican automáticamente ni se sincronizan entre equipos. GitHub Pages no puede leer una carpeta de Windows: para actualizar la base, selecciona el archivo desde el botón de carga.

La semilla pública sólo contiene catálogo operativo y conteos por tienda, día y resultado. No incluye folios, clientes, ejecutivos, sueldos, correos ni direcciones. Los Excel originales y material de preparación permanecen fuera del repositorio. El sitio no usa servicios externos para procesar archivos.

## Verificación

`node tests/core.cjs` prueba metas, fechas, sábados/domingos, garantía, AF, duplicados, tiendas inactivas, CH, desconocidos y meta cero. `tests/browser.py` comprueba en Edge carga de los dos Excel reales, filtros, persistencia, vistas, PNG y adaptación móvil. Requiere Playwright disponible y rutas locales configuradas para las fuentes.

Las bibliotecas SheetJS y html2canvas se distribuyen localmente en `site/vendor`, conservando los avisos de licencia de sus distribuciones.
