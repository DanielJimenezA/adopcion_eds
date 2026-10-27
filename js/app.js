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
      inGroup(c),
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
      (x) => new Option((ENTITY_NAMES[x] || x) + " (" + x + ")", x),
    ),
  );
  $("entity").value = prefixes.includes(previous) ? previous : "ALL";
  updateClues();
}
function normalizeClues(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function cluesLabel(clues) {
  const code = normalizeClues(clues);
  const name = unitNames[code];

  return name ? `${code} — ${name}` : code;
}
function updateClues() {
  const area = $("area").value,
    previous = $("clues").value,
    entity = $("entity").value;
  const { values, diagnostic } = availableClues(area);
  const term = ($("cluesSearch")?.value || "").trim().toLocaleLowerCase("es");
  const clues = values
    .filter(
      (c) =>
        (entity === "ALL" || c.startsWith(entity)) &&
        (!term ||
          `${c} ${unitNames[c] || ""}`.toLocaleLowerCase("es").includes(term)),
    )
    .sort();
  $("clues").replaceChildren(
    new Option(
      (diagnostic
        ? "CLUES disponibles (sin coincidencias)"
        : "todas las CLUES") +
        " (" +
        clues.length +
        ")",
      "ALL",
    ),
    ...clues.map(
      (c) => new Option(unitNames[c] ? `${c} — ${unitNames[c]}` : c, c),
    ),
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
    (s) => s.area === area && !HIDDEN.has(s.id) && s.id !== "integral_triple",
  );
}
function mainScenario(area) {
  const base =
    visibleScenarios(area).find(
      (s) =>
        s.sinba_year === 2025 &&
        s.sinba_sources.length ===
          Math.max(
            ...visibleScenarios(area).map((x) => x.sinba_sources.length),
          ),
    ) || visibleScenarios(area)[0];
  return base
    ? { ...base, id: "integral_triple", sinba_sources: [...base.sinba_sources] }
    : null;
}
function selected() {
  return mainScenario($("area").value);
}
function seriesFor(s, rows, isCumulative) {
  const start = Number($("weekStart")?.value) || 1;
  const prior = isCumulative ? s.series.filter((r) => r.week < start) : [];
  let a = prior.reduce((n, r) => n + r.sinba, 0),
    b = prior.reduce((n, r) => n + r.eds, 0),
    c = prior.reduce((n, r) => n + (r.sinba2026 || 0), 0);
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
            isCumulative ? (c += r.sinba2026 || 0) : r.sinba2026 || 0,
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
                x.value ?? 0,
              )}</strong>`,
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
          : `S${String(r.week).padStart(2, "0")}`,
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
    const start = Number($("weekStart").value) || 1;
    const rows =
      $("view").value === "monthly"
        ? monthlyRows(s, cut).filter((r) => r.week >= start)
        : s.series.filter((r) => r.week >= start && r.week <= cut);
    const instance = echarts.init(plot);
    instance.setOption(
      graphOption(s, rows, $("view").value === "cumulative", true),
    );
    smallCharts.push(instance);
  }
}
function monthlyRows(s, cut) {
  // La semana ISO 1 de 2026 inicia el 29 de diciembre de 2025.
  const jan4 = new Date(Date.UTC(2026, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(
    jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (cut - 1) * 7,
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
    start = Number($("weekStart").value) || 1,
    rows = monthly
      ? monthlyRows(s, cut).filter((r) => r.week >= start)
      : s.series.filter((r) => r.week >= start && r.week <= cut),
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
        (r) => r.week <= cut && (z[`2026-${r.week}`] || 0) > 0,
      );
    }).length,
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
      diag?.sinba?.length || 0,
    )}, EDS ${fmt(
      diag?.eds?.length || 0,
    )}. Los filtros pueden mostrar unidades disponibles para diagnóstico, pero sus registros NO se contabilizan hasta confirmar la coincidencia. Revisa nombres de CLUES, fechas y cobertura.`;
  $("filterNotice").textContent = `Grupo: ${
    $("group").value === "hraes" ? "HRAES" : "Unidades generales"
  } · Unidades comparables identificadas en ambos sistemas: ${fmt(
    s.clues_compartidas,
  )} CLUES · ${$("entity").selectedOptions[0].text} · ${
    $("clues").value === "ALL" ? "todas las CLUES" : $("clues").value
  }. Los indicadores y reportes usan este filtro.`;
  $("chartTitle").textContent =
    (monthly
      ? "Evolución mensual"
      : isCumulative
        ? "Evolución acumulada"
        : "Evolución semanal") + " · comparación integral";
  $("chartSubtitle").textContent =
    `Semanas ISO ${start}–${cut} · ${scenarioName(s)} · ${
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
  renderWeekComparison(s, start, cut);
  const historical = yearTotal(2025);
  const ratio = historical ? (100 * edsCorte) / historical : null;
  const edsModule = names[s.eds_source];
  $("executiveReading").textContent =
    ratio === null
      ? `En el periodo seleccionado no existe un volumen de referencia SINBA 2025 válido para calcular la relación de ${edsModule} 2026. Los conteos corresponden a registros (filas), sin deduplicación de eventos.`
      : `En el periodo seleccionado, los registros generados en ${edsModule} durante 2026 representan el ${ratio.toFixed(
          1,
        )}% de los registros reportados en SINBA en el mismo periodo de 2025. Este indicador permite dimensionar el avance del registro en ${edsModule} respecto al volumen observado el año previo. No representa el porcentaje de unidades que utilizan el sistema ni la proporción de registros migrados desde SINBA. Los conteos corresponden a registros (filas), sin deduplicación de eventos.`;
}
function rebuild() {
  updateEntities();
}
function download() {
  const s = filteredScenario(selected()),
    cut = Number($("week").value);
  const triple = s.id === "integral_triple";
  const start = Number($("weekStart").value) || 1;
  const lines = [
    triple
      ? "semana_iso,sinba_2025,sinba_2026,eds_2026"
      : "semana_iso,sinba_" + s.sinba_year + ",eds_2026",
    ...s.series
      .filter((r) => r.week >= start && r.week <= cut)
      .map((r) =>
        triple
          ? `${r.week},${r.sinba},${r.sinba2026},${r.eds}`
          : `${r.week},${r.sinba},${r.eds}`,
      ),
  ];
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `adopcion_${s.id}_semanas_${start}_a_${cut}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
async function init() {
  try {
    if (!window.echarts)
      throw new Error(
        "No se pudo cargar ECharts. Comprueba la conexión a internet.",
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
        "Faltan los JSON: ejecuta el procesador antes de publicar.",
      );
    data = await r.json();
    quality = await q.json();
    details = await d.json();
    auditDetails = await ad.json();
    monthlyDetails = await md.json();

    chart = echarts.init($("chart"));
    // window.addEventListener("resize", () => {
    //   chart.resize();
    //   mapChart?.resize();
    //   barChart?.resize();
    // });
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
      const response = await fetch("config/unidades_catalogo.csv");

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const csv = (await response.text()).replace(/^\uFEFF/, "");
      const lines = csv.split(/\r?\n/).filter(Boolean);

      // Extrae campos CSV con comillas y comas internas.
      function parseCSVLine(line) {
        const fields = [];
        let field = "";
        let quoted = false;

        for (let i = 0; i < line.length; i++) {
          const ch = line[i];

          if (ch === '"') {
            if (quoted && line[i + 1] === '"') {
              field += '"';
              i++;
            } else {
              quoted = !quoted;
            }
          } else if (ch === "," && !quoted) {
            fields.push(field);
            field = "";
          } else {
            field += ch;
          }
        }

        fields.push(field);
        return fields;
      }

      const delimiter = lines[0].includes(";") ? ";" : ",";

      for (const line of lines.slice(1)) {
        const fields = delimiter === "," ? parseCSVLine(line) : line.split(";");

        const clues = (fields[0] || "").trim().toUpperCase();
        const nombre = (fields[1] || "").trim();

        if (clues && nombre) {
          unitNames[clues] = nombre;
        }
      }

      console.log("Unidades del catálogo:", Object.keys(unitNames).length);
    } catch (error) {
      console.warn("No se pudo cargar el catálogo de unidades:", error);
    }
    $("week").replaceChildren(
      ...Array.from(
        { length: last },
        (_, i) =>
          new Option("Semana " + String(i + 1).padStart(2, "0"), String(i + 1)),
      ),
    );
    $("weekStart").replaceChildren(
      ...Array.from(
        { length: last },
        (_, i) =>
          new Option("Semana " + String(i + 1).padStart(2, "0"), String(i + 1)),
      ),
    );
    $("weekStart").value = "1";
    $("week").value = String(last);
    $("group").addEventListener("change", () => {
      $("entity").value = "ALL";
      $("clues").value = "ALL";
      updateEntities();
    });
    for (const id of ["area", "view"])
      $(id).addEventListener("change", id === "area" ? rebuild : render);
    for (const id of ["weekStart", "week"])
      $(id).addEventListener("change", () => {
        const first = Number($("weekStart").value),
          lastWeek = Number($("week").value);
        if (first > lastWeek) {
          if (id === "weekStart") $("week").value = String(first);
          else $("weekStart").value = String(lastWeek);
        }
        render();
      });
    $("cluesSearch").addEventListener("input", updateClues);
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
      $("cluesSearch").value = "";
      $("view").value = "weekly";
      $("weekStart").value = "1";
      $("week").value = String(last);
      render();
    });
    rebuild();
    if (window.setupReports) window.setupReports();
    $("updatedAt").textContent = data.metadata.fecha_proceso;
    $("status").textContent =
      `Procesado: ${data.metadata.fecha_proceso} · Última semana completa: ${data.metadata.ultima_semana_completa} · ${data.metadata.metodo_cruce}`;
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
  start: Number($("weekStart").value),
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
  const v = $("view").value,
    start = Number($("weekStart").value) || 1;
  if (v === "monthly")
    return monthlyRows(s, cut).filter((r) => r.week >= start);
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
      }))
      .filter((r) => r.week >= start);
  }
  return s.series.filter((r) => r.week >= start && r.week <= cut);
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
  const values = territoryValues(s, cut),
    sort = $("barSort").value;
  values.sort((a, b) =>
    sort === "alpha"
      ? a.name.localeCompare(b.name, "es")
      : sort === "desc"
        ? (b.p25 ?? -1) - (a.p25 ?? -1)
        : (a.p25 ?? Infinity) - (b.p25 ?? Infinity),
  );
  const tooltip = (o) => {
    const porcentaje = (v) =>
      v === null || v === undefined ? "No calculable" : `${v.toFixed(1)}%`;

    return `
      <div style="max-width:340px;line-height:1.5;white-space:normal;">
        <strong style="font-size:14px;">${o.name}</strong>
  
        <div style="margin-top:8px;font-weight:600;">
          Cobertura de establecimientos
        </div>
  
        <div>CLUES comparables: <b>${fmt(o.clues)}</b></div>
        <div style="font-size:11px;color:#66736d;">
          Unidades incluidas en el universo común de comparación.
        </div>
  
        <div>CLUES con EDS: <b>${fmt(o.withEds)}</b></div>
        <div style="font-size:11px;color:#66736d;">
          Unidades con registros EDS en el periodo evaluado.
        </div>
  
        <hr style="border:0;border-top:1px solid #e5e9e6;">
  
        <div style="font-weight:600;">Volumen de registros</div>
        <div>SINBA 2025: <b>${fmt(o.s25)}</b></div>
        <div>SINBA 2026: <b>${fmt(o.s26)}</b></div>
        <div>EDS 2026: <b>${fmt(o.eds)}</b></div>
  
        <hr style="border:0;border-top:1px solid #e5e9e6;">
  
        <div style="font-weight:600;">Relación de volúmenes</div>
        <div>EDS / SINBA 2025: <b>${porcentaje(o.p25)}</b></div>
        <div>EDS / SINBA 2026: <b>${porcentaje(o.p26)}</b></div>
  
        <div style="margin-top:8px;font-size:11px;color:#66736d;">
          Los porcentajes expresan la relación entre volúmenes
          de registros, no el porcentaje de adopción de EDS.
          Los valores corresponden al corte temporal aplicado al mapa.
        </div>
      </div>
    `;
  };
  // Una sola escala absoluta: SINBA 2025 como referencia, EDS 2026 desde cero,
  // y SINBA 2026 como marca horizontal. Nunca apilar volúmenes entre años.
  const maxValue = Math.max(1, ...values.flatMap((v) => [v.s25, v.s26, v.eds]));
  const columnWidth = 76,
    step = 112;
  const plot = $("entityBars");
  plot.style.width =
    Math.max(plot.parentElement.clientWidth - 12, values.length * step + 100) +
    "px";
  plot.style.height = "440px";
  barChart.resize();
  const barData = values.map((v) => ({
    value: v.s25,
    itemStyle: { color: "#f1c7d7", borderRadius: [5, 5, 0, 0] },
  }));
  const edsData = values.map((v) => ({
    value: v.eds,
    itemStyle: { color: "#9bd1bd", borderRadius: [4, 4, 0, 0] },
  }));
  const markData = values.map((v, i) => [i, v.s26]);
  const legendNames = ["SINBA 2025", "EDS 2026", "SINBA 2026"];
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
          { name: "SINBA 2026", icon: "path://M0,4 L28,4 L28,7 L0,7 Z" },
        ],
        textStyle: { color: "#235B4E", fontSize: 11 },
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
      grid: { left: 67, right: 22, top: 68, bottom: 92 },
      xAxis: {
        type: "category",
        data: values.map((v) => v.name),
        axisLabel: {
          interval: 0,
          rotate: values.length > 5 ? 38 : 0,
          fontSize: 10,
          color: "#235B4E",
          width: 95,
          overflow: "truncate",
        },
        axisTick: { alignWithLabel: true },
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
        splitLine: { lineStyle: { color: "#e6ece8" } },
      },
      series: [
        {
          name: "SINBA 2025",
          type: "bar",
          data: barData,
          itemStyle: { color: "#f1c7d7" },
          barWidth: columnWidth,
          barGap: "-100%",
          z: 1,
        },
        {
          name: "EDS 2026",
          type: "bar",
          data: edsData,
          itemStyle: { color: "#9bd1bd" },
          barWidth: columnWidth,
          barGap: "-100%",
          z: 3,
          label: {
            show: values.length <= 8,
            position: "insideTop",
            color: "#10312B",
            fontSize: 10,
            formatter: (p) =>
              values[p.dataIndex].p25 === null
                ? ""
                : values[p.dataIndex].p25.toFixed(1) + "%",
          },
        },
        {
          name: "SINBA 2026",
          type: "custom",
          data: markData,
          itemStyle: { color: "#A57F2C" },
          z: 6,
          tooltip: { show: false },
          renderItem: (params, api) => {
            const index = api.value(0),
              val = api.value(1);
            const point = api.coord([index, val]);
            const half = columnWidth / 2 + 5;
            return {
              type: "line",
              shape: {
                x1: point[0] - half,
                y1: point[1],
                x2: point[0] + half,
                y2: point[1],
              },
              style: { stroke: "#A57F2C", lineWidth: 3 },
            };
          },
        },
      ],
    },
    true,
  );
  if (mapReady) {
    const byCode = Object.fromEntries(values.map((v) => [v.code, v]));
    const geo = echarts.getMap("mexico_eds").geoJson;
    const entries = geo.features.map((f) => {
      const n = f.properties.name,
        o = byCode[geoCode(n)];
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
            { min: 75, color: "#75ae95", label: "75–100%+" },
            { min: 50, max: 74.999999, color: "#b2d9ba", label: "50–75%" },
            { min: 25, max: 49.999999, color: "#e6d194", label: "25–50%" },
            { min: 0, max: 24.999999, color: "#e9a2a9", label: "0–25%" },
          ],
          outOfRange: { color: "#e3e6e3" },
        },
        series: [
          {
            type: "map",
            map: "mexico_eds",
            aspectScale: 1,
            roam: false,
            selectedMode: false,
            layoutCenter: ["50%", "50%"],
            layoutSize: "175%",
            // Evitar desplazamientos adicionales
            left: "center",
            top: "middle",
            emphasis: { label: { show: true } },
            label: { show: false },
            data: entries,
          },
        ],
      },
      true,
    );
  }
}

// Comparación de cortes acumulados (el primer corte incluye su propia semana).
function renderWeekComparison(s, start, end) {
  const series = s.series.filter((r) => r.week <= end);
  const sums = (cut, key) =>
    series.filter((r) => r.week <= cut).reduce((v, r) => v + (r[key] || 0), 0);
  const format = (key, label) => {
    const initial = sums(start, key),
      final = sums(end, key),
      delta = final - initial;
    return `${label}: S${String(start).padStart(2, "0")} ${fmt(
      initial,
    )} → S${String(end).padStart(2, "0")} ${fmt(final)} (incremento +${fmt(
      delta,
    )})`;
  };
  const weekComparisonElement = $("weekComparison");

  if (weekComparisonElement) {
    $("weekComparison").textContent = [
      format("sinba", "SINBA 2025"),
      format("sinba2026", "SINBA 2026"),
      format("eds", "EDS 2026"),
    ].join("  |  ");
  }

  // La sección de auditoría está oculta actualmente.
  // Solo actualizar su nota si el elemento existe.
  const auditWeekNoteElement = $("auditWeekNote");

  if (auditWeekNoteElement) {
    auditWeekNoteElement.textContent =
      `Semanas seleccionadas: S${String(start).padStart(2, "0")}–` +
      `S${String(end).padStart(2, "0")}. ` +
      `La auditoría por CLUES se actualiza con los filtros de unidad, grupo y entidad, ` +
      `pero sus cifras corresponden al procesamiento completo, no al intervalo seleccionado.`;
  }
}
