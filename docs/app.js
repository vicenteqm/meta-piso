
'use strict';

const C = MetaPiso;
const $ = id => document.getElementById(id);

const fmt = n => new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: 1
}).format(n);

const pct = n =>
    n === null || n === undefined
        ? '—'
        : fmt(n) + '%';

const esc = s => String(s ?? '').replace(
    /[&<>"']/g,
    c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c])
);

let state = structuredClone(window.META_SEED);
let goals = structuredClone(C.defaults);
let overrides = {};
let lastGroups = [];
let plantillaActiva = null;
let plantillaNombre = '';
function attachRoster(){
    plantillaActiva=state.roster?{...state.roster}:null;
    if(plantillaActiva)Object.defineProperty(plantillaActiva,'employees',{value:state.employees||{},enumerable:false});
    plantillaNombre=state.plantillaName||'Sin fuente incorporada';
}
attachRoster();
try{
    const saved=JSON.parse(localStorage.getItem('meta-piso-goals-v2'));
    if(saved?.goals)goals=saved.goals;
    if(saved?.overrides)overrides=saved.overrides;
}catch(e){}
function save(){
    try{localStorage.setItem('meta-piso-goals-v2',JSON.stringify({goals,overrides}));}
    catch(e){$('message').textContent='Las metas se aplicaron, pero no se pudieron guardar en este navegador.';}
}

function active() {
    return state.stores.filter(s =>
        s.status === 'OPERANDO' &&
        s.chain !== 'CH'
    );
}

function options(node, items, first) {
    const prev = node.value;

    node.replaceChildren(
        new Option(first, '')
    );

    for (const [value, label] of items) {
        node.add(new Option(label, value));
    }

    if (items.some(x => x[0] === prev)) {
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
            list.filter(s =>
                !region || s.region === region
            ).map(s => s.chain)
        )].sort().map(c => [c, c]),
        'WM + SAMS'
    );

    const chain = $('chain').value;

    options(
        $('region'),
        [...new Set(
            list.filter(s =>
                !chain || s.chain === chain
            ).map(s => s.region)
        )].sort((a, b) =>
            a.localeCompare(b, 'es', {
                numeric: true
            })
        ).map(r => [r, r]),
        'Todas las regiones'
    );

    options(
        $('store'),
        list.filter(s =>
            (!chain || s.chain === chain) &&
            (!$('region').value ||
                s.region === $('region').value)
        ).sort((a, b) =>
            a.name.localeCompare(b.name, 'es')
        ).map(s => [
            s.key,
            `${s.chain} ${s.id} · ${s.name}`
        ]),
        'Todas las tiendas'
    );
}

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

    const limit =
        chain === 'WM'
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

function periodLabel(dates) {
    const weeks = new Set(
        dates.map(MetaWeeks.monday)
    );

    return `${dates[0]} al ${dates.at(-1)} · ${dates.length} días seleccionados · ${weeks.size} semanas`;
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

function total(stores, dates) {
    const out = {
        meta: 0,
        approved: 0,
        finalized: 0
    };

    for (const day of dates) {
        const m = C.metric(
            stores,
            state.data,
            day,
            goals,
            overrides
        );

        for (const key of Object.keys(out)) {
            out[key] += m[key];
        }
    }

    out.percent = out.meta
        ? 100 * out.approved / out.meta
        : null;

    return out;
}

/* ==========================================
   TIENDAS ALCANZADAS
   ========================================== */

function tiendasConMeta(stores, day) {
    let lograron = 0;

    for (const store of stores) {
        const m = C.metric(
            [store],
            state.data,
            day,
            goals,
            overrides
        );

        if (
            m.meta > 0 &&
            m.approved >= m.meta
        ) {
            lograron++;
        }
    }

    return {
        lograron,
        total: stores.length
    };
}

/* ==========================================
   TIENDAS SIN INGRESOS
   ========================================== */

function tiendasSinIngresos(stores, day) {
    if (!stores.length) return 0;

    let sinIngresos = 0;

    for (const store of stores) {
        const registro = state.data.counts[
            store.key + '|' + day
        ];

        if (
            registro &&
            typeof registro.ingresos !== 'number'
        ) {
            return null;
        }

        if (
            !registro ||
            registro.ingresos === 0
        ) {
            sinIngresos++;
        }
    }

    return sinIngresos;
}

/* ==========================================
   REPORTE Y CALENDARIO
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
        ...new Set(dates.map(MetaWeeks.monday))
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
                        ].map(d => `
                            <th scope="col">${d}</th>
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
                        <b>${Number(day.slice(-2))}</b>
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
            const m = C.metric(
                stores,
                state.data,
                day,
                goals,
                overrides
            );

            const good =
                m.percent !== null &&
                m.percent >= 100;

            const diagnostico = MetaDiagnostico.clasificar(
                stores, day, state.data, goals, overrides,
                plantillaActiva, C.metric
            );

            const tiendas = tiendasConMeta(stores, day);

            const clasePorcentaje = chain
                ? percentClass(stores, m.percent)
                : good
                    ? 'good'
                    : 'low';

            html += `
                <td>
                    <div class="day-top">
                        <b>
                            ${Number(day.slice(-2))}
                        </b>

                        <span class="aprobacion-dia">
                            Aprobación: ${pct(m.approvalRate ?? null)}
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
                                <td>${fmt(m.meta)}</td>
                                <td>${fmt(m.approved)}</td>

                                <td class="${clasePorcentaje}">
                                    ${pct(m.percent)}
                                </td>

                                <td>${fmt(m.finalized)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="track">
                        <i
                            class="${good ? 'good' : ''}"
                            style="width:${
                                Math.min(
                                    100,
                                    Math.max(0, m.percent || 0)
                                )
                            }%"
                        ></i>
                    </div>

                    ${diagnostico ? `
                    <div class="diagnostico-tiendas">
                        <div class="diag-item sin-cobertura"><span>Sin cobertura</span><b>${diagnostico.sinCobertura}</b></div>
                        <div class="diag-item sin-ingresos"><span>Cubiertas sin ingresos</span><b>${diagnostico.cubiertasSinIngresos}</b></div>
                        <div class="diag-item bajo-meta"><span>Ingresos bajo meta</span><b>${diagnostico.bajoMeta}</b></div>
                        <div class="diag-item alcanzada"><span>Meta alcanzada</span><b>${diagnostico.alcanzada}</b></div>
                    </div>
                    ${diagnostico.alertas ? `<small class="diag-alerta">${diagnostico.alertas} con ingresos sin personal activo identificado</small>` : ''}
                    ` : '<div class="diag-pendiente">Plantilla del mes no disponible</div>'}
                    <div class="tiendas-meta" title="Tiendas cuyas aprobadas cumplen o superan su meta diaria positiva, entre las tiendas OPERANDO seleccionadas.">
                        <span class="tiendas-meta-texto">Alcanzadas ${tiendas.lograron}/${tiendas.total} tiendas</span>
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
                    Meta <b>${fmt(sum.meta)}</b>
                </span>

                <span>
                    Aprobadas <b>${fmt(sum.approved)}</b>
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
   RENDERIZAR
   ========================================== */

function render() {
    MetaCobertura.render([], [], state.data, plantillaActiva, plantillaNombre);
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

    MetaCobertura.render(stores, dates, state.data, plantillaActiva, plantillaNombre);

    $('downloadAll').disabled =
        !stores.length || !dates.length;

    $('weekSummary').textContent =
        `${weeks.length} semanas · ${dates.length} días seleccionados. ` +
        'Cerradas = lunes a domingo completos dentro del rango y anteriores a hoy (México).';

    MetaFuentes.render(state);

    $('wmRule').textContent =
        goals.WM.weekday + ' / ' + goals.WM.weekend;

    $('samsRule').textContent =
        goals.SAMS.weekday + ' / ' + goals.SAMS.weekend;

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

    for (const s of dates.length ? stores : []) {
        const label =
            view === 'chain'
                ? s.chain
                : view === 'region'
                    ? s.region
                    : view === 'store'
                        ? `${s.chain} ${s.id} · ${s.name}`
                        : 'General · ' +
                          (brand(stores) || 'WM + SAMS');

        if (!groups.has(label)) {
            groups.set(label, []);
        }

        groups.get(label).push(s);
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
        ...lastGroups.map((g, i) =>
            report(
                g.label,
                g.stores,
                g.dates,
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

    const a = state.data.audit;

    $('audit').innerHTML = `
        <p>
            Detalle: ${esc(state.detailName)}
            <br>
            Base: ${esc(state.baseName)}
        </p>

        <p>${esc(state.auditNote||'')}</p><p>
            Filas de entrada: ${fmt(a.input)}
            · Folio/fecha inválidos: ${fmt(a.invalid)}
            · Duplicados idénticos: ${fmt(a.duplicates)}
            · IKEA: ${fmt(a.ikea)}
            · Fuera de base o sin coincidencia: ${fmt(a.unmatched)}
            · No OPERANDO: ${fmt(a.inactive)}
            · CH: ${fmt(a.other)}
        </p>
    ` + (
        a.unmatched
            ? `<p>Sin coincidencia: ${
                esc(
                    Object.entries(
                        state.data.unknown || {}
                    ).map(([k, v]) =>
                        k + ' (' + v + ')'
                    ).join(', ')
                )
            }</p>`
            : ''
    );
}

/* ==========================================
   LEER EXCEL Y CSV
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
        active().map(s => [
            s.key,
            `${s.chain} ${s.id} · ${s.name}`
        ]),
        'Sin excepción'
    );

    loadOverride();
}

function loadOverride() {
    const o = overrides[
        $('overrideStore').value
    ];

    $('overrideWeek').value =
        o?.weekday ?? '';

    $('overrideEnd').value =
        o?.weekend ?? '';
}

$('settingsButton').onclick = () => {
    populateGoals();
    $('settings').showModal();
};

$('closeSettings').onclick = () => {
    $('settings').close();
};

$('overrideStore').onchange = loadOverride;

$('goalsForm').onsubmit = e => {
    e.preventDefault();

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

for (const el of [
    $('overrideWeek'),
    $('overrideEnd')
]) {
    el.oninput = () => {
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
   EXPORTAR IMÁGENES
   ========================================== */

async function download(groups, name) {
    const buttons = [
        ...document.querySelectorAll('button')
    ];

    buttons.forEach(b => b.disabled = true);

    $('message').textContent =
        'Preparando imagen…';

    const wrap = document.createElement('div');

    const chain = brand(
        groups.flatMap(g => g.stores)
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

    for (const g of groups) {
        wrap.append(
            report(
                g.label,
                g.stores,
                g.dates,
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
                    b => b
                        ? resolve(b)
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

        const a = document.createElement('a');

        a.href = url;

        a.download =
            'META_PISO_' +
            (chain ? chain + '_' : '') +
            name.replace(/[^a-z0-9]/gi, '_') +
            '_' +
            groups[0].dates[0] +
            '_' +
            groups.at(-1).dates.at(-1) +
            '.png';

        a.click();

        setTimeout(
            () => URL.revokeObjectURL(url),
            30000
        );

        $('message').textContent =
            'Imagen descargada.';

    } catch (e) {
        $('message').textContent = e.message;

    } finally {
        wrap.remove();

        buttons.forEach(
            b => b.disabled = false
        );

        $('downloadAll').disabled =
            !lastGroups.length;
    }
}

/* ==========================================
   BOTONES DE DESCARGA
   ========================================== */

$('reports').onclick = e => {
    const b = e.target.closest(
        '[data-download]'
    );

    if (b) {
        const g = lastGroups[
            Number(b.dataset.download)
        ];

        download(
            [g],
            g.label
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
   INICIAR
   ========================================== */

initDates();
filters();
render();


MetaFuentes.init(async month=>{
    try{
        $('message').textContent='Abriendo '+month+'…';
        const next=await MetaFuentes.load(month);
        state=structuredClone(next);attachRoster();
        $('chain').value='';$('region').value='';$('store').value='';$('week').value='';
        initDates();filters();render();$('message').textContent='Mes actualizado: '+month;
    }catch(e){$('monthSource').value=state.month;$('message').textContent='No se cambió el mes: '+e.message;}
});
