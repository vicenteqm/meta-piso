
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

    const defaults = {
        WM: { weekday: 2, weekend: 3 },
        SAMS: { weekday: 4, weekend: 5 }
    };

    function date(v) {
        if (v instanceof Date) {
            return v.toISOString().slice(0, 10);
        }

        if (typeof v === 'number') {
            return new Date(
                Date.UTC(1899, 11, 30) +
                Math.floor(v) * 86400000
            ).toISOString().slice(0, 10);
        }

        const s = String(v ?? '').trim();
        let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);

        if (!m) {
            const d = s.match(
                /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/
            );

            if (d) {
                m = [
                    d[0],
                    d[3],
                    d[2].padStart(2, '0'),
                    d[1].padStart(2, '0')
                ];
            }
        }

        if (!m) return '';

        const out = `${m[1]}-${m[2]}-${m[3]}`;
        const dt = new Date(out + 'T12:00:00Z');

        return !isNaN(dt) &&
            dt.toISOString().slice(0, 10) === out
                ? out
                : '';
    }

    function table(rows, required) {
        const index = rows.slice(0, 30).findIndex(r =>
            required.every(c => r.map(norm).includes(c))
        );

        if (index < 0) {
            throw Error(
                'No se encontraron las columnas: ' +
                required.join(', ')
            );
        }

        return {
            headers: rows[index].map(norm),
            rows: rows.slice(index + 1)
        };
    }

    function stores(rows) {
        const t = table(rows, [
            'SOCIO',
            'NUMERO DE TIENDA/DETERMINANTE',
            'TIENDA',
            'REGION',
            'ESTATUS'
        ]);

        const out = [];
        const seen = new Set();

        for (const r of t.rows) {
            const get = k => r[t.headers.indexOf(k)];

            const code = id(
                get('NUMERO DE TIENDA/DETERMINANTE')
            );

            if (!code) continue;

            let chain = norm(get('SOCIO'))
                .replace(/[^A-Z]/g, '');

            if (chain === 'WALMART') chain = 'WM';
            if (chain === 'SAMSCLUB') chain = 'SAMS';

            if (!['WM', 'SAMS', 'CH'].includes(chain)) {
                continue;
            }

            const key = chain + ':' + code;

            if (seen.has(key)) {
                throw Error(
                    'Tienda repetida en la base: ' + key
                );
            }

            seen.add(key);

            out.push({
                id: code,
                key,
                chain,
                name: String(get('TIENDA') || code),
                region: String(
                    get('REGION') || 'SIN REGIÓN'
                ),
                status: norm(get('ESTATUS'))
            });
        }

        if (!out.some(s =>
            s.status === 'OPERANDO' &&
            s.chain !== 'CH'
        )) {
            throw Error(
                'La base no contiene tiendas WM o SAMS OPERANDO.'
            );
        }

        return out;
    }

    function records(rows) {
        const t = table(rows, [
            'FOLIO FICO',
            'APROBACION',
            'ESTATUS DEL PROCESO'
        ]);

        const get = (r, ...names) => {
            for (const n of names) {
                const i = t.headers.indexOf(n);
                if (i >= 0) return r[i];
            }
            return '';
        };

        if (
            !t.headers.includes('FECHA CREACION') &&
            !t.headers.includes('F. CREACION')
        ) {
            throw Error(
                'Falta Fecha Creación / F. Creación'
            );
        }

        if (![
            'DET',
            'DETERMINANTE',
            'SEGUNDO LUGAR DE VENTA'
        ].some(h => t.headers.includes(h))) {
            throw Error(
                'Falta DET, Determinante o Segundo lugar de venta'
            );
        }

        const out = [];
        const seen = new Set();
        const dates = new Set();

        let invalid = 0;
        let duplicates = 0;
        let ikea = 0;

        for (const r of t.rows) {
            if (!r.some(v => v !== '' && v != null)) {
                continue;
            }

            const day = date(
                get(r, 'FECHA CREACION', 'F. CREACION')
            );

            if (day) dates.add(day);

            const folio = id(get(r, 'FOLIO FICO'));

            if (!day || !folio) {
                invalid++;
                continue;
            }

            const place = norm(
                get(r, 'LUGAR DE VENTA')
            );

            const secondary = norm(
                get(r, 'SEGUNDO LUGAR DE VENTA')
            );

            if ((
                place + ' ' +
                secondary + ' ' +
                norm(get(r, 'PRODUCTO'))
            ).includes('IKEA')) {
                ikea++;
                continue;
            }

            const helperIndex = t.headers.findIndex(
                h => h.startsWith('HELPER:')
            );

            const signature = JSON.stringify(
                r.slice(
                    0,
                    Math.max(0, helperIndex) || r.length
                )
            );

            if (seen.has(signature)) {
                duplicates++;
                continue;
            }

            seen.add(signature);

            let det = id(
                get(r, 'DET', 'DETERMINANTE')
            );

            if (
                secondary ===
                    'MODULO BH SC HAROLD MONCLOVA 1007' ||
                place ===
                    'MODULO BH SC HAROLD MONCLOVA 1007'
            ) {
                det = '1007';
            }

            if (!det) {
                const cleaned = secondary.replace(
                    /\bMAAT(?:AI)?\s*\d+(?:\.\d+)*\s*$/,
                    ''
                );

                const n = cleaned.match(/\d+/);

                if (n) det = id(n[0]);
            }

            const approved =
                norm(get(r, 'APROBACION')) === 'APROBADA';

            out.push({
                day,
                det,
                place,
                secondary,
                approved,
                finalized:
                    approved &&
                    norm(get(r, 'ESTATUS DEL PROCESO')) ===
                        'FINALIZADO'
            });
        }

        if (!dates.size || !out.length) {
            throw Error(
                'El archivo no tiene registros válidos con fecha y folio numérico.'
            );
        }

        const sorted = [...dates].sort();
        const grouped = new Map();

        for (const row of out) {
            const key = JSON.stringify(row);

            if (grouped.has(key)) {
                grouped.get(key).count++;
            } else {
                grouped.set(key, {
                    ...row,
                    count: 1
                });
            }
        }

        return {
            rows: [...grouped.values()],
            start: sorted[0],
            end: sorted.at(-1),
            audit: {
                input: t.rows.length,
                invalid,
                duplicates,
                ikea
            }
        };
    }

    function aggregate(detail, base) {
        const counts = {};

        const audit = {
            ...detail.audit,
            unmatched: 0,
            inactive: 0,
            other: 0,
            matched: 0
        };

        const unknown = {};

        for (const r of detail.rows) {
            const weight = r.count || 1;

            let candidates = base.filter(
                s => s.id === r.det
            );

            if (candidates.length > 1) {
                const label =
                    r.place + ' ' + r.secondary;

                const chain =
                    /SAM|\bSC\b/.test(label)
                        ? 'SAMS'
                        : /WALMART|\bWM\b/.test(label)
                            ? 'WM'
                            : '';

                candidates = candidates.filter(
                    s => s.chain === chain
                );
            }

            if (!candidates.length && !r.det) {
                const label =
                    ' ' +
                    norm(r.secondary || r.place)
                        .replace(/[^A-Z0-9]+/g, ' ') +
                    ' ';

                candidates = base.filter(s =>
                    label.includes(
                        ' ' +
                        norm(s.name)
                            .replace(/[^A-Z0-9]+/g, ' ') +
                        ' '
                    )
                );
            }

            if (candidates.length !== 1) {
                if (
                    /\bCH\b|CHEDRAUI/.test(
                        r.place + ' ' + r.secondary
                    )
                ) {
                    audit.other += weight;
                    continue;
                }

                audit.unmatched += weight;

                const key =
                    r.det ||
                    r.secondary ||
                    r.place ||
                    'SIN TIENDA';

                unknown[key] =
                    (unknown[key] || 0) + weight;

                continue;
            }

            const s = candidates[0];

            if (s.chain === 'CH') {
                audit.other += weight;
                continue;
            }

            if (s.status !== 'OPERANDO') {
                audit.inactive += weight;
                continue;
            }

            audit.matched += weight;

            const key = s.key + '|' + r.day;

            const c = counts[key] || (
                counts[key] = {
                    approved: 0,
                    finalized: 0,
                    ingresos: 0
                }
            );

            c.ingresos += weight;
            c.approved += weight * Number(r.approved);
            c.finalized += weight * Number(r.finalized);
        }

        return {
            counts,
            start: detail.start,
            end: detail.end,
            audit,
            unknown
        };
    }

    function days(start, end) {
        const out = [];

        for (
            let d = new Date(start + 'T12:00:00Z');
            d <= new Date(end + 'T12:00:00Z');
            d.setUTCDate(d.getUTCDate() + 1)
        ) {
            out.push(d.toISOString().slice(0, 10));

            if (out.length > 370) {
                throw Error(
                    'Selecciona un periodo máximo de 370 días.'
                );
            }
        }

        return out;
    }

    function metric(
        base,
        data,
        day,
        goals,
        overrides = {}
    ) {
        let meta = 0;
        let approved = 0;
        let finalized = 0;
        let ingresos = 0;
        let ingresosDisponibles = true;

        const weekend = [0, 6].includes(
            new Date(
                day + 'T12:00:00Z'
            ).getUTCDay()
        );

        for (const s of base) {
            const rule =
                overrides[s.key] || goals[s.chain];

            meta += rule[
                weekend ? 'weekend' : 'weekday'
            ];

            const c = data.counts[
                s.key + '|' + day
            ];

            approved += c?.approved || 0;
            finalized += c?.finalized || 0;
            if (c && !Number.isFinite(c.ingresos)) {
                ingresosDisponibles = false;
            } else {
                ingresos += c?.ingresos || 0;
            }
        }

        return {
            meta,
            approved,
            finalized,
            ingresos: ingresosDisponibles ? ingresos : null,

            percent: meta
                ? approved / meta * 100
                : null,

            approvalRate: ingresosDisponibles && ingresos
                ? approved / ingresos * 100
                : null
        };
    }

    const api = {
        norm,
        id,
        date,
        table,
        stores,
        records,
        aggregate,
        days,
        metric,
        defaults
    };

    root.MetaPiso = api;

    if (typeof module !== 'undefined') {
        module.exports = api;
    }

})(
    typeof window !== 'undefined'
        ? window
        : globalThis
);
