"use strict";
const $ = (id) => document.getElementById(id),
  fmt = (n) => new Intl.NumberFormat("es-MX").format(n),
  pct = (n) =>
    new Intl.NumberFormat("es-MX", {
      style: "percent",
      maximumFractionDigits: 1,
    }).format(n);
const names = {
  sinba_ce: "Consulta externa",
  sinba_pf: "Planificación familiar",
  sinba_sm: "Salud mental",
  sinba_sb: "Salud bucal",
  sinba_proc: "Procedimientos quirúrgicos",
  sinba_proc_q: "Procedimientos dentro de quirófano",
  sinba_egr: "Egresos",
  eds_moce: "MoCE",
  eds_cir: "Cirugías",
  eds_hosp: "Hospitalizaciones",
};
let data,
  quality,
  chart,
  details,
  auditDetails,
  monthlyDetails,
  mapChart,
  barChart,
  mapReady = false,
  unitNames = {};
const smallCharts = [];
const HRAES = new Set([
  "CSIMB003506",
  "CSIMB003511",
  "OCIMB006826",
  "GTIMB000015",
  "MCIMB012295",
  "TSIMB002865",
  "YNIMB000012",
]);
const inGroup = (c) =>
  $("group").value === "hraes" ? HRAES.has(c) : !HRAES.has(c);
const HIDDEN = new Set(["ce_2025", "ce_2026"]);
const INTEGRAL = ["sinba_ce", "sinba_pf", "sinba_sm", "sinba_sb"];
const ENTITY_NAMES = {
  AG: "Aguascalientes",
  BC: "Baja California",
  BS: "Baja California Sur",
  CC: "Campeche",
  CS: "Chiapas",
  CH: "Chihuahua",
  CL: "Coahuila",
  CM: "Colima",
  DF: "Ciudad de México",
  DG: "Durango",
  GT: "Guanajuato",
  GR: "Guerrero",
  HG: "Hidalgo",
  JC: "Jalisco",
  MC: "México",
  MN: "Michoacán",
  MS: "Morelos",
  NT: "Nayarit",
  NL: "Nuevo León",
  OC: "Oaxaca",
  PL: "Puebla",
  QT: "Querétaro",
  QR: "Quintana Roo",
  SP: "San Luis Potosí",
  SL: "Sinaloa",
  SR: "Sonora",
  TC: "Tabasco",
  TS: "Tamaulipas",
  TL: "Tlaxcala",
  VZ: "Veracruz",
  YN: "Yucatán",
  ZS: "Zacatecas",
};
function matchingClues(area) {
  const all = Object.keys(details.areas[area] || {});
  const entity = $("entity").value,
    clue = $("clues").value;
  return all.filter(
    (c) =>
      (entity === "ALL" || c.startsWith(entity)) &&
      (clue === "ALL" || c === clue) &&
      inGroup(c)
  );
}
function filteredScenario(s) {
  const clues = matchingClues(s.area),
    area = details.areas[s.area] || {};
  const series = s.series.map((r) => {
    let sinba = 0,
      eds = 0;
    for (const c of clues) {
      const sources = area[c] || {};
      for (const k of s.sinba_sources)
        sinba += (sources[k] || {})[`${s.sinba_year}-${r.week}`] || 0;
      eds += (sources[s.eds_source] || {})[`2026-${r.week}`] || 0;
    }
    return { week: r.week, sinba, eds };
  });
  if (s.id === "integral_triple") {
    for (const r of series) {
      r.sinba2026 = 0;
      for (const c of clues) {
        const src = area[c] || {};
        for (const k of s.sinba_sources)
          r.sinba2026 += (src[k] || {})[`2026-${r.week}`] || 0;
      }
    }
  }
  return { ...s, series, clues_compartidas: clues.length };
}
// Las opciones provienen del universo común. Si es vacío, se muestran las CLUES
// disponibles de ambas fuentes para diagnosticar por qué no hay coincidencias;
// nunca se incorporan esas unidades a los conteos comparables.
function availableClues(area) {
  const shared = Object.keys(details.areas[area] || {}).filter(inGroup);
  const diag = quality?.catalogos_clues?.[area];
  if (shared.length || !diag) return { values: shared, diagnostic: false };
  return {
    values: [...new Set([...(diag.sinba || []), ...(diag.eds || [])])]
      .filter(inGroup)
      .sort(),
    diagnostic: true,
  };
}
function updateEntities() {
  const area = $("area").value,
    previous = $("entity").value;
  const { values } = availableClues(area);
  const prefixes = [...new Set(values.map((c) => c.slice(0, 2)))].sort();
  $("entity").replaceChildren(
    new Option("todas las entidades", "ALL"),
    ...prefixes.map(
      (x) => new Option((ENTITY_NAMES[x] || x) + " (" + x + ")", x)
    )
  );
  $("entity").value = prefixes.includes(previous) ? previous : "ALL";
  updateClues();
}
function updateClues() {
  const area = $("area").value,
    previous = $("clues").value,
    entity = $("entity").value;
  const { values, diagnostic } = availableClues(area);
  const clues = values
    .filter((c) => entity === "ALL" || c.startsWith(entity))
    .sort();
  $("clues").replaceChildren(
    new Option(
      (diagnostic
        ? "CLUES disponibles (sin coincidencias)"
        : "todas las CLUES") +
        " (" +
        clues.length +
        ")",
      "ALL"
    ),
    ...clues.map(
      (c) => new Option(unitNames[c] ? `${c} — ${unitNames[c]}` : c, c)
    )
  );
  $("clues").value = clues.includes(previous) ? previous : "ALL";
  render();
}

function scenarioName(s) {
  if (s.id === "integral_triple")
    return `SINBA 2025 vs SINBA 2026 vs EDS ${
      names[s.eds_source]
    } 2026 (${s.sinba_sources.map((k) => names[k]).join(" + ")})`;
  const left = s.sinba_sources.map((x) => names[x]).join(" + ");
  return `SINBA ${s.sinba_year}: ${left} vs EDS 2026: ${names[s.eds_source]}`;
}
function visibleScenarios(area) {
  return data.escenarios.filter(
    (s) => s.area === area && !HIDDEN.has(s.id) && s.id !== "integral_triple"
  );
}
function mainScenario(area) {
  const base =
    visibleScenarios(area).find(
      (s) =>
        s.sinba_year === 2025 &&
        s.sinba_sources.length ===
          Math.max(...visibleScenarios(area).map((x) => x.sinba_sources.length))
    ) || visibleScenarios(area)[0];
  return base
    ? { ...base, id: "integral_triple", sinba_sources: [...base.sinba_sources] }
    : null;
}
function selected() {
  return mainScenario($("area").value);
}
function seriesFor(s, rows, isCumulative) {
  let a = 0,
    b = 0,
    c = 0;
  const triple = s.id === "integral_triple";
  return triple
    ? [
        {
          name: "SINBA 2025",
          data: rows.map((r) => (isCumulative ? (a += r.sinba) : r.sinba)),
          color: "#9F2241",
        },
        {
          name: "SINBA 2026",
          data: rows.map((r) =>
            isCumulative ? (c += r.sinba2026 || 0) : r.sinba2026 || 0
          ),
          color: "#A57F2C",
        },
        {
          name: `EDS ${names[s.eds_source]} 2026`,
          data: rows.map((r) => (isCumulative ? (b += r.eds) : r.eds)),
          color: "#006657",
        },
      ]
    : [
        {
          name: `SINBA ${s.sinba_year}`,
          data: rows.map((r) => (isCumulative ? (a += r.sinba) : r.sinba)),
          color: s.sinba_year === 2025 ? "#9F2241" : "#A57F2C",
        },
        {
          name: `EDS ${names[s.eds_source]} 2026`,
          data: rows.map((r) => (isCumulative ? (b += r.eds) : r.eds)),
          color: "#006657",
        },
      ];
}
function graphOption(s, rows, isCumulative, compact = false) {
  const monthly = $("view").value === "monthly",
    series = seriesFor(s, rows, isCumulative);
  return {
    animation: true,
    animationDuration: 1300,
    animationDurationUpdate: 600,
    animationEasing: "cubicOut",
    color: series.map((x) => x.color),
    tooltip: {
      trigger: "axis",
      formatter: (params) =>
        `<strong>${params[0]?.axisValueLabel || ""}</strong><br>` +
        params
          .map(
            (x) =>
              `${x.marker} ${x.seriesName}: <strong>${fmt(
                x.value ?? 0
              )}</strong>`
          )
          .join("<br>"),
    },
    legend: {
      top: 4,
      type: "scroll",
      textStyle: { fontSize: compact ? 10 : 12, color: "#264c42" },
    },
    grid: {
      top: compact ? 76 : 75,
      left: compact ? 48 : 75,
      right: compact ? 24 : 95,
      bottom: compact ? 43 : 55,
      containLabel: true,
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: rows.map((r) =>
        monthly
          ? [
              "Ene",
              "Feb",
              "Mar",
              "Abr",
              "May",
              "Jun",
              "Jul",
              "Ago",
              "Sep",
              "Oct",
              "Nov",
              "Dic",
            ][r.month - 1]
          : `S${String(r.week).padStart(2, "0")}`
      ),
      axisLabel: {
        fontSize: compact ? 10 : 12,
        interval: compact ? "auto" : 0,
      },
    },
    yAxis: {
      type: "value",
      min: 0,
      name: compact ? "" : "Registros",
      axisLabel: {
        formatter: (v) =>
          v >= 1000000
            ? (v / 1000000).toFixed(1) + "M"
            : v >= 1000
            ? Math.round(v / 1000) + "k"
            : v,
      },
    },
    series: series.map((x) => ({
      name: x.name,
      type: "line",
      data: x.data,
      itemStyle: { color: x.color },
      lineStyle: { color: x.color, width: compact ? 2.2 : 3 },
      showSymbol: false,
      emphasis: { focus: "series" },
      ...(compact
        ? {}
        : {
            endLabel: {
              show: true,
              formatter: ({ seriesName }) => seriesName,
              color: x.color,
              fontSize: 10,
            },
            labelLayout: { moveOverlap: "shiftY" },
          }),
    })),
  };
}
function renderMatrix(cut) {
  smallCharts.splice(0).forEach((c) => c.dispose());
  const host = $("scenarioMatrix");
  host.replaceChildren();
  for (const original of visibleScenarios($("area").value)) {
    const s = filteredScenario(original),
      card = document.createElement("article");
    card.className = "scenario-card";
    const head = document.createElement("div");
    head.className = "scenario-card-head";
    const title = document.createElement("h3");
    title.textContent = `SINBA ${s.sinba_year} vs ${names[s.eds_source]} 2026`;
    const subtitle = document.createElement("p");
    subtitle.textContent = `SINBA: ${s.sinba_sources
      .map((k) => names[k])
      .join(" + ")} · ${fmt(s.clues_compartidas)} CLUES`;
    head.append(title, subtitle);
    const plot = document.createElement("div");
    plot.className = "small-chart";
    const note = document.createElement("p");
    note.className = "scenario-note";
    note.textContent =
      s.sinba_year === 2025
        ? "Referencia histórica: comparación de volúmenes entre años, no participación de EDS."
        : "Comparación 2026: permite evaluar la distribución del volumen registrado entre sistemas.";
    card.append(head, plot, note);
    host.append(card);
    const rows =
      $("view").value === "monthly"
        ? monthlyRows(s, cut)
        : s.series.filter((r) => r.week <= cut);
    const instance = echarts.init(plot);
    instance.setOption(
      graphOption(s, rows, $("view").value === "cumulative", true)
    );
    smallCharts.push(instance);
  }
}
function monthlyRows(s, cut) {
  // La semana ISO 1 de 2026 inicia el 29 de diciembre de 2025.
  const jan4 = new Date(Date.UTC(2026, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(
    jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (cut - 1) * 7
  );
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const maxMonth = sunday.getUTCMonth() + 1;
  const cohort = matchingClues(s.area),
    area = monthlyDetails?.areas?.[s.area] || {};
  return Array.from({ length: maxMonth }, (_, i) => {
    const m = String(i + 1).padStart(2, "0");
    let sinba = 0,
      eds = 0,
      sinba2026 = 0;
    for (const c of cohort) {
      const sources = area[c] || {};
      for (const k of s.sinba_sources)
        sinba += (sources[k] || {})[`${s.sinba_year}-${m}`] || 0;
      for (const k of s.sinba_sources)
        if (s.id === "integral_triple")
          sinba2026 += (sources[k] || {})[`2026-${m}`] || 0;
      eds += (sources[s.eds_source] || {})[`2026-${m}`] || 0;
    }
    return { week: i + 1, month: i + 1, sinba, eds, sinba2026 };
  });
}
function render() {
  const original = selected();
  const s = original ? filteredScenario(original) : null;
  if (!s) return;
  const cut = Number($("week").value),
    monthly = $("view").value === "monthly",
    rows = monthly
      ? monthlyRows(s, cut)
      : s.series.filter((r) => r.week <= cut),
    isCumulative = $("view").value === "cumulative";
  let a = 0,
    b = 0;
  const left = [],
    right = [];
  for (const r of rows) {
    a += r.sinba;
    b += r.eds;
    left.push(isCumulative ? a : r.sinba);
    right.push(isCumulative ? b : r.eds);
  }
  const sameYear = s.sinba_year === 2026;
  const sameYearSinba =
    s.id === "integral_triple"
      ? rows.reduce((v, r) => v + (r.sinba2026 || 0), 0)
      : a;
  $("cohort").textContent = fmt(
    matchingClues(s.area).filter((c) => {
      const z = details.areas[s.area]?.[c]?.[s.eds_source] || {};
      return s.series.some(
        (r) => r.week <= cut && (z[`2026-${r.week}`] || 0) > 0
      );
    }).length
  );
  const yearTotal = (year) => {
    const sourceSet = s.sinba_sources;
    let total = 0;
    for (const c of matchingClues(s.area)) {
      const src = (details.areas[s.area] || {})[c] || {};
      for (const k of sourceSet) {
        for (const r of s.series.filter((r) => r.week <= cut))
          total += (src[k] || {})[`${year}-${r.week}`] || 0;
      }
    }
    return total;
  };
  $("sinba2025").textContent = fmt(yearTotal(2025));
  $("sinba2026").textContent = fmt(yearTotal(2026));
  const edsCorte = s.series
    .filter((r) => r.week <= cut)
    .reduce((v, r) => v + r.eds, 0);
  $("eds").textContent = fmt(edsCorte);
  $("shareTitle").textContent = "Relación EDS 2026 / SINBA 2025";
  $("shareExplanation").textContent = "Volumen de EDS respecto al año previo";
  $("share").textContent = yearTotal(2025)
    ? pct(edsCorte / yearTotal(2025))
    : "No calculable";
  $("emptyNotice").hidden = s.clues_compartidas !== 0;
  const warning = $("cohortWarning");
  const diag = quality?.catalogos_clues?.[s.area];
  warning.hidden = s.clues_compartidas !== 0;
  if (!warning.hidden)
    warning.textContent = `No existen CLUES coincidentes para ${
      s.area
    } con el criterio actual (actividad SINBA y EDS en 2026). CLUES con actividad: SINBA ${fmt(
      diag?.sinba?.length || 0
    )}, EDS ${fmt(
      diag?.eds?.length || 0
    )}. Los filtros pueden mostrar unidades disponibles para diagnóstico, pero sus registros NO se contabilizan hasta confirmar la coincidencia. Revisa nombres de CLUES, fechas y cobertura.`;
  $("filterNotice").textContent = `Grupo: ${
    $("group").value === "hraes" ? "HRAES" : "Unidades generales"
  } · Unidades comparables identificadas en ambos sistemas: ${fmt(
    s.clues_compartidas
  )} CLUES · ${$("entity").selectedOptions[0].text} · ${
    $("clues").value === "ALL" ? "todas las CLUES" : $("clues").value
  }. Los indicadores y reportes usan este filtro.`;
  $("chartTitle").textContent =
    (monthly
      ? "Evolución mensual"
      : isCumulative
      ? "Evolución acumulada"
      : "Evolución semanal") + " · comparación integral";
  $("chartSubtitle").textContent = `Semanas ISO 1–${cut} · ${scenarioName(
    s
  )} · ${
    monthly
      ? "volumen mensual (mes final no necesariamente comparable: revisar cobertura)"
      : isCumulative
      ? "acumulado"
      : "volumen semanal"
  }`;
  const triple = s.id === "integral_triple";
  const third = [];
  if (triple) {
    let running = 0;
    for (const r of rows) {
      running += r.sinba2026;
      third.push(isCumulative ? running : r.sinba2026);
    }
  }
  const edsLabel = `EDS ${names[s.eds_source]} 2026`;
  const chartSeries = triple
    ? [
        { name: "SINBA 2025", data: left, color: "#9F2241" },
        { name: "SINBA 2026", data: third, color: "#A57F2C" },
        { name: edsLabel, data: right, color: "#006657" },
      ]
    : [
        {
          name: `SINBA ${s.sinba_year}`,
          data: left,
          color: s.sinba_year === 2025 ? "#9F2241" : "#A57F2C",
        },
        { name: edsLabel, data: right, color: "#006657" },
      ];
  chart.setOption(graphOption(s, rows, isCumulative), true);
  renderTerritory(s, cut);
  const historical = yearTotal(2025);
  const ratio = historical ? (100 * edsCorte) / historical : null;
  const edsModule = names[s.eds_source];
  $("executiveReading").textContent =
    ratio === null
      ? `En el periodo seleccionado no existe un volumen de referencia SINBA 2025 válido para calcular la relación de ${edsModule} 2026. Los conteos corresponden a registros (filas), sin deduplicación de eventos.`
      : `En el periodo seleccionado, los registros generados en ${edsModule} durante 2026 representan el ${ratio.toFixed(
          1
        )}% de los registros reportados en SINBA en el mismo periodo de 2025. Este indicador permite dimensionar el avance del registro en ${edsModule} respecto al volumen observado el año previo. No representa el porcentaje de unidades que utilizan el sistema ni la proporción de registros migrados desde SINBA. Los conteos corresponden a registros (filas), sin deduplicación de eventos.`;

  renderAudit();
}
function rebuild() {
  updateEntities();
}
function download() {
  const s = filteredScenario(selected()),
    cut = Number($("week").value);
  const triple = s.id === "integral_triple";
  const lines = [
    triple
      ? "semana_iso,sinba_2025,sinba_2026,eds_2026"
      : "semana_iso,sinba_" + s.sinba_year + ",eds_2026",
    ...s.series
      .filter((r) => r.week <= cut)
      .map((r) =>
        triple
          ? `${r.week},${r.sinba},${r.sinba2026},${r.eds}`
          : `${r.week},${r.sinba},${r.eds}`
      ),
  ];
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `adopcion_${s.id}_semana_${cut}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
async function init() {
  try {
    if (!window.echarts)
      throw new Error(
        "No se pudo cargar ECharts. Comprueba la conexión a internet."
      );
    const [r, q, d, ad, md] = await Promise.all([
      fetch("data/series_semanales.json"),
      fetch("data/resumen_calidad.json"),
      fetch("data/detalle_clues.json"),
      fetch("data/auditoria_clues.json"),
      fetch("data/detalle_mensual.json"),
    ]);
    if (!r.ok || !q.ok || !d.ok || !ad.ok || !md.ok)
      throw new Error(
        "Faltan los JSON: ejecuta el procesador antes de publicar."
      );
    data = await r.json();
    quality = await q.json();
    details = await d.json();
    auditDetails = await ad.json();
    monthlyDetails = await md.json();

    chart = echarts.init($("chart"));
    window.addEventListener("resize", () => {
      chart.resize();
      mapChart?.resize();
      barChart?.resize();
    });
    barChart = echarts.init($("entityBars"));
    mapChart = echarts.init($("mexicoMap"));
    loadMexicoMap();
    const last = data.metadata.ultima_semana_iso;
    try {
      const nr = await fetch("config/unidades_catalogo.csv");
      if (nr.ok) {
        const lines = (await nr.text())
          .replace(/^\uFEFF/, "")
          .split(/\r?\n/)
          .filter(Boolean);
        const sep = lines[0]?.includes(";") ? ";" : ",";
        for (const line of lines.slice(1)) {
          const [c, ...rest] = line.split(sep);
          if (c && rest.length)
            unitNames[c.trim().toUpperCase()] = rest.join(sep).trim();
        }
      }
    } catch (e) {
      console.warn("Catálogo opcional no disponible", e);
    }
    $("week").replaceChildren(
      ...Array.from(
        { length: last },
        (_, i) => new Option("Semana " + (i + 1), String(i + 1))
      )
    );
    $("week").value = String(last);
    $("group").addEventListener("change", () => {
      $("entity").value = "ALL";
      $("clues").value = "ALL";
      updateEntities();
    });
    for (const id of ["area", "view", "week"])
      $(id).addEventListener("change", id === "area" ? rebuild : render);
    $("entity").addEventListener("change", updateClues);
    $("clues").addEventListener("change", render);
    $("csv").addEventListener("click", download);
    $("barSort").addEventListener("change", render);
    $("resetFilters").addEventListener("click", () => {
      $("group").value = "general";
      $("area").value = "Consulta externa";
      rebuild();
      $("entity").value = "ALL";
      updateClues();
      $("clues").value = "ALL";
      $("view").value = "weekly";
      $("week").value = String(last);
      render();
    });
    rebuild();
    if (window.setupReports) window.setupReports();
    $("updatedAt").textContent = data.metadata.fecha_proceso;
    $(
      "status"
    ).textContent = `Procesado: ${data.metadata.fecha_proceso} · Última semana completa: ${data.metadata.ultima_semana_completa} · ${data.metadata.metodo_cruce}`;
  } catch (e) {
    $("status").textContent = "Error: " + e.message;
    console.error(e);
  }
}
document.addEventListener("DOMContentLoaded", init);

window.dashboardState = () => ({
  data,
  quality,
  territory: territoryValues(selected(), Number($("week").value)),
  selected: filteredScenario(selected()),
  filteredScenarios: [selected(), ...visibleScenarios($("area").value)]
    .filter(Boolean)
    .map(filteredScenario),
  selectedClues: matchingClues($("area").value),
  group: $("group").value,
  cut: Number($("week").value),
  view: $("view").value,
});

function renderAudit() {
  if (!auditDetails || !details) return;
  const areaName = $("area").value,
    cohort = matchingClues(areaName),
    area = auditDetails.areas[areaName] || {};
  const relevant =
    areaName === "Consulta externa"
      ? [...INTEGRAL, "eds_moce"]
      : areaName === "Cirugías"
      ? ["sinba_proc", "sinba_proc_q", "eds_cir"]
      : ["sinba_egr", "eds_hosp"];
  const tb = $("quality");
  tb.replaceChildren();
  for (const key of relevant) {
    const vals = {
      total: 0,
      clues_faltante: 0,
      fecha_invalida: 0,
      fuera_periodo: 0,
      excluidas_cruce: 0,
    };
    for (const c of cohort) {
      const x = area[c]?.[key];
      if (!x) continue;
      for (const k of Object.keys(vals)) vals[k] += x[k] || 0;
    }
    const tr = document.createElement("tr");
    for (const value of [
      names[key] || key,
      vals.total,
      vals.clues_faltante,
      vals.fecha_invalida,
      vals.fuera_periodo,
      vals.excluidas_cruce,
    ]) {
      const td = document.createElement("td");
      td.textContent = typeof value === "number" ? fmt(value) : value;
      tr.appendChild(td);
    }
    tb.appendChild(tr);
  }
  $("auditContext").textContent = `Registros atribuibles a ${
    cohort.length
  } CLUES compartidas seleccionadas del grupo ${
    $("group").value === "hraes" ? "HRAES" : "general"
  }; ${
    $("entity").selectedOptions[0]?.text || "todas las entidades"
  }. Las filas sin CLUES no pueden asignarse a una entidad y se documentan en el resumen global.`;
}

window.dashboardExportRows = (s, cut) => {
  const v = $("view").value;
  if (v === "monthly") return monthlyRows(s, cut);
  if (v === "cumulative") {
    let a = 0,
      b = 0,
      c = 0;
    return s.series
      .filter((r) => r.week <= cut)
      .map((r) => ({
        week: r.week,
        sinba: (a += r.sinba),
        eds: (b += r.eds),
        sinba2026: (c += r.sinba2026 || 0),
      }));
  }
  return s.series.filter((r) => r.week <= cut);
};

// El mapa utiliza GeoJSON estatal; se conserva un estado informativo si la red no permite obtenerlo.
const MAP_NAMES = {
  Aguascalientes: "AG",
  "Baja California": "BC",
  "Baja California Sur": "BS",
  Campeche: "CC",
  Chiapas: "CS",
  Chihuahua: "CH",
  Coahuila: "CL",
  "Coahuila de Zaragoza": "CL",
  Colima: "CM",
  "Ciudad de México": "DF",
  "Distrito Federal": "DF",
  Durango: "DG",
  Guanajuato: "GT",
  Guerrero: "GR",
  Hidalgo: "HG",
  Jalisco: "JC",
  México: "MC",
  "Estado de México": "MC",
  Michoacán: "MN",
  "Michoacán de Ocampo": "MN",
  Morelos: "MS",
  Nayarit: "NT",
  "Nuevo León": "NL",
  Oaxaca: "OC",
  Puebla: "PL",
  Querétaro: "QT",
  "Quintana Roo": "QR",
  "San Luis Potosí": "SP",
  Sinaloa: "SL",
  Sonora: "SR",
  Tabasco: "TC",
  Tamaulipas: "TS",
  Tlaxcala: "TL",
  Veracruz: "VZ",
  "Veracruz de Ignacio de la Llave": "VZ",
  Yucatán: "YN",
  Zacatecas: "ZS",
};
function geoCode(n) {
  return (
    MAP_NAMES[n] ||
    Object.keys(ENTITY_NAMES).find((k) => ENTITY_NAMES[k] === n) ||
    null
  );
}
async function loadMexicoMap() {
  const sources = [
    "assets/mexico_estados.geojson",
    "https://raw.githubusercontent.com/angelnmara/geojson/master/mexicoHigh.json",
  ];
  for (const url of sources) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const geo = await r.json();
      if (geo.type !== "FeatureCollection" || !Array.isArray(geo.features))
        continue;
      for (const f of geo.features) {
        const props = f.properties || {};
        const name =
          props.name ||
          props.NOMGEO ||
          props.nom_ent ||
          props.NOM_ENT ||
          props.estado ||
          props.NAME_1 ||
          props.state_name;
        f.properties.name = name || "Entidad sin identificar";
      }
      echarts.registerMap("mexico_eds", geo);
      mapReady = true;
      $("mapStatus").textContent =
        "Seleccione una entidad en el mapa para filtrar los resultados. El 100% indica igualdad de volúmenes, no adopción completa.";
      mapChart.on("click", (p) => {
        const c = geoCode(p.name);
        if (c) {
          $("entity").value = c;
          updateClues();
        }
      });
      render();
      return;
    } catch (e) {
      console.warn("No se pudo cargar geometría", url, e);
    }
  }
  $("mapStatus").textContent =
    "Mapa no disponible: coloque el GeoJSON de las 32 entidades en assets/mexico_estados.geojson (ver README). El gráfico de barras continúa funcionando.";
}
function territoryValues(s, cut) {
  const area = details.areas[s.area] || {},
    entity = $("entity").value,
    clue = $("clues").value,
    weekIds = s.series.filter((r) => r.week <= cut).map((r) => r.week);
  const out = {};
  for (const c of Object.keys(area)) {
    if (
      !inGroup(c) ||
      (entity !== "ALL" && !c.startsWith(entity)) ||
      (clue !== "ALL" && clue !== c)
    )
      continue;
    const prefix = c.slice(0, 2),
      o =
        out[prefix] ||
        (out[prefix] = {
          code: prefix,
          name: ENTITY_NAMES[prefix] || prefix,
          s25: 0,
          s26: 0,
          eds: 0,
          clues: 0,
          withEds: 0,
        });
    o.clues++;
    const src = area[c],
      e = src[s.eds_source] || {};
    let ec = 0;
    for (const w of weekIds) {
      for (const k of s.sinba_sources) {
        o.s25 += (src[k] || {})[`2025-${w}`] || 0;
        o.s26 += (src[k] || {})[`2026-${w}`] || 0;
      }
      ec += e[`2026-${w}`] || 0;
    }
    o.eds += ec;
    if (ec > 0) o.withEds++;
  }
  return Object.values(out).map((o) => ({
    ...o,
    p25: o.s25 ? (100 * o.eds) / o.s25 : null,
    p26: o.s26 ? (100 * o.eds) / o.s26 : null,
  }));
}

function renderTerritory(s, cut) {
  if (!barChart) return;

  const values = territoryValues(s, cut);
  const sort = $("barSort").value;

  values.sort((a, b) =>
    sort === "alpha"
      ? a.name.localeCompare(b.name, "es")
      : sort === "desc"
      ? (b.p25 ?? -1) - (a.p25 ?? -1)
      : (a.p25 ?? Infinity) - (b.p25 ?? Infinity)
  );

  const tooltip = (o) =>
    `${o.name}<br>CLUES comparables: ${fmt(o.clues)}
    <br>CLUES con EDS: ${fmt(o.withEds)}
    <br>SINBA 2025: ${fmt(o.s25)}
    <br>SINBA 2026: ${fmt(o.s26)}
    <br>EDS 2026: ${fmt(o.eds)}
    <br>EDS / SINBA 2025: ${
      o.p25 === null ? "No calculable" : o.p25.toFixed(1) + "%"
    }
    <br>EDS / SINBA 2026: ${
      o.p26 === null ? "No calculable" : o.p26.toFixed(1) + "%"
    }`;

  // Escala absoluta compartida.
  const maxValue = Math.max(1, ...values.flatMap((v) => [v.s25, v.s26, v.eds]));

  // // Configuración visual.
  // const columnWidth = 28;
  // const visibleCount = 7;
  // Configuración de distribución de columnas
  const visibleCount = 10;

  // Ancho disponible para dibujar las entidades
  const plot = $("entityBars");
  const availableWidth = Math.max(200, plot.parentElement.clientWidth - 110);

  // Espacio estimado por entidad
  const categoryWidth =
    availableWidth / Math.max(1, Math.min(values.length, visibleCount));

  // Barras más anchas y con menor separación
  const columnWidth = Math.max(28, Math.min(65, categoryWidth * 0.82));

  const zoomEnd =
    values.length <= visibleCount ? 100 : (visibleCount / values.length) * 100;

  // Evitar desbordamiento horizontal.
  plot.style.width = "100%";
  plot.style.maxWidth = "100%";
  plot.style.minWidth = "0";
  plot.style.height = "580px";

  barChart.resize();

  const barData = values.map((v) => ({
    value: v.s25,
    itemStyle: {
      color: "#f1c7d7",
      borderRadius: [5, 5, 0, 0],
    },
  }));

  const edsData = values.map((v) => ({
    value: v.eds,
    itemStyle: {
      color: "#9bd1bd",
      borderRadius: [4, 4, 0, 0],
    },
  }));

  const markData = values.map((v, i) => [i, v.s26]);

  barChart.setOption(
    {
      animation: true,
      animationDuration: 1000,
      animationEasing: "cubicOut",

      legend: {
        show: true,
        top: 2,
        left: "center",
        type: "scroll",
        selectedMode: true,
        data: [
          { name: "SINBA 2025", icon: "roundRect" },
          { name: "EDS 2026", icon: "roundRect" },
          {
            name: "SINBA 2026",
            icon: "path://M0,4 L28,4 L28,7 L0,7 Z",
          },
        ],
        textStyle: {
          color: "#235B4E",
          fontSize: 11,
        },
        itemWidth: 19,
        itemHeight: 11,
        itemGap: 12,
      },

      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const i = params.find((p) => p.dataIndex !== undefined)?.dataIndex;

          return i === undefined ? "" : tooltip(values[i]);
        },
      },

      grid: {
        left: 67,
        right: 22,
        top: 68,
        bottom: 125,
      },

      // Desplazamiento horizontal dentro del gráfico.
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: 0,
          start: 0,
          end: zoomEnd,
          zoomLock: false,
        },
        {
          type: "slider",
          xAxisIndex: 0,
          show: values.length > visibleCount,
          start: 0,
          end: zoomEnd,
          bottom: 8,
          height: 18,
          borderColor: "#dbe7e1",
          fillerColor: "rgba(35,91,78,0.12)",
          handleStyle: {
            color: "#235B4E",
          },
        },
      ],

      xAxis: {
        type: "category",
        data: values.map((v) => v.name),
        axisLabel: {
          interval: 0,
          rotate: values.length > 5 ? 40 : 0,
          margin: 15,
          hideOverlap: true,
          fontSize: 10,
          color: "#235B4E",
          width: 95,
          overflow: "truncate",
        },
        axisTick: {
          alignWithLabel: true,
        },
      },

      yAxis: {
        type: "value",
        min: 0,
        max: Math.ceil(maxValue * 1.12),
        name: "Registros",
        axisLabel: {
          formatter: (v) =>
            v >= 1000000
              ? (v / 1000000).toFixed(1) + "M"
              : v >= 1000
              ? Math.round(v / 1000) + " mil"
              : v,
        },
        splitLine: {
          lineStyle: {
            color: "#e6ece8",
          },
        },
      },

      series: [
        // SINBA 2025: referencia histórica.
        {
          name: "SINBA 2025",
          type: "bar",
          data: barData,
          itemStyle: {
            color: "#f1c7d7",
          },
          barWidth: columnWidth,
          barGap: "-100%",
          z: 1,
        },

        // EDS 2026: volumen desde cero.
        {
          name: "EDS 2026",
          type: "bar",
          data: edsData,
          itemStyle: {
            color: "#9bd1bd",
          },
          barWidth: columnWidth,
          barGap: "-100%",
          z: 3,

          label: {
            show: true,
            position: "insideTop",
            color: "#10312B",
            fontSize: 10,

            formatter: (p) => {
              const item = values[p.dataIndex];

              if (!item || item.p25 === null || item.eds <= 0) {
                return "";
              }

              // Evitar porcentajes en barras pequeñas.
              const plotHeight = Math.max(0, plot.clientHeight - 68 - 125);

              const barHeight =
                (item.eds / Math.ceil(maxValue * 1.12)) * plotHeight;

              return barHeight >= 35 ? item.p25.toFixed(1) + "%" : "";
            },
          },
        },

        // SINBA 2026: marca horizontal dorada.
        {
          name: "SINBA 2026",
          type: "custom",
          data: markData,
          itemStyle: {
            color: "#A57F2C",
          },
          z: 6,
          tooltip: {
            show: false,
          },

          renderItem: (params, api) => {
            const index = api.value(0);
            const val = api.value(1);

            const point = api.coord([index, val]);
            const half = columnWidth / 2 + 3;

            return {
              type: "line",
              shape: {
                x1: point[0] - half,
                y1: point[1],
                x2: point[0] + half,
                y2: point[1],
              },
              style: {
                stroke: "#A57F2C",
                lineWidth: 3,
              },
            };
          },
        },
      ],
    },
    true
  );

  // ==========================================================
  // MAPA DE MÉXICO - RELACIÓN HISTÓRICA POR ENTIDAD
  // ==========================================================

  if (mapReady) {
    const byCode = Object.fromEntries(values.map((v) => [v.code, v]));

    const geo = echarts.getMap("mexico_eds").geoJson;

    const entries = geo.features.map((f) => {
      const n = f.properties.name;
      const o = byCode[geoCode(n)];

      return {
        name: n,
        value: o?.p25 ?? null,
        itemStyle: !o || o.p25 === null ? { areaColor: "#e3e6e3" } : undefined,
      };
    });

    mapChart.setOption(
      {
        animation: true,

        tooltip: {
          trigger: "item",
          formatter: (p) => {
            const o = byCode[geoCode(p.name)];

            return o
              ? tooltip(o)
              : `${p.name}<br>Sin referencia histórica en la selección`;
          },
        },

        visualMap: {
          type: "piecewise",
          left: "center",
          bottom: 5,
          orient: "horizontal",
          textStyle: { fontSize: 9 },

          pieces: [
            { min: 100, color: "#75ae95", label: "≥100%" },
            { min: 75, max: 99.999, color: "#b2d9ba", label: "75–99.9%" },
            { min: 50, max: 74.999, color: "#e6d194", label: "50–74.9%" },
            { min: 25, max: 49.999, color: "#f3bdab", label: "25–49.9%" },
            { min: 0, max: 24.999, color: "#e9a2a9", label: "0–24.9%" },
          ],

          outOfRange: {
            color: "#e3e6e3",
          },
        },

        series: [
          {
            type: "map",
            map: "mexico_eds",
            roam: false,
            selectedMode: false,

            layoutCenter: ["50%", "45%"],
            layoutSize: "115%",

            emphasis: {
              label: { show: true },
            },

            label: { show: false },
            data: entries,
          },
        ],
      },
      true
    );

    mapChart.resize();
  }
}
