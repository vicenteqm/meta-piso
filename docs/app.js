
'use strict';

/* ==========================================
   META PISO - APLICACIÓN PRINCIPAL
   ========================================== */

const C = MetaPiso;

const $ = id => document.getElementById(id);

const fmt = n => new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: 1
}).format(n);

const pct = n => n === null ? '—' : fmt(n) + '%';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[c]));

/* ==========================================
   ESTADO Y CONFIGURACIÓN
   ========================================== */

let state = structuredClone(window.META_SEED);
let raw = state.raw || null;
let goals = structuredClone(C.defaults);
let overrides = {};
let lastGroups = [];

delete state.raw;

try {
    const saved = JSON.parse(
        localStorage.getItem('meta-piso-v1')
    );

    if (saved?.state?.data && saved?.state?.stores) {
        state = saved.state;
        raw = saved.raw || null;
    }

    if (saved?.goals) goals = saved.goals;
    if (saved?.overrides) overrides = saved.overrides;

} catch (e) {
    $('message').textContent =
        'No se pudo recuperar la sesión anterior; se usa el corte inicial.';
}

function save() {
    try {
        localStorage.setItem(
            'meta-piso-v1',
            JSON.stringify({
                state,
                raw,
                goals,
                overrides
            })
        );
    } catch (e) {
        $('message').textContent =
            'La vista está actualizada, pero no se pudo guardar en este navegador.';
    }
}

/* ==========================================
   TIENDAS Y FILTROS
   ========================================== */

function active() {
    return state.stores.filter(s =>
        s.status === 'OPERANDO' &&
        s.chain !== 'CH'
    );
}

function options(node, items, first) {
    const prev = node.value;

    node.replaceChildren(new Option(first, ''));

    for (const [value, label] of items) {
        node.add(new Option(label, value));
    }

    if (items.some(item => item[0] === prev)) {
        node.value = prev;
    }
}

function filters(changed = '') {
    const list = active();

    if (changed === 'store' && $('store').value) {
        const store = list.find(
            s => s.key === $('store').value
        );

        if (store) {
            $('chain').value = store.chain;
            $('region').value = store.region;
        }
    }

    if (changed === 'chain') {
        $('store').value = '';

        if (!list.some(s =>
            (!$('chain').value ||
                s.chain === $('chain').value) &&
            s.region === $('region').value
        )) {
            $('region').value = '';
        }
    }

    if (changed === 'region') {
        $('store').value = '';

        if (!list.some(s =>
            (!$('region').value ||
                s.region === $('region').value) &&
            s.chain === $('chain').value
        )) {
            $('chain').value = '';
        }
    }

    const region = $('region').value;

    options(
        $('chain'),
        [...new Set(
            list
                .filter(s =>
                    !region || s.region === region
                )
                .map(s => s.chain)
        )]
            .sort()
            .map(chain => [chain, chain]),
        'WM + SAMS'
    );

    const chain = $('chain').value;

    options(
        $('region'),
        [...new Set(
            list
                .filter(s =>
                    !chain || s.chain === chain
                )
                .map(s => s.region)
        )]
            .sort((a, b) =>
                a.localeCompare(b, 'es', {
                    numeric: true
                })
            )
            .map(region => [region, region]),
        'Todas las regiones'
    );

    options(
        $('store'),
        list
            .filter(s =>
                (!chain || s.chain === chain) &&
                (!$('region').value ||
                    s.region === $('region').value)
            )
            .sort((a, b) =>
                a.name.localeCompare(b.name, 'es')
            )
            .map(s => [
                s.key,
                `${s.chain} ${s.id} · ${s.name}`
            ]),
        'Todas las tiendas'
    );
}

function selected() {
    return active().filter(s =>
        (!$('chain').value ||
            s.chain === $('chain').value) &&
        (!$('region').value ||
            s.region === $('region').value) &&
        (!$('store').value ||
            s.key === $('store').value)
    );
}

/* ==========================================
   MARCAS Y PORCENTAJES
   ========================================== */

function brand(stores) {
    const chains = [
        ...new Set(stores.map(s => s.chain))
    ];

    return chains.length === 1
        ? chains[0]
        : '';
}

function percentClass(stores, value) {
    const chain = brand(stores);

    const limit = chain === 'WM'
        ? 30
        : chain === 'SAMS'
            ? 60
            : null;

    if (
        value === null ||
        limit === null ||
        value === limit
    ) {
        return 'percent-neutral';
    }

    return value > limit
        ? 'percent-positive'
        : 'percent-negative';
}

function brandLogo(stores) {
    const chain = brand(stores);

    return chain
        ? `<img
            class="chain-logo"
            src="${META_BRANDS[chain]}"
            alt="${chain === 'WM' ? 'Walmart' : 'Sam’s Club'}"
          >`
        : '';
}

/* ==========================================
   FECHAS Y SEMANAS
   ========================================== */

function periodLabel(dates) {
    const weeks = new Set(
        dates.map(MetaWeeks.monday)
    );

    return `${dates[0]} al ${dates.at(-1)} · ${dates.length} días seleccionados · ${weeks.size} semanas`;
}

function initDates() {
    $('from').value = state.data.start;
    $('to').value = state.data.end;

    for (const element of [
        $('from'),
        $('to')
    ]) {
        element.min = state.data.start;
        element.max = state.data.end;
    }
}

function filteredWeeks(stores) {
    const all = MetaWeeks.list(
        $('from').value,
        $('to').value
    );

    const mode = $('weekMode').value;

    const available = MetaWeeks.select(
        all,
        mode,
        '',
        dates => total(stores, dates)
    );

    options(
        $('week'),
        available.map(w => [
            w.start,
            `${w.start} al ${w.end}${w.complete ? '' : ' · parcial / en curso'}`
        ]),
        'Todas las disponibles'
    );

    return MetaWeeks.select(
        available,
        mode,
        $('week').value,
        dates => total(stores, dates)
    );
}

/* ==========================================
   CÁLCULOS DE PRODUCTIVIDAD
   ========================================== */

function total(stores, dates) {
    const out = {
        meta: 0,
        approved: 0,
        finalized: 0
    };

    for (const day of dates) {
        const metric = C.metric(
            stores,
            state.data,
            day,
            goals,
            overrides
        );

        for (const key of Object.keys(out)) {
            out[key] += metric[key];
        }
    }

    out.percent = out.meta
        ? 100 * out.approved / out.meta
        : null;

    return out;
}

/* ==========================================
   TIENDAS QUE ALCANZARON META
   ========================================== */

function tiendasConMeta(stores, day) {
    let lograron = 0;
    let totalTiendas = 0;

    for (const store of stores) {
        const metric = C.metric(
            [store],
            state.data,
            day,
            goals,
            overrides
        );

        totalTiendas++;

        if (
            metric.meta > 0 &&
            metric.approved >= metric.meta
        ) {
            lograron++;
        }
    }

    return {
        lograron,
        total: totalTiendas
    };
}

/* ==========================================
   GENERACIÓN DEL CALENDARIO
   ========================================== */

function report(label, stores, dates, index) {
    const sum = total(stores, dates);

    const article = document.createElement('article');

    const chain = brand(stores);

    article.className =
        'report' +
        (chain ? ' theme-' + chain : '');

    article.innerHTML = `
        <div class="report-heading">
            <div class="report-brand">
                ${brandLogo(stores)}

                <div>
                    <h3>${esc(label)}</h3>

                    <p>
                        ${periodLabel(dates)}
                        · ${stores.length} tiendas OPERANDO
                    </p>
                </div>
            </div>

            <button
                class="no-export"
                data-download="${index}"
            >
                ↓ Imagen
            </button>
        </div>
    `;

    const chosen = new Set(dates);

    const weekStarts = [
        ...new Set(
            dates.map(MetaWeeks.monday)
        )
    ];

    const all = weekStarts.flatMap(start =>
        C.days(
            start,
            MetaWeeks.add(start, 6)
        )
    );

    let html = `
        <div class="calendar-scroll">
            <table class="calendar">
                <thead>
                    <tr>
                        ${[
                            'Lunes',
                            'Martes',
                            'Miércoles',
                            'Jueves',
                            'Viernes',
                            'Sábado',
                            'Domingo'
                        ].map(day => `
                            <th scope="col">${day}</th>
                        `).join('')}
                    </tr>
                </thead>

                <tbody>
    `;

    all.forEach((day, i) => {
        if (i % 7 === 0) {
            html += '<tr>';
        }

        if (!chosen.has(day)) {
            html += `
                <td class="blank">
                    <div class="day-top">
                        <b>
                            ${Number(day.slice(-2))}
                        </b>
                    </div>

                    ${
                        day < state.data.start ||
                        day > state.data.end
                            ? 'Sin datos'
                            : 'Fuera del filtro'
                    }
                </td>
            `;
        } else {
            const metric = C.metric(
                stores,
                state.data,
                day,
                goals,
                overrides
            );

            const good =
                metric.percent !== null &&
                metric.percent >= 100;

            const tiendas = tiendasConMeta(
                stores,
                day
            );

            const estadoTiendas =
                tiendas.total > 0 &&
                tiendas.lograron === tiendas.total
                    ? 'completo'
                    : tiendas.lograron > 0
                        ? 'parcial'
                        : 'sin-meta';

            const clasePorcentaje = chain
                ? percentClass(
                    stores,
                    metric.percent
                )
                : good
                    ? 'good'
                    : 'low';

            html += `
                <td>
                    <div class="day-top">
                        <b>
                            ${Number(day.slice(-2))}
                        </b>

                        <span>
                            ${day.slice(5, 7)}/${day.slice(0, 4)}
                        </span>
                    </div>

                    <table class="day-metrics">
                        <thead>
                            <tr>
                                <th>Meta</th>
                                <th>Aprob.</th>
                                <th>%</th>
                                <th>AF</th>
                            </tr>
                        </thead>

                        <tbody>
                            <tr>
                                <td>
                                    ${fmt(metric.meta)}
                                </td>

                                <td>
                                    ${fmt(metric.approved)}
                                </td>

                                <td class="${clasePorcentaje}">
                                    ${pct(metric.percent)}
                                </td>

                                <td>
                                    ${fmt(metric.finalized)}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="track">
                        <i
                            class="${good ? 'good' : ''}"
                            style="width:${
                                Math.min(
                                    100,
                                    Math.max(
                                        0,
                                        metric.percent || 0
                                    )
                                )
                            }%"
                        ></i>
                    </div>

                    <!-- INDICADOR COMPACTO -->

                    <div class="tiendas-meta ${estadoTiendas}">
                        Alcanzadas ${tiendas.lograron}/${tiendas.total} tiendas
                    </div>
                </td>
            `;
        }

        if (i % 7 === 6) {
            html += '</tr>';
        }
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    article.insertAdjacentHTML(
        'beforeend',
        html + `
            <div class="totals">
                <span>
                    Meta
                    <b>${fmt(sum.meta)}</b>
                </span>

                <span>
                    Aprobadas
                    <b>${fmt(sum.approved)}</b>
                </span>

                <span>
                    Cumplimiento
                    <b class="${percentClass(stores, sum.percent)}">
                        ${pct(sum.percent)}
                    </b>
                </span>

                <span>
                    Aprobadas finalizadas
                    <b>${fmt(sum.finalized)}</b>
                </span>
            </div>

            <p class="report-note">
                META PISO
                · Aprob. = solo Aprobada
                · AF = Aprobada + Finalizado
                · Meta según configuración guardada
                · CH excluido
            </p>
        `
    );

    return article;
}

/* ==========================================
   RENDERIZAR TABLERO
   ========================================== */

function render() {
    lastGroups = [];

    const from = $('from').value;
    const to = $('to').value;

    if (
        !from ||
        !to ||
        from > to ||
        from < state.data.start ||
        to > state.data.end
    ) {
        $('message').textContent =
            'Selecciona fechas válidas dentro del periodo cargado: ' +
            state.data.start +
            ' al ' +
            state.data.end;

        $('downloadAll').disabled = true;

        $('reports').replaceChildren();
        $('kpis').replaceChildren();

        return;
    }

    let dates;

    try {
        dates = C.days(from, to);
    } catch (e) {
        $('message').textContent = e.message;
        return;
    }

    const stores = selected();

    const weeks = filteredWeeks(stores);

    dates = weeks.flatMap(w => w.dates);

    const sum = total(stores, dates);

    $('downloadAll').disabled =
        !stores.length || !dates.length;

    $('weekSummary').textContent =
        `${weeks.length} semanas · ${dates.length} días seleccionados. ` +
        'Cerradas = lunes a domingo completos dentro del rango y anteriores a hoy (México).';

    $('detailName').textContent = state.detailName;
    $('baseName').textContent = state.baseName;

    $('wmRule').textContent =
        goals.WM.weekday +
        ' / ' +
        goals.WM.weekend;

    $('samsRule').textContent =
        goals.SAMS.weekday +
        ' / ' +
        goals.SAMS.weekend;

    $('kpis').innerHTML = [
        [
            'Meta del periodo',
            fmt(sum.meta),
            stores.length +
                ' tiendas · ' +
                dates.length +
                ' días'
        ],
        [
            'Aprobadas',
            fmt(sum.approved),
            'Sin aprobadas con garantía'
        ],
        [
            'Cumplimiento',
            pct(sum.percent),
            'Aprobadas / meta del periodo'
        ],
        [
            'Aprobadas finalizadas',
            fmt(sum.finalized),
            'Aprobada + proceso Finalizado'
        ]
    ].map(([label, value, note]) => `
        <article class="kpi">
            <span>${label}</span>

            <strong class="${
                label === 'Cumplimiento'
                    ? percentClass(stores, sum.percent)
                    : ''
            }">
                ${value}
            </strong>

            <small>${note}</small>
        </article>
    `).join('');

    const view = $('view').value;

    const groups = new Map();

    for (const store of dates.length ? stores : []) {
        const label =
            view === 'chain'
                ? store.chain
                : view === 'region'
                    ? store.region
                    : view === 'store'
                        ? `${store.chain} ${store.id} · ${store.name}`
                        : 'General · ' +
                          (brand(stores) || 'WM + SAMS');

        if (!groups.has(label)) {
            groups.set(label, []);
        }

        groups.get(label).push(store);
    }

    lastGroups = [...groups]
        .sort((a, b) =>
            a[0].localeCompare(
                b[0],
                'es',
                { numeric: true }
            )
        )
        .map(([label, stores]) => ({
            label,
            stores,
            dates
        }));

    $('reports').replaceChildren(
        ...lastGroups.map((group, i) =>
            report(
                group.label,
                group.stores,
                group.dates,
                i
            )
        )
    );

    if (!dates.length) {
        $('reports').innerHTML =
            '<p class="empty">No hay semanas que cumplan estos filtros. Cambia el rango o el filtro de semanas.</p>';

    } else if (!stores.length) {
        $('reports').innerHTML =
            '<p class="empty">No hay tiendas OPERANDO con estos filtros.</p>';
    }

    const audit = state.data.audit;

    $('audit').innerHTML = `
        <p>
            Detalle: ${esc(state.detailName)}
            <br>
            Base: ${esc(state.baseName)}
        </p>

        <p>
            Filas de entrada: ${fmt(audit.input)}
            · Folio/fecha inválidos: ${fmt(audit.invalid)}
            · Duplicados idénticos: ${fmt(audit.duplicates)}
            · IKEA: ${fmt(audit.ikea)}
            · Fuera de base o sin coincidencia: ${fmt(audit.unmatched)}
            · No OPERANDO: ${fmt(audit.inactive)}
            · CH: ${fmt(audit.other)}
        </p>
    ` + (
        audit.unmatched
            ? `<p>Sin coincidencia: ${
                esc(
                    Object.entries(
                        state.data.unknown || {}
                    ).map(([key, value]) =>
                        key + ' (' + value + ')'
                    ).join(', ')
                )
            }</p>`
            : ''
    );
}

/* ==========================================
   LEER EXCEL Y CSV
   ========================================== */

async function read(file, kind) {
    let wb;

    if (/\.csv$/i.test(file.name)) {
        const bytes = await file.arrayBuffer();

        let text = new TextDecoder('utf-8')
            .decode(bytes);

        if (text.includes('\ufffd')) {
            text = new TextDecoder('windows-1252')
                .decode(bytes);
        }

        wb = XLSX.read(text, {
            type: 'string',
            raw: true
        });

    } else {
        wb = XLSX.read(
            await file.arrayBuffer(),
            {
                type: 'array',
                cellDates: true
            }
        );
    }

    let found = null;

    for (const name of wb.SheetNames) {
        const sheet = wb.Sheets[name];

        if (!sheet['!ref']) continue;

        const range = XLSX.utils.decode_range(
            sheet['!ref']
        );

        const top = XLSX.utils.sheet_to_json(
            sheet,
            {
                header: 1,
                defval: '',
                range: {
                    s: { r: 0, c: 0 },
                    e: {
                        r: Math.min(range.e.r, 29),
                        c: range.e.c
                    }
                }
            }
        );

        const required = kind === 'base'
            ? [
                'SOCIO',
                'NUMERO DE TIENDA/DETERMINANTE',
                'ESTATUS'
            ]
            : [
                'FOLIO FICO',
                'APROBACION',
                'ESTATUS DEL PROCESO'
            ];

        if (!top.some(row =>
            required.every(header =>
                row.map(C.norm).includes(header)
            )
        )) {
            continue;
        }

        let max = 0;

        for (const key of Object.keys(sheet)) {
            if (key[0] === '!') continue;

            const cell = sheet[key];

            if (
                cell.v !== undefined &&
                cell.v !== null &&
                cell.v !== ''
            ) {
                max = Math.max(
                    max,
                    XLSX.utils.decode_cell(key).r
                );
            }
        }

        found = XLSX.utils.sheet_to_json(
            sheet,
            {
                header: 1,
                defval: '',
                range: {
                    s: { r: 0, c: 0 },
                    e: {
                        r: max,
                        c: range.e.c
                    }
                }
            }
        );

        break;
    }

    if (!found) {
        throw Error(
            'No se encontró una hoja compatible. Revisa los encabezados del archivo.'
        );
    }

    return found;
}

/* ==========================================
   CARGAR BASE Y PRODUCTIVIDAD
   ========================================== */

for (const kind of ['base', 'detail']) {
    $(kind + 'File').addEventListener(
        'change',
        async event => {
            const file = event.target.files[0];

            if (!file) return;

            $('message').textContent =
                'Leyendo ' + file.name + '…';

            $('baseFile').disabled = true;
            $('detailFile').disabled = true;

            try {
                await new Promise(resolve =>
                    setTimeout(resolve, 30)
                );

                const rows = await read(
                    file,
                    kind
                );

                if (kind === 'base') {
                    const next = C.stores(rows);

                    if (!raw) {
                        throw Error(
                            'Carga primero tu detalle de productividad para recalcular con una base nueva.'
                        );
                    }

                    const data = C.aggregate(
                        raw,
                        next
                    );

                    state = {
                        ...state,
                        stores: next,
                        data,
                        baseName: file.name
                    };

                } else {
                    const next = C.records(rows);

                    const data = C.aggregate(
                        next,
                        state.stores
                    );

                    raw = next;

                    state = {
                        ...state,
                        data,
                        detailName: file.name
                    };

                    initDates();
                }

                filters();
                render();

                $('message').textContent =
                    'Archivo cargado. ' +
                    (
                        state.data.audit.unmatched
                            ? state.data.audit.unmatched +
                              ' registros sin coincidencia; consulta los criterios al final.'
                            : 'Datos actualizados.'
                    );

                save();

            } catch (error) {
                $('message').textContent =
                    'No se reemplazaron los datos: ' +
                    error.message;

            } finally {
                event.target.value = '';

                $('baseFile').disabled = false;
                $('detailFile').disabled = false;
            }
        }
    );
}

/* ==========================================
   EVENTOS DE FILTROS
   ========================================== */

for (const name of [
    'from',
    'to',
    'chain',
    'region',
    'store',
    'view',
    'weekMode',
    'week'
]) {
    $(name).addEventListener(
        'change',
        () => {
            $('message').textContent = '';

            if ([
                'chain',
                'region',
                'store'
            ].includes(name)) {
                filters(name);
            }

            if ([
                'from',
                'to',
                'weekMode'
            ].includes(name)) {
                $('week').value = '';
            }

            render();
        }
    );
}

$('resetFilters').onclick = () => {
    $('chain').value = '';
    $('region').value = '';
    $('store').value = '';
    $('weekMode').value = 'all';
    $('week').value = '';

    initDates();
    filters();

    $('message').textContent = '';

    render();
};

/* ==========================================
   CONFIGURACIÓN DE METAS
   ========================================== */

function populateGoals() {
    $('wmWeek').value = goals.WM.weekday;
    $('wmEnd').value = goals.WM.weekend;

    $('samsWeek').value = goals.SAMS.weekday;
    $('samsEnd').value = goals.SAMS.weekend;

    options(
        $('overrideStore'),
        active().map(store => [
            store.key,
            `${store.chain} ${store.id} · ${store.name}`
        ]),
        'Sin excepción'
    );

    loadOverride();
}

function loadOverride() {
    const override = overrides[
        $('overrideStore').value
    ];

    $('overrideWeek').value =
        override?.weekday ?? '';

    $('overrideEnd').value =
        override?.weekend ?? '';
}

$('settingsButton').onclick = () => {
    populateGoals();
    $('settings').showModal();
};

$('closeSettings').onclick = () => {
    $('settings').close();
};

$('overrideStore').onchange = loadOverride;

$('goalsForm').onsubmit = event => {
    event.preventDefault();

    const key = $('overrideStore').value;
    const w = $('overrideWeek').value;
    const d = $('overrideEnd').value;

    if (
        key &&
        (w === '' || d === '') &&
        w !== d
    ) {
        $('overrideWeek').setCustomValidity(
            'Captura ambas metas o deja ambas vacías.'
        );

        $('overrideWeek').reportValidity();
        return;
    }

    $('overrideWeek').setCustomValidity('');

    goals = {
        WM: {
            weekday: Number($('wmWeek').value),
            weekend: Number($('wmEnd').value)
        },
        SAMS: {
            weekday: Number($('samsWeek').value),
            weekend: Number($('samsEnd').value)
        }
    };

    if (key) {
        if (w === '') {
            delete overrides[key];
        } else {
            overrides[key] = {
                weekday: Number(w),
                weekend: Number(d)
            };
        }
    }

    $('settings').close();

    $('message').textContent =
        'Metas actualizadas para todo el periodo mostrado.';

    render();
    save();
};

for (const element of [
    $('overrideWeek'),
    $('overrideEnd')
]) {
    element.oninput = () => {
        $('overrideWeek').setCustomValidity('');
    };
}

$('restoreGoals').onclick = () => {
    goals = structuredClone(C.defaults);
    overrides = {};

    populateGoals();
    render();
    save();

    $('message').textContent =
        'Se restauraron las metas WM 2/3 y SAMS 4/5.';
};

/* ==========================================
   EXPORTACIÓN DE IMÁGENES
   ========================================== */

async function download(groups, name) {
    const buttons = [
        ...document.querySelectorAll('button')
    ];

    buttons.forEach(button => {
        button.disabled = true;
    });

    $('message').textContent =
        'Preparando imagen…';

    const wrap = document.createElement('div');

    const chain = brand(
        groups.flatMap(group => group.stores)
    );

    wrap.className =
        'exporting' +
        (chain ? ' theme-' + chain : '');

    wrap.style.position = 'absolute';
    wrap.style.left = '-20000px';

    wrap.innerHTML =
        '<h2>META PISO · ' +
        esc(name) +
        '</h2>';

    for (const group of groups) {
        wrap.append(
            report(
                group.label,
                group.stores,
                group.dates,
                -1
            )
        );
    }

    document.body.append(wrap);

    try {
        await Promise.all(
            [...wrap.querySelectorAll('img')]
                .map(img => img.decode())
        );

        const scale = Math.min(
            2,
            15000 / wrap.scrollHeight
        );

        if (scale < 0.65) {
            throw Error(
                'La vista es demasiado larga. Descarga cada tabla por separado o reduce el periodo.'
            );
        }

        const canvas = await html2canvas(
            wrap,
            {
                backgroundColor: chain
                    ? '#eef5ff'
                    : '#100c18',
                scale,
                logging: false,
                windowWidth: 1500
            }
        );

        const blob = await new Promise(
            (resolve, reject) => {
                canvas.toBlob(
                    result => result
                        ? resolve(result)
                        : reject(
                            Error(
                                'No se pudo generar la imagen.'
                            )
                        ),
                    'image/png'
                );
            }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;

        link.download =
            'META_PISO_' +
            (chain ? chain + '_' : '') +
            name.replace(/[^a-z0-9]/gi, '_') +
            '_' +
            groups[0].dates[0] +
            '_' +
            groups.at(-1).dates.at(-1) +
            '.png';

        link.click();

        setTimeout(
            () => URL.revokeObjectURL(url),
            30000
        );

        $('message').textContent =
            'Imagen descargada.';

    } catch (error) {
        $('message').textContent =
            error.message;

    } finally {
        wrap.remove();

        buttons.forEach(button => {
            button.disabled = false;
        });

        $('downloadAll').disabled =
            !lastGroups.length;
    }
}

/* ==========================================
   BOTONES DE DESCARGA
   ========================================== */

$('reports').onclick = event => {
    const button = event.target.closest(
        '[data-download]'
    );

    if (button) {
        const group = lastGroups[
            Number(button.dataset.download)
        ];

        download(
            [group],
            group.label
        );
    }
};

$('downloadAll').onclick = () => {
    if (lastGroups.length) {
        download(
            [{
                label:
                    'General · ' +
                    (brand(selected()) || 'WM + SAMS') +
                    ' · selección actual',
                stores: selected(),
                dates: lastGroups[0].dates
            }],
            'General'
        );
    }
};

/* ==========================================
   INICIALIZACIÓN
   ========================================== */

initDates();
filters();
render();
