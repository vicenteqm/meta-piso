
/* Diagnóstico de plantilla ACTIVA.
   No utiliza A/R ni otras claves de asistencia. */

(function (root) {
  'use strict';

  const norm = v => String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  const id = v =>
    /^\d+(\.0+)?$/.test(String(v ?? '').trim())
      ? String(Number(v))
      : '';

  function plantilla(rows) {
    const pos = rows.slice(0, 35).findIndex(r => {
      const h = r.map(norm);

      return h.includes('DETERMINANTE') &&
        h.includes('SOCIO') &&
        h.includes('ESTATUS') &&
        h.some(x => x.includes('PERFIL DE PUESTO'));
    });

    if (pos < 0) {
      throw Error(
        'No se encontraron SOCIO, DETERMINANTE, ' +
        'ESTATUS y PERFIL DE PUESTO.'
      );
    }

    const h = rows[pos].map(norm);
    const col = name => h.findIndex(x => x === name);
    const puesto = h.findIndex(
      x => x.includes('PERFIL DE PUESTO')
    );

    const out = {};
    // No enumerable: los conteos existentes y Object.values siguen siendo numéricos.
    Object.defineProperty(out, 'employees', { value: {}, enumerable: false });

    for (const r of rows.slice(pos + 1)) {
      const status = norm(r[col('ESTATUS')]);
      const role = norm(r[puesto]);

      if (status !== 'ACTIVO') continue;

      let chain = norm(r[col('SOCIO')])
        .replace(/[^A-Z]/g, '');

      if (chain === 'WALMART') chain = 'WM';
      if (chain === 'SAMSCLUB') chain = 'SAMS';

      if (!['WM', 'SAMS'].includes(chain)) continue;

      const det = id(r[col('DETERMINANTE')]);
      if (!det) continue;

      const key = chain + ':' + det;
      const coverage = /PROMOTOR|SUBLIDER|SUB LIDER/.test(role);
      const fields = h.flatMap((label, i) => label && r[i] != null && r[i] !== ''
        ? [{label, value: r[i] instanceof Date ? r[i].toISOString().slice(0,10) : String(r[i])}] : []);
      const named = fields.find(f => /^(NOMBRE COMPLETO|NOMBRE DEL EMPLEADO|NOMBRE DEL COLABORADOR|COLABORADOR|EMPLEADO|NOMBRE)$/.test(f.label));
      const parts = fields.filter(f => /^(NOMBRE\(S\)|NOMBRES|APELLIDO PATERNO|APELLIDO MATERNO)$/.test(f.label));
      const employee = {name: named?.value || parts.map(f=>f.value).join(' ') || 'Nombre no disponible', role, coverage, fields};
      (out.employees[key] ||= []).push(employee);
      if (coverage) out[key] = (out[key] || 0) + 1;
    }

    return out;
  }

  function clasificar(
    stores, day, data, goals, overrides, roster, metric
  ) {
    if (!roster) return null;

    const result = {
      sinCobertura: 0,
      cubiertasSinIngresos: 0,
      bajoMeta: 0,
      alcanzada: 0,
      alertas: 0,
      total: stores.length
    };

    for (const store of stores) {
      const m = metric(
        [store], data, day, goals, overrides
      );

      if (typeof m.ingresos !== 'number') {
        return null;
      }

      const hasStaff = (roster[store.key] || 0) > 0;

      // Si tiene ingresos, se clasifica por productividad.
      if (m.meta > 0 && m.approved >= m.meta) {
        result.alcanzada++;
      } else if (m.ingresos > 0) {
        result.bajoMeta++;
      } else if (!hasStaff) {
        result.sinCobertura++;
      } else {
        result.cubiertasSinIngresos++;
      }

      // Alerta adicional, sin duplicar la tienda.
      if (!hasStaff && m.ingresos > 0) {
        result.alertas++;
      }
    }

    return result;
  }

  root.MetaDiagnostico = {
    plantilla,
    clasificar
  };
})(window);
