import { airReading, findEvidence, isMissing, loadIndex, reportLink } from "./evidence.js";

const byId = (id) => document.getElementById(id);
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[c]);
const normalize = (value) => value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
const number = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const oxygen = (value) => value == null ? "—" : `${number.format(value)}%`;
const PAGE_SIZE = 7;
const selected = new Set();
const modal = byId("modal");
const modalBody = byId("modal-body");

const MATERIAL_PALETTE = [
  "#d6f682", "#5eead4", "#fb923c", "#a78bfa",
  "#f472b6", "#38bdf8", "#facc15", "#f87171", "#94a3b8"
];

let trials = [];
let materialColors = new Map();
let activeMapMaterial = "";
let page = 1;
let sort = 0;
let requester;
let pending = false;
let showExtinctionReference = false;

function formatFamily(raw) {
  const map = {
    "Varilla PMMA": "PMMA (Cylindrical rods)",
    "Varilla sin polímero explícito": "Polymer rod (unspecified)",
    "PMMA": "PMMA (Films & slabs)",
    "Otros": "Other materials",
    "Cera": "Wax"
  };
  return map[raw] || raw || "Unknown";
}

function formatDirection(raw) {
  if (!raw) return "Unconfirmed";
  const map = {
    "Opuesto": "Opposed",
    "Concurrente": "Concurrent",
    "Estancamiento": "Stagnant",
    "Sin confirmar": "Unconfirmed"
  };
  return map[raw] || raw;
}

const hasOxygen = (trial) => Number.isFinite(trial.initialO2) && trial.initialO2 >= 0 && trial.initialO2 <= 100;

function citation(source, prefix = "NASA") {
  const label = source.table ? `${prefix} · ${source.table} · p. ${source.page}` : `${prefix} · p. ${source.page}`;
  return `<a class="citation" href="${reportLink(source)}" target="_blank" rel="noreferrer">${escape(label)} ↗</a>`;
}

function formatField(label, value) {
  return `<div><dt>${label}</dt><dd>${escape(isMissing(value) ? "No data" : value)}</dd></div>`;
}

const outcomeStatus = (value) => value === true ? "Yes" : value === false ? "No" : "Unknown";
const proportion = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

function renderOutcomes() {
  const summarize = (records, field) => {
    const counts = { Yes: 0, No: 0, Unknown: 0 };
    for (const trial of records) counts[outcomeStatus(trial[field])]++;
    return Object.entries(counts).map(([label, count]) =>
      `<span>${label} <b>${count}/${records.length} (${proportion.format(count / records.length)})</b></span>`
    ).join("");
  };
  const groups = [[null, trials], ...[...materialColors.keys()].map(
    (family) => [family, trials.filter((trial) => trial.family === family)]
  )];
  byId("outcome-rows").innerHTML = groups.map(([family, records]) => {
    const label = family === null ? "All materials" : formatFamily(family);
    return `<tr><th scope="row"><button type="button" class="trial-link" data-outcome-material="${escape(family ?? "")}"
      aria-pressed="${(family ?? "") === activeMapMaterial}">${escape(label)}</button></th>
      <td>${summarize(records, "ignited")}</td><td>${summarize(records, "spread")}</td></tr>`;
  }).join("");
}

function renderLegend(families) {
  const legendEl = byId("chart-legend");
  legendEl.innerHTML = families.map((family) => {
    const color = materialColors.get(family);
    const active = activeMapMaterial === family;
    const dimmed = activeMapMaterial && !active;
    return `<button type="button" class="legend-pill ${active ? "active" : ""} ${dimmed ? "dimmed" : ""}" aria-pressed="${active}" data-map-material="${escape(family)}">
      <span class="legend-dot" style="background:${color}"></span>
      <span>${escape(formatFamily(family))}</span>
    </button>`;
  }).join("");
  byId("reset-map-filter").hidden = !activeMapMaterial;
}

function renderFlammabilityMap() {
  const svg = byId("flam-svg");
  const tooltip = byId("chart-tooltip");
  const subset = activeMapMaterial ? trials.filter((trial) => trial.family === activeMapMaterial) : trials;
  const points = [];
  const excluded = { "Multiple / annotated": 0, Missing: 0, Oxygen: 0 };
  for (const trial of subset) {
    const air = airReading(trial.air);
    if (air.value === null) excluded[air.status]++;
    else if (!hasOxygen(trial)) excluded.Oxygen++;
    else points.push({ trial, o2: trial.initialO2, flow: air.value });
  }
  byId("plotted-count").textContent = `${points.length}/${subset.length} trials plotted`;
  byId("map-exclusions").textContent = `Excluded · ${excluded["Multiple / annotated"]} multiple/annotated air · ${excluded.Missing} missing air · ${excluded.Oxygen} missing/invalid O₂ with single air`;

  const W = 760, H = 400;
  const pad = { top: 22, right: 33, bottom: 52, left: 62 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const xMin = 0;
  const xMax = Math.max(5, Math.ceil(Math.max(0, ...points.map((p) => p.flow)) / 5) * 5);
  const yMin = Math.min(12, ...points.map((p) => p.o2));
  const yMax = Math.max(24, ...points.map((p) => p.o2));

  const xScale = (v) => pad.left + ((v - xMin) / (xMax - xMin)) * plotW;
  const yScale = (v) => pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const yTicks = [];
  for (let v = Math.ceil(yMin / 2) * 2; v <= yMax; v += 2) yTicks.push(v);
  const xStep = xMax <= 25 ? 5 : 10;
  const xTicks = [];
  for (let v = xMin; v <= xMax; v += xStep) xTicks.push(v);

  let markup = "";

  for (const yVal of yTicks) {
    const y = yScale(yVal);
    markup += `<line class="chart-grid-line" x1="${pad.left}" y1="${y}" x2="${W - pad.right}" y2="${y}" />`;
    markup += `<text class="chart-axis-label" x="${pad.left - 10}" y="${y + 4}" text-anchor="end">${yVal}%</text>`;
  }

  for (const xVal of xTicks) {
    const x = xScale(xVal);
    markup += `<line class="chart-grid-line" x1="${x}" y1="${pad.top}" x2="${x}" y2="${pad.top + plotH}" />`;
    markup += `<text class="chart-axis-label" x="${x}" y="${pad.top + plotH + 20}" text-anchor="middle">${xVal}</text>`;
  }

  markup += `<text class="chart-axis-title" x="${pad.left + plotW / 2}" y="${H - 10}" text-anchor="middle">Air display · single reading (cm/s)</text>`;
  markup += `<text class="chart-axis-title" transform="rotate(-90)" x="${-(pad.top + plotH / 2)}" y="18" text-anchor="middle">Initial calibrated O₂ (%)</text>`;

  if (showExtinctionReference) {
    // NASA/TM-20210011385, Table 2.1. Convert the reported mm/s to cm/s.
    for (const [o2, flow, uncertainty] of [[21, 1, 0.5], [16, 3, 0.5]]) {
      const y = yScale(o2);
      const start = xScale(flow - uncertainty);
      const center = xScale(flow);
      const end = xScale(flow + uncertainty);
      markup += `<path class="chart-extinction-reference"
        d="M ${start} ${y} H ${end} M ${start} ${y-5} v 10 M ${end} ${y-5} v 10 M ${center} ${y-8} v 16" />`;
    }
  }

  for (const { trial, o2, flow } of points) {
    const color = materialColors.get(trial.family);
    const outcome = outcomeStatus(trial.ignited).toLowerCase();
    const fill = outcome === "yes" ? color : "transparent";
    const label = `Trial ${trial.id}, ${formatFamily(trial.family)}, ${o2}% O₂, ${flow} cm/s, ignition ${outcome}`;
    markup += `<circle class="chart-point outcome-${outcome}" cx="${xScale(flow).toFixed(1)}" cy="${yScale(o2).toFixed(1)}" r="6"
      fill="${fill}" stroke="${color}" tabindex="0" role="button" data-point-id="${escape(trial.id)}" aria-label="${escape(label)}" />`;
  }

  svg.innerHTML = markup;

  const showTip = (circle) => {
    const trial = trials.find((t) => t.id === circle.dataset.pointId);
    if (!trial) return;
    tooltip.innerHTML = `
      <strong>${escape(trial.id)} · ${escape(formatFamily(trial.family))}</strong>
      <span>${escape(trial.material)}</span>
      <span>O₂: ${oxygen(trial.initialO2)} · Flow: ${escape(trial.air || "—")}</span>
      <span>Direction: ${escape(formatDirection(trial.report?.direction))}</span>
      <span>Ignited: ${outcomeStatus(trial.ignited)} · Spread: ${outcomeStatus(trial.spread)}</span>
    `;
    tooltip.hidden = false;
    const stageRect = byId("chart-stage").getBoundingClientRect();
    const ptRect = circle.getBoundingClientRect();
    const left = Math.min(stageRect.width - 205, Math.max(12, ptRect.left - stageRect.left + 12));
    const top = Math.max(10, ptRect.top - stageRect.top - 12);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };

  svg.onmousemove = (event) => {
    const circle = event.target.closest(".chart-point");
    if (circle) showTip(circle);
    else tooltip.hidden = true;
  };
  svg.onmouseleave = () => { tooltip.hidden = true; };
  svg.onfocusin = (event) => showTip(event.target);
  svg.onfocusout = () => { tooltip.hidden = true; };
  const openPoint = (event) => {
    const circle = event.target.closest(".chart-point");
    if (!circle) return;
    const trial = trials.find((t) => t.id === circle.dataset.pointId);
    if (trial) showTrial(trial, circle);
  };
  svg.onclick = openPoint;
  svg.onkeydown = (event) => {
    if (event.target.matches(".chart-point") && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openPoint(event);
    }
  };
}

function setMapMaterialFilter(family, syncTable = false) {
  activeMapMaterial = activeMapMaterial === family ? "" : family;
  renderLegend([...materialColors.keys()]);
  renderFlammabilityMap();
  renderOutcomes();

  if (syncTable) {
    byId("material").value = activeMapMaterial;
    page = 1;
    renderTable();
  }
}

/* ==========================================================================
   TRIAL EXPLORER, TABLE, MODALS & AI ASSISTANT
   ========================================================================== */

function filteredTrials() {
  const query = normalize(byId("query").value.trim()).split(/\s+/).filter(Boolean);
  const material = byId("material").value;
  const band = byId("oxygen").value;
  const flow = byId("flow").value;
  const videoOnly = byId("video-only").checked;
  const filtered = trials.filter((trial) => {
    const dirEn = formatDirection(trial.report?.direction);
    const famEn = formatFamily(trial.family);
    const searchable = normalize(`${trial.id} sample ${trial.sample} ${trial.family} ${famEn} ${trial.material} ${trial.pi} ${dirEn}`);
    if (!query.every((term) => searchable.includes(term))) return false;
    if (material && trial.family !== material) return false;
    if (flow && (trial.report?.direction || "unknown") !== flow) return false;
    if (videoOnly && !trial.video) return false;
    const value = trial.initialO2;
    return !band || (value != null && (band === "low" ? value < 18 : band === "mid" ? value >= 18 && value < 21 : value >= 21));
  });
  if (sort) filtered.sort((a, b) => a.initialO2 == null ? 1 : b.initialO2 == null ? -1 : sort * (a.initialO2 - b.initialO2));
  return filtered;
}

function updateSelection() {
  byId("selected").textContent = selected.size === 3 ? "3 selected · max" : `${selected.size} selected`;
  byId("compare").disabled = selected.size < 2;
  byId("reset-selection").hidden = selected.size === 0;
  for (const input of byId("trial-rows").querySelectorAll("input")) {
    input.checked = selected.has(input.value);
    input.disabled = selected.size === 3 && !input.checked;
  }
}

function renderTable() {
  const filtered = filteredTrials();
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  page = Math.min(page, pages);
  const start = (page - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE).map((trial) => `<tr>
    <td><input type="checkbox" value="${escape(trial.id)}" aria-label="Select trial ${escape(trial.id)}"></td>
    <td><button type="button" class="trial-link" data-trial="${escape(trial.id)}">${escape(trial.id)}</button></td>
    <td>${escape(trial.material)}</td>
    <td>${oxygen(trial.initialO2)}</td>
    <td>${escape(formatDirection(trial.report?.direction))}</td>
    <td>${trial.video ? `<button class="play-small" aria-label="Watch video ${escape(trial.id)}" type="button" data-video="${escape(trial.id)}">▶</button>` : ""}</td>
  </tr>`);
  byId("trial-rows").innerHTML = rows.join("") || '<tr><td colspan="6" class="empty">No trials match the current filters.</td></tr>';
  byId("export-filtered").disabled = filtered.length === 0;
  byId("result-count").textContent = `${filtered.length} of ${trials.length} records`;
  byId("page-label").textContent = filtered.length ? `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length}` : "0 records";
  byId("prev").disabled = page <= 1;
  byId("next").disabled = page >= pages;
  byId("reset-filters").hidden = !["query", "material", "oxygen", "flow"].some((id) => byId(id).value) && !byId("video-only").checked;
  const sortButton = byId("sort-oxygen");
  sortButton.closest("th").setAttribute("aria-sort", sort === 1 ? "ascending" : sort === -1 ? "descending" : "none");
  sortButton.querySelector("span").textContent = sort === 1 ? "↑" : sort === -1 ? "↓" : "↕";
  updateSelection();
}

function duration(seconds) {
  const value = Math.round(seconds);
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

function recordingsFor(trial) {
  return trial.recordings ?? [{
    label: "Side view",
    file: `${trial.id.toLowerCase()}.mp4`,
    seconds: trial.video,
    source: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-25",
  }];
}

function renderRecordings() {
  const withVideo = trials.filter((trial) => trial.video);
  const count = withVideo.reduce((total, trial) => total + recordingsFor(trial).length, 0);
  byId("total-recordings").textContent = count;
  byId("recordings-count").textContent = `${count} recordings · ${withVideo.length} trials`;
  byId("recording-grid").innerHTML = withVideo.map((trial) => {
    const views = recordingsFor(trial).length;
    return `
    <button class="recording" type="button" data-video="${trial.id}" aria-label="Watch recording for trial ${trial.id}">
      <span class="recording-poster"><img src="media/${trial.id.toLowerCase()}.webp" loading="lazy" alt=""><b aria-hidden="true">▶</b></span>
      <span class="recording-label"><strong>${trial.id} · ${escape(formatFamily(trial.family))}</strong><small>Sample ${escape(trial.sample)} · ${views} ${views === 1 ? "video" : "videos"}</small></span>
    </button>`;
  }).join("");
}

function showModal(title, body, trigger) {
  requester = modal.open ? requester : trigger;
  byId("modal-title").textContent = title;
  modalBody.innerHTML = body;
  if (!modal.open) modal.showModal();
  modal.querySelector(".close").focus();
}

function showVideo(trial, trigger) {
  const name = trial.id.toLowerCase();
  const recordings = recordingsFor(trial);
  const [first] = recordings;
  showModal(`Recording ${trial.id} · ${formatFamily(trial.family)}`, `
    ${recordings.length > 1 ? `<label class="recording-picker">Recording
      <select>${recordings.map((recording, index) => `<option value="${index}">${escape(recording.label)} · ${duration(recording.seconds)}</option>`).join("")}</select>
    </label>` : ""}
    <video controls playsinline preload="metadata" poster="media/${name}.webp" src="media/${escape(first.file)}" aria-label="${escape(first.label)} for trial ${trial.id}"></video>
    <p class="modal-note">Sample ${escape(trial.sample)} · <span data-video-duration>${duration(first.seconds)}</span> runtime</p>
    <div class="detail-actions"><button class="primary" data-trial="${trial.id}" type="button">Trial datasheet</button>
    <a class="citation" data-video-source href="${escape(first.source)}" target="_blank" rel="noreferrer">Source archive ↗</a>
    ${trial.report ? citation(trial.report) : ""}</div>`, trigger);
  const picker = modalBody.querySelector(".recording-picker select");
  picker?.addEventListener("change", () => {
    const recording = recordings[Number(picker.value)];
    const video = modalBody.querySelector("video");
    video.src = `media/${recording.file}`;
    video.setAttribute("aria-label", `${recording.label} for trial ${trial.id}`);
    modalBody.querySelector("[data-video-duration]").textContent = duration(recording.seconds);
    modalBody.querySelector("[data-video-source]").href = recording.source;
  });
}

const observation = (trial) => trial.report?.observation || "No linked observation found in Appendix A.";
const undocumented = "Unknown";
const extinctionLabels = new Map(Object.entries({
  flow_cutoff: "Airflow cut off",
  flow_reduced: "Airflow reduced",
  blowoff: "Blown out by airflow",
  self_extinguished: "Self-extinguished",
  fuel_consumed: "Fuel consumed",
  igniter_removed: "Igniter removed",
  igniter_still_on: "Extinguished with igniter still on",
  transient_flame: "Brief flame",
  method_unspecified: "Extinguished (method unspecified)",
  not_extinguished: "Did not extinguish during trial",
  not_applicable: "Not applicable (did not ignite)",
}));
const outcomeFields = [
  ["Ignited", (trial) => outcomeStatus(trial.ignited)],
  ["Spread", (trial) => outcomeStatus(trial.spread)],
  ["Extinction", (trial) => extinctionLabels.get(trial.extinction) ?? undocumented],
];
const gasNames = ["Initial calibrated O₂ (%)", "Final calibrated O₂ (%)", "Initial CO₂ (%)", "Final CO₂ (%)", "Initial CO (ppm)", "Final CO (ppm)"];
const gasValue = (trial, index) => trial.gasReadings?.[index];

function showTrial(trial, trigger) {
  showModal(`Trial ${trial.id} · Sample ${trial.sample}`, `
    <p><strong>${escape(trial.material)}</strong> · ${escape(trial.pi)}</p>
    <section class="outcome-summary" aria-labelledby="outcome-heading">
      <h3 id="outcome-heading">Trial outcome</h3>
      <dl class="facts">${outcomeFields.map(([label, value]) => formatField(label, value(trial))).join("")}</dl>
    </section>
    <dl class="facts">
      ${formatField("Material family", formatFamily(trial.family))}
      ${formatField("Flow direction", formatDirection(trial.report?.direction))}
      ${formatField("Air display · original", trial.air)}
      ${formatField("Air reading type", airReading(trial.air).status)}
      ${formatField("Flow restrictor · original", trial.restrictor)}
      ${formatField("Fan display · original", trial.fan)}
      ${gasNames.map((name, index) => formatField(name, gasValue(trial, index))).join("")}
    </dl>
    <h3>Report Observation</h3><p lang="en">${escape(observation(trial))}</p>
    <div class="detail-actions">
      ${trial.report ? citation(trial.report) : ""}
      ${trial.video ? `<button type="button" class="primary" data-video="${trial.id}">Watch recording</button>` : ""}
    </div>`, trigger);
}

const comparisonRecords = () => [...selected].map((id) => trials.find((trial) => trial.id === id));
const gasFields = gasNames.map((name, index) => [name, (trial) => gasValue(trial, index)]);
const conditionFields = [
  ["Material", (trial) => trial.material],
  ["Family", (trial) => formatFamily(trial.family)],
  ["Sample", (trial) => trial.sample],
  ["Flow direction", (trial) => trial.report?.direction ? formatDirection(trial.report.direction) : null],
  ["Air display · original", (trial) => trial.air],
  ["Air reading type", (trial) => airReading(trial.air).status],
  ["Fan display · original", (trial) => trial.fan],
  ["Flow restrictor · original", (trial) => trial.restrictor],
  gasFields[0],
];

function comparisonRow(label, getter, records, condition) {
  const values = records.map(getter);
  const known = values.filter((value) => !isMissing(value));
  const differs = condition && new Set(known.map((value) => normalize(String(value)))).size > 1;
  const badge = differs ? '<span class="comparison-difference">Differs</span>' : "";
  const cells = values.map((value) => isMissing(value)
    ? '<td class="muted">No data</td>' : `<td>${escape(value)}</td>`).join("");
  return `<tr><th scope="row">${label}${badge}</th>${cells}</tr>`;
}

function compare(trigger) {
  const records = comparisonRecords();
  const rows = (fields, condition) => fields.map(([label, getter]) =>
    comparisonRow(label, getter, records, condition)).join("");
  const summary = ["Yes", "No", "Unknown"].map((status) => {
    const count = records.filter((trial) => outcomeStatus(trial.spread) === status).length;
    return `${status} ${count}/${records.length}`;
  }).join(" · ");
  showModal("Compare Trials", `
    <div class="comparison-summary"><strong>Recorded flame spread</strong><p>${summary}</p></div>
    <p class="modal-note">Differences mark distinct recorded conditions. Air entries preserve sequences, settings and notes.</p>
    <div class="table-scroll" role="region" aria-label="Trial comparison" tabindex="0">
      <table class="compare-table">
        <thead><tr><th scope="col">Variable</th>${records.map((trial) => `<th scope="col">${escape(trial.id)}</th>`).join("")}</tr></thead>
        <tbody>${rows(conditionFields, true)}
        ${rows([...outcomeFields, ...gasFields.slice(1), ["Report observation", (trial) => trial.report?.observation]])}
        <tr><th scope="row">Source</th>${records.map((trial) =>
          `<td>${trial.report ? citation(trial.report) : '<span class="muted">No appendix link</span>'}</td>`).join("")}</tr></tbody>
      </table>
    </div>
    <div class="detail-actions"><button class="primary" id="export-comparison" type="button">Download comparison CSV</button></div>`, trigger);
}

function csvCell(value) {
  const raw = String(value ?? "");
  const formula = /^[\s\p{Cc}]*[=+@-]/u.test(raw) && !/^-?\d+(?:\.\d+)?$/.test(raw);
  return `"${formula ? "'" : ""}${raw.replaceAll('"', '""')}"`;
}

function downloadCsv(records, filename) {
  const fields = [
    ["Trial", (trial) => trial.id], ...conditionFields, ...outcomeFields, ...gasFields.slice(1),
    ["PI", (trial) => trial.pi], ["Date", (trial) => trial.date], ["GMT day", (trial) => trial.gmt],
    ["Air single reading (cm/s)", (trial) => airReading(trial.air).value],
    ["PSI CSV line", (trial) => trial.csvLine],
    ["NASA table", (trial) => trial.report?.table], ["NASA printed page", (trial) => trial.report?.page],
    ["NASA source", (trial) => trial.report ? reportLink(trial.report) : ""],
    ["Report observation", (trial) => trial.report?.observation],
  ];
  const rows = [fields.map(([label]) => label), ...records.map((trial) => fields.map(([, getter]) => getter(trial)))];
  const url = URL.createObjectURL(new Blob(["\uFEFF", rows.map((row) => row.map(csvCell).join(",")).join("\r\n"), "\r\n"],
    { type: "text/csv;charset=utf-8" }));
  const download = document.createElement("a");
  download.href = url;
  download.download = filename;
  download.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function displayAnswer(result) {
  const mode = result.mode === "ai" ? "AI Response" : "Document Search";
  byId("answer").innerHTML = `<div class="answer-mode">${mode}</div>` +
    (result.note ? `<p class="muted">${escape(result.note)}</p>` : "") +
    result.claims.map(({ text, sources }) => `<article><p>${escape(text)}</p>${
      sources.length ? `<div class="citations">${sources.map((source) => citation(source, source.id || "NASA")).join("")}</div>` : ""
    }</article>`).join("");
}

// The report and guide passages are only needed when the AI service is unavailable.
let passagesLoaded = false;
async function loadPassages() {
  if (passagesLoaded) return;
  try {
    const response = await fetch("chunks.json");
    if (response.ok) { loadIndex({ chunks: await response.json() }); passagesLoaded = true; }
  } catch { /* keep the trial-only search */ }
}

async function ask() {
  const question = byId("question").value.trim();
  if (!question || pending || !trials.length) return;
  pending = true;
  byId("ask").disabled = true;
  byId("answer").textContent = "Searching NASA documents…";
  try {
    const response = await fetch("/api/ask", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }), signal: AbortSignal.timeout(35000),
    });
    if (!response.ok) throw new Error("Unavailable");
    displayAnswer(await response.json());
  } catch {
    await loadPassages();
    displayAnswer(findEvidence(question, trials, "Generative AI is unavailable in this session. Showing matching passages from the NASA documents."));
  } finally {
    pending = false;
    byId("ask").disabled = false;
  }
}

/* ==========================================================================
   EXPLORATION ADVISOR (MOON, MARS & EVA) & DECADES OF NASA COMBUSTION
   ========================================================================== */

const EXPLORATION_ENVIRONMENTS = {
  iss: {
    name: "ISS & LEO Transit",
    badge: "Microgravity",
    pressure: "101.3 kPa · 14.7 psia (nominal ISS)",
    oxygen: "21% O₂ (nominal ISS)",
    scope: "BASS-II tested small samples under controlled airflow in the ISS Microgravity Science Glovebox, with initial oxygen varied between trials.",
    evidence: "In B1, a 100 µm PMMA film flame extinguished quickly after airflow was cut when it had spread about halfway along the sample.",
    url: reportLink({ pdfPage: 111 }),
    source: "NASA BASS-II, Table A.1, p. 103",
  },
  lunar: {
    name: "Lunar Habitat",
    badge: "Partial gravity · about 1/6g",
    pressure: "56.5 kPa · 8.2 psia (reference)",
    oxygen: "34% O₂ (reference)",
    scope: "NASA studied this reference atmosphere for exploration habitat and EVA planning. BASS-II measured combustion in ISS microgravity.",
    evidence: "The BASS-II PMMA comparison used the ISS and a downward terrestrial configuration. Lunar flame spread remains outside that comparison.",
    url: reportLink({ pdfPage: 48 }),
    source: "NASA BASS-II, §2.3.7, p. 40",
    atmosphereUrl: "https://ntrs.nasa.gov/citations/20240003211",
  },
  mars: {
    name: "Mars Surface Habitat",
    badge: "Partial gravity · about 0.38g",
    pressure: "Depends on habitat design",
    oxygen: "Depends on habitat design",
    scope: "Mars surface gravity differs from the conditions of the ISS experiments. Habitat pressure and oxygen depend on the vehicle design.",
    evidence: "The BASS-II dataset leaves flame spread at martian gravity and fire behavior in a Mars habitat unresolved.",
    url: "https://science.nasa.gov/biological-physical/investigations/sofie/",
    source: "NASA SoFIE research objectives",
  },
  eva: {
    name: "Exploration EVA Suit",
    badge: "Suit atmosphere",
    pressure: "29.6 kPa · 4.3 psia (reference)",
    oxygen: "Depends on suit design",
    scope: "NASA used 4.3 psia as a reference suit pressure in exploration prebreathe research.",
    evidence: "BASS-II measured small samples in the ISS glovebox. Suit-loop airflow, pressure and oxygen require separate evidence.",
    url: "https://ntrs.nasa.gov/citations/20220009546",
    source: "NASA exploration prebreathe study",
  },
};

const NASA_DECADAL_ERAS = [
  {
    id: "drop",
    source: "https://www.nasa.gov/centers-and-facilities/glenn/zero-gravity-research-facility/",
    decade: "1960s–1980s",
    title: "The Drop Tower Era",
    facility: "NASA Glenn 2.2s & 5.18s Facilities",
    icon: "⏱",
    discovery: "Short-duration microgravity experiments on the ground.",
    narrative: "NASA Glenn’s vacuum drop tower provides 5.18 seconds of near weightlessness for research, including combustion studies.",
    legacy: "Laid the theoretical foundation for microgravity diffusion flames and zero-g droplet combustion."
  },
  {
    id: "shuttle",
    source: "https://ntrs.nasa.gov/citations/19990019803",
    decade: "1990s",
    title: "Space Shuttle & Spacelab Missions",
    facility: "STS-83 and STS-94",
    icon: "🚀",
    discovery: "SOFBALL studied spherical flames in lean gas mixtures.",
    narrative: "Spacelab missions carried combustion chambers in the Shuttle cargo bay. SOFBALL used the Shuttle to observe low-power spherical flames in microgravity.",
    legacy: "Proved that lean flammability limits extend significantly in low gravity."
  },
  {
    id: "iss",
    source: "https://www.nasa.gov/missions/station/studying-combustion-and-fire-safety/",
    decade: "2008–2020",
    title: "The ISS Combustion Era (BASS & BASS-II)",
    facility: "Combustion Integrated Rack (CIR) & MSG",
    icon: "🛰",
    discovery: "Cool flames discovery (FLEX) and solid flammability atlas (BASS-II: 129 trials).",
    narrative: "FLEX observed cool burning in liquid fuel droplets after the visible flame went out. BASS-II studied small solid samples in the Microgravity Science Glovebox. The PSI table used here contains 129 records.",
    legacy: "Produced the core experimental dataset powering this dashboard and modern spacecraft safety standards."
  },
  {
    id: "saffire",
    source: "https://www.nasa.gov/centers-and-facilities/glenn/flame-burns-out-on-nasas-long-running-spacecraft-fire-experiment/",
    decade: "2016–2024",
    title: "Project Saffire (Large-Scale Fires)",
    facility: "Cygnus Automated Cargo Spacecraft",
    icon: "🔥",
    discovery: "Saffire studied larger fires aboard uncrewed Cygnus cargo spacecraft.",
    narrative: "After Cygnus vehicles departed the ISS and before atmospheric re-entry, ground controllers ignited large fabric and PMMA arrays (Saffire I through VI). The series measured flame spread and combustion products in the spacecraft.",
    legacy: "Bridged small-scale lab tests to real spacecraft emergency ventilation and fire suppression design."
  },
  {
    id: "artemis",
    source: "https://science.nasa.gov/biological-physical/investigations/sofie/",
    decade: "2022 onward",
    title: "Artemis, SoFIE & Moon/Mars Exploration",
    facility: "ISS CIR / Artemis Gateway & Lunar Base",
    icon: "🌕",
    discovery: "SoFIE varies oxygen and pressure to study solid-fuel ignition and extinction in microgravity.",
    narrative: "The SoFIE insert in the ISS Combustion Integrated Rack supports research on solid samples under different oxygen concentrations and pressures.",
    legacy: "Informs future studies of spacecraft material flammability and fire safety."
  }
];

function renderExplorationAdvisor(envKey = "iss") {
  const env = EXPLORATION_ENVIRONMENTS[envKey] || EXPLORATION_ENVIRONMENTS.iss;
  const navEl = byId("env-nav");
  if (navEl) {
    for (const btn of navEl.querySelectorAll(".env-tab")) {
      const active = btn.dataset.env === envKey;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    }
  }
  const displayEl = byId("env-display");
  if (!displayEl) return;
  displayEl.setAttribute("aria-labelledby", `tab-${envKey}`);
  displayEl.innerHTML = `
    <div class="env-card">
      <div class="env-card-header">
        <div>
          <span class="env-badge">${escape(env.badge)}</span>
          <h3>${escape(env.name)}</h3>
        </div>
      </div>
      <div class="env-metrics-grid">
        <div class="env-metric"><span class="mono muted">TOTAL PRESSURE</span><strong>${escape(env.pressure)}</strong></div>
        <div class="env-metric"><span class="mono muted">O₂ CONCENTRATION</span><strong class="env-val-o2">${escape(env.oxygen)}</strong></div>
      </div>
      <div class="env-analysis-grid">
        <div class="env-box">
          <h4>Scenario</h4>
          <p>${escape(env.scope)}</p>
          ${env.atmosphereUrl ? `<a class="citation" href="${env.atmosphereUrl}" target="_blank" rel="noreferrer">NASA exploration atmosphere ↗</a>` : ""}
        </div>
        <div class="env-box env-rule-box">
          <h4>Scope of BASS-II evidence</h4>
          <p>${escape(env.evidence)}</p>
          <a class="citation" href="${env.url}" target="_blank" rel="noreferrer">${escape(env.source)} ↗</a>
        </div>
      </div>
    </div>
  `;
}

function renderTimeline(eraId = "iss") {
  const navEl = byId("timeline-nav");
  if (navEl) {
    navEl.innerHTML = NASA_DECADAL_ERAS.map((era) => {
      const active = era.id === eraId;
      return `<button type="button" role="tab" class="timeline-tab ${active ? "active" : ""}" data-era="${escape(era.id)}" aria-selected="${active}">
        <span class="timeline-tab-era mono">${escape(era.decade)}</span>
        <span class="timeline-tab-title">${escape(era.title)}</span>
      </button>`;
    }).join("");
  }
  const cardEl = byId("timeline-card");
  if (!cardEl) return;
  const era = NASA_DECADAL_ERAS.find((e) => e.id === eraId) || NASA_DECADAL_ERAS[2];
  cardEl.innerHTML = `
    <div class="timeline-detail">
      <div class="timeline-detail-head">
        <div class="timeline-era-pill mono">${escape(era.icon)} ${escape(era.decade)}</div>
        <h3>${escape(era.title)}</h3>
        <span class="timeline-facility mono">FACILITY: ${escape(era.facility)}</span>
      </div>
      <div class="timeline-discovery-banner">
        <strong>Pivotal Discovery:</strong> ${escape(era.discovery)}
      </div>
      <p class="timeline-narrative">${escape(era.narrative)}</p>
      <div class="timeline-legacy">
        <strong class="mono">MISSION ARCHITECTURE RELEVANCE:</strong>
        <p>${escape(era.legacy)}</p>
        <a class="citation" href="${era.source}" target="_blank" rel="noreferrer">NASA ↗</a>
      </div>
    </div>
  `;
}

/* ==========================================================================
   EVENT LISTENERS & INITIALIZATION
   ========================================================================== */

byId("filters").addEventListener("submit", (event) => event.preventDefault());
const refreshFilters = () => { page = 1; renderTable(); };
byId("query").addEventListener("input", refreshFilters);
for (const id of ["material", "oxygen", "flow", "video-only"]) byId(id).addEventListener("change", refreshFilters);

byId("reset-filters").addEventListener("click", () => {
  byId("filters").reset();
  byId("video-only").checked = false;
  refreshFilters();
  byId("query").focus();
});
byId("reset-map-filter").addEventListener("click", () => setMapMaterialFilter("", true));
byId("toggle-regimes")?.addEventListener("click", () => {
  showExtinctionReference = !showExtinctionReference;
  const btn = byId("toggle-regimes");
  if (btn) {
    btn.setAttribute("aria-pressed", String(showExtinctionReference));
    btn.textContent = showExtinctionReference ? "Hide PMMA reference" : "Show PMMA reference";
  }
  byId("extinction-reference").hidden = !showExtinctionReference;
  renderFlammabilityMap();
});

byId("prev").addEventListener("click", () => { page -= 1; renderTable(); });
byId("next").addEventListener("click", () => { page += 1; renderTable(); });
byId("sort-oxygen").addEventListener("click", () => { sort = sort === 1 ? -1 : sort + 1; refreshFilters(); });
byId("trial-rows").addEventListener("change", (event) => {
  const input = event.target;
  if (input.checked && selected.size < 3) selected.add(input.value);
  if (!input.checked) selected.delete(input.value);
  updateSelection();
});
byId("export-filtered").addEventListener("click", () => downloadCsv(filteredTrials(), "bass-ii-filtered.csv"));
byId("compare").addEventListener("click", (event) => compare(event.currentTarget));
byId("reset-selection").addEventListener("click", () => {
  selected.clear();
  updateSelection();
  byId("query").focus();
});
byId("ask-form").addEventListener("submit", (event) => { event.preventDefault(); ask(); });

document.addEventListener("click", (event) => {
  const envTab = event.target.closest("[data-env]");
  if (envTab) {
    renderExplorationAdvisor(envTab.dataset.env);
    return;
  }
  const eraTab = event.target.closest("[data-era]");
  if (eraTab) {
    renderTimeline(eraTab.dataset.era);
    return;
  }
  const mapPill = event.target.closest("[data-map-material]");
  if (mapPill) {
    setMapMaterialFilter(mapPill.dataset.mapMaterial, false);
    [...byId("chart-legend").children]
      .find((button) => button.dataset.mapMaterial === mapPill.dataset.mapMaterial)?.focus();
    return;
  }
  const materialButton = event.target.closest("[data-outcome-material]");
  if (materialButton) {
    setMapMaterialFilter(materialButton.dataset.outcomeMaterial, true);
    [...byId("outcome-rows").querySelectorAll("button")]
      .find((button) => button.dataset.outcomeMaterial === materialButton.dataset.outcomeMaterial)?.focus();
    return;
  }
  if (event.target.closest("#export-comparison")) {
    downloadCsv(comparisonRecords(), "bass-ii-comparison.csv");
    return;
  }
  const trigger = event.target.closest("[data-trial], [data-video], [data-question]");
  if (!trigger) return;
  if (trigger.dataset.question && !pending) {
    byId("question").value = trigger.dataset.question;
    ask();
    return;
  }
  const trial = trials.find((item) => item.id === (trigger.dataset.video || trigger.dataset.trial));
  if (trial && trigger.dataset.video) showVideo(trial, trigger);
  else if (trial) showTrial(trial, trigger);
});

modal.addEventListener("close", () => { modalBody.replaceChildren(); requester?.focus(); });

try {
  const response = await fetch("trials.json");
  if (!response.ok) throw new Error("Data unavailable");
  trials = await response.json();
  const ordered = new Map(["B1", "B3", "F1"].map((id, index) => [id, index]));
  trials.sort((a, b) => (ordered.get(a.id) ?? 100) - (ordered.get(b.id) ?? 100));

  const families = [...new Set(trials.map((trial) => trial.family))]
    .sort((a, b) => formatFamily(a).localeCompare(formatFamily(b), "en"));
  families.forEach((family, idx) => {
    materialColors.set(family, MATERIAL_PALETTE[idx % MATERIAL_PALETTE.length]);
    byId("material").add(new Option(formatFamily(family), family));
  });

  byId("total-trials").textContent = trials.length;

  renderLegend(families);
  renderFlammabilityMap();
  renderOutcomes();
  renderExplorationAdvisor("iss");
  renderTimeline("iss");
  renderTable();
  renderRecordings();
} catch {
  byId("result-count").textContent = "Failed to load trial records. Please reload the page.";
}