import { findEvidence, loadIndex, reportLink } from "./evidence.js";

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

function formatFamily(raw) {
  const map = {
    "Varilla sin polímero explícito": "Polymer rod (unspecified)",
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

function parseNumeric(raw) {
  if (raw == null) return null;
  const str = String(raw).trim();
  if (!str || /^(?:none|n\/?a|-+)$/i.test(str)) return null;
  const match = str.match(/-?\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

function citation(source, prefix = "NASA") {
  const label = source.table ? `${prefix} · ${source.table} · p. ${source.page}` : `${prefix} · p. ${source.page}`;
  return `<a class="citation" href="${reportLink(source)}" target="_blank" rel="noreferrer">${escape(label)} ↗</a>`;
}

function formatField(label, value) {
  return `<div><dt>${label}</dt><dd>${escape(value || "No data")}</dd></div>`;
}

/* ==========================================================================
   FLAMMABILITY MAP (OXYGEN VS. AIRFLOW BY MATERIAL) & HAZARD RANKING
   ========================================================================== */

// Outcome of a trial from the structured fields extracted from Appendix A (part B).
// "brief" = a flash or a flame that only lived while the igniter was on.
const BRIEF_FLAME = new Set(["transient_flame", "igniter_still_on", "igniter_removed"]);
function outcomeOf(trial) {
  if (trial.ignited === false) return "none";
  if (trial.ignited === true) return BRIEF_FLAME.has(trial.extinction) ? "brief" : "sustained";
  return "undocumented";
}
const OUTCOME_LABEL = {
  sustained: "Sustained flame",
  brief: "Brief flame only",
  none: "Did not ignite",
  undocumented: "Outcome not documented",
};

function computeMaterialStats() {
  const groups = new Map();
  for (const t of trials) {
    const family = t.family || "Unknown";
    if (!groups.has(family)) groups.set(family, []);
    groups.get(family).push(t);
  }

  const stats = [];
  for (const [family, list] of groups.entries()) {
    const documented = list.filter((t) => outcomeOf(t) !== "undocumented");
    const sustained = list.filter((t) => outcomeOf(t) === "sustained");
    const sustainedO2 = sustained.map((t) => t.initialO2).filter((v) => v != null);
    const flowValues = list.map((t) => parseNumeric(t.air)).filter((v) => v != null);

    // Oxygen consumed during the test (excluding sensor glitches where final O2 drops below 10%)
    const deltaO2List = list.map((t) => {
      const init = parseNumeric(t.gasReadings?.[0]) ?? t.initialO2;
      const fin = parseNumeric(t.gasReadings?.[1]);
      if (init == null || fin == null || fin < 10 || fin > init) return null;
      const delta = init - fin;
      return delta <= 6 ? delta : null;
    }).filter((v) => v != null);

    // Lowest oxygen at which a flame was actually sustained (not merely the lowest level tested).
    const minBurnO2 = sustainedO2.length ? Math.min(...sustainedO2) : null;
    const sustainRate = documented.length ? sustained.length / documented.length : 0;
    const avgDeltaO2 = deltaO2List.length ? deltaO2List.reduce((a, b) => a + b, 0) / deltaO2List.length : 0;

    // Heuristic score (0-100), built only from documented outcomes:
    // 1. Lowest O2 with a sustained flame: the lower, the riskier (up to 55 pts)
    // 2. Share of documented trials with a sustained flame (up to 30 pts)
    // 3. Mean oxygen consumed per test (up to 15 pts)
    const o2Risk = minBurnO2 == null ? 0 : Math.max(0, Math.min(55, ((22.5 - minBurnO2) / 9.0) * 55));
    const hazardScore = Math.round(o2Risk + sustainRate * 30 + Math.min(15, avgDeltaO2 * 14));

    let tier = { label: "Low", className: "risk-low" };
    if (hazardScore >= 72) tier = { label: "Critical", className: "risk-critical" };
    else if (hazardScore >= 56) tier = { label: "High", className: "risk-high" };
    else if (hazardScore >= 40) tier = { label: "Moderate", className: "risk-moderate" };

    stats.push({
      family,
      label: formatFamily(family),
      count: list.length,
      documented: documented.length,
      sustained: sustained.length,
      minBurnO2,
      minFlow: flowValues.length ? Math.min(...flowValues) : null,
      maxFlow: flowValues.length ? Math.max(...flowValues) : null,
      lowConfidence: documented.length < 5,
      hazardScore,
      tier
    });
  }

  return stats.sort((a, b) => b.hazardScore - a.hazardScore || (a.minBurnO2 ?? 99) - (b.minBurnO2 ?? 99));
}

function renderHazardRanking(stats) {
  const listEl = byId("hazard-list");
  listEl.innerHTML = stats.map((item, idx) => {
    const color = materialColors.get(item.family) || "#d6f682";
    const o2Range = item.minBurnO2 != null ? `Sustained down to ${number.format(item.minBurnO2)}% O₂` : "No sustained flame";
    const flowRange = (item.minFlow != null && item.maxFlow != null)
      ? (item.minFlow === item.maxFlow ? `Flow: ${number.format(item.minFlow)} cm/s` : `Flow: ${number.format(item.minFlow)}–${number.format(item.maxFlow)} cm/s`)
      : "Flow: —";
    const evidence = `${item.sustained}/${item.documented} documented trials burned (${item.count} total)`;
    const isActive = activeMapMaterial === item.family;

    return `<li class="hazard-item">
      <button type="button" class="hazard-btn ${isActive ? "active" : ""}" data-rank-material="${escape(item.family)}">
        <span class="hazard-rank">#${idx + 1}</span>
        <div class="hazard-info">
          <strong><i class="legend-dot" style="background:${color}"></i>${escape(item.label)}</strong>
          <div class="hazard-meta">
            <span>${o2Range}</span>
            <span>${flowRange}</span>
            <span>${evidence}</span>
            ${item.lowConfidence ? '<span class="low-confidence">Few trials · low confidence</span>' : ""}
          </div>
        </div>
        <span class="risk-badge ${item.tier.className}">${item.tier.label} · ${item.hazardScore}</span>
      </button>
    </li>`;
  }).join("");
}

function renderLegend(families) {
  const legendEl = byId("chart-legend");
  legendEl.innerHTML = families.map((family) => {
    const color = materialColors.get(family);
    const active = activeMapMaterial === family;
    const dimmed = activeMapMaterial && !active;
    return `<button type="button" class="legend-pill ${active ? "active" : ""} ${dimmed ? "dimmed" : ""}" data-map-material="${escape(family)}">
      <span class="legend-dot" style="background:${color}"></span>
      <span>${escape(formatFamily(family))}</span>
    </button>`;
  }).join("");
  byId("reset-map-filter").hidden = !activeMapMaterial;
}

function renderFlammabilityMap() {
  const svg = byId("flam-svg");
  const tooltip = byId("chart-tooltip");
  const points = trials
    .map((t) => ({ trial: t, o2: t.initialO2, flow: parseNumeric(t.air) }))
    .filter((d) => d.o2 != null && d.flow != null);

  byId("plotted-count").textContent = `${points.length} of ${trials.length} trials plotted (numeric O₂ & airflow)`;

  const W = 760, H = 400;
  const pad = { top: 22, right: 26, bottom: 52, left: 62 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const maxFlowRaw = points.length ? Math.max(...points.map((p) => p.flow)) : 50;
  const minFlowRaw = points.length ? Math.min(0, ...points.map((p) => p.flow)) : 0;
  const xMin = Math.floor(minFlowRaw);
  const xMax = Math.ceil((maxFlowRaw + 2) / 5) * 5;

  // The axis reaches 32% so the planned lunar habitat atmosphere (≥30% O₂) is visible next to the data.
  const yMin = 12;
  const yMax = 32;

  const xScale = (v) => pad.left + ((v - xMin) / Math.max(1, xMax - xMin)) * plotW;
  const yScale = (v) => pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const yTicks = [12, 16, 20, 24, 28, 32];
  const xStep = xMax <= 25 ? 5 : xMax <= 60 ? 10 : 15;
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

  const tested = points.map((p) => p.o2);
  const testedTop = tested.length ? Math.max(...tested) : 22.2;
  const gapTop = yScale(yMax);
  markup += `<rect class="chart-gap" x="${pad.left}" y="${yScale(30)}" width="${plotW}" height="${yScale(testedTop) - yScale(30)}" />`;
  markup += `<rect class="chart-lunar" x="${pad.left}" y="${gapTop}" width="${plotW}" height="${yScale(30) - gapTop}" />`;
  markup += `<text class="chart-lunar-label" x="${pad.left + 12}" y="${gapTop + 20}">PLANNED LUNAR HABITAT · ≥30% O₂ AT ≤10.2 PSI · NO BASS-II DATA</text>`;
  markup += `<text class="chart-gap-label" x="${pad.left + 12}" y="${(yScale(30) + yScale(testedTop)) / 2 + 4}">UNTESTED ABOVE ${number.format(testedTop)}% O₂</text>`;

  for (const ref of [{ val: 21, label: "21% Earth O₂" }, { val: 18, label: "18% Threshold" }]) {
    const y = yScale(ref.val);
    markup += `<line class="chart-ref-line" x1="${pad.left}" y1="${y}" x2="${W - pad.right}" y2="${y}" />`;
    markup += `<text class="chart-axis-label" x="${W - pad.right - 4}" y="${y - 5}" text-anchor="end">${ref.label}</text>`;
  }

  markup += `<text class="chart-axis-title" x="${pad.left + plotW / 2}" y="${H - 10}" text-anchor="middle">Initial airflow reading (cm/s)</text>`;
  markup += `<text class="chart-axis-title" transform="rotate(-90)" x="${-(pad.top + plotH / 2)}" y="18" text-anchor="middle">Initial O₂ (%)</text>`;

  const orderedPoints = [...points].sort((a, b) => {
    const aAct = a.trial.family === activeMapMaterial ? 1 : 0;
    const bAct = b.trial.family === activeMapMaterial ? 1 : 0;
    return aAct - bAct;
  });

  for (const { trial, o2, flow } of orderedPoints) {
    const cx = xScale(flow);
    const cy = yScale(o2);
    const color = materialColors.get(trial.family) || "#d6f682";
    const familyLabel = formatFamily(trial.family);
    const isDimmed = activeMapMaterial && trial.family !== activeMapMaterial;
    const r = isDimmed ? 4.2 : 6;
    const opacity = isDimmed ? 0.22 : 0.92;
    const outcome = outcomeOf(trial);
    // Filled = sustained flame; ring = brief flame or no ignition; dashed ring = outcome not documented.
    const fill = outcome === "sustained" ? color : "transparent";
    markup += `<circle class="chart-point outcome-${outcome}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="${fill}" stroke="${color}" fill-opacity="${opacity}" stroke-opacity="${opacity}" tabindex="0" data-point-id="${escape(trial.id)}" aria-label="Trial ${escape(trial.id)}: ${escape(familyLabel)}, ${o2}% O2, ${flow} cm/s, ${OUTCOME_LABEL[outcome]}" />`;
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
      <span>Outcome: ${OUTCOME_LABEL[outcomeOf(trial)]}</span>
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
  svg.onclick = (event) => {
    const circle = event.target.closest(".chart-point");
    if (!circle) return;
    const trial = trials.find((t) => t.id === circle.dataset.pointId);
    if (trial) showTrial(trial, circle);
  };
}

function setMapMaterialFilter(family, syncTable = false) {
  activeMapMaterial = activeMapMaterial === family ? "" : family;
  renderLegend([...materialColors.keys()]);
  renderFlammabilityMap();
  renderHazardRanking(computeMaterialStats());

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
const undocumented = "Unconfirmed";
const yesNo = (value) => value === true ? "Yes" : value === false ? "No" : undocumented;
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
  ["Ignited", (trial) => yesNo(trial.ignited)],
  ["Spread", (trial) => yesNo(trial.spread)],
  ["Extinction", (trial) => extinctionLabels.get(trial.extinction) ?? undocumented],
];
const gasNames = ["Initial calibrated O₂ (%)", "Final calibrated O₂ (%)", "Initial CO₂ (%)", "Final CO₂ (%)", "Initial CO (ppm)", "Final CO (ppm)"];
const gasValue = (trial, index) => /^(?:none|n\/?a|-*)$/i.test(trial.gasReadings[index]) ? "No data" : trial.gasReadings[index];

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
      ${formatField("Fan display · original", trial.fan)}
      ${gasNames.map((name, index) => formatField(name, gasValue(trial, index))).join("")}
    </dl>
    <h3>Report Observation</h3><p lang="en">${escape(observation(trial))}</p>
    <div class="detail-actions">
      ${trial.report ? citation(trial.report) : ""}
      ${trial.video ? `<button type="button" class="primary" data-video="${trial.id}">Watch recording</button>` : ""}
    </div>`, trigger);
}

function compare(trigger) {
  const records = Array.from(selected, (id) => trials.find((trial) => trial.id === id));
  const fields = [
    ["Material", (trial) => trial.material],
    ["Family", (trial) => formatFamily(trial.family)],
    ["Sample", (trial) => trial.sample],
    ...outcomeFields,
    ["Flow direction", (trial) => formatDirection(trial.report?.direction)],
    ["Air display · original", (trial) => trial.air || "No data"],
    ...gasNames.map((name, index) => [name, (trial) => gasValue(trial, index)]),
    ["Report observation", observation],
  ];
  showModal("Compare Trials", `
    <div class="table-scroll" role="region" aria-label="Trial comparison" tabindex="0">
      <table class="compare-table">
        <thead><tr><th scope="col">Variable</th>${records.map((trial) => `<th scope="col">${trial.id}</th>`).join("")}</tr></thead>
        <tbody>${fields.map(([label, getter]) => `<tr><th scope="row">${label}</th>${records.map((trial) => `<td>${escape(getter(trial))}</td>`).join("")}</tr>`).join("")}
        <tr><th scope="row">Source</th>${records.map((trial) => `<td>${trial.report ? citation(trial.report) : "No appendix link"}</td>`).join("")}</tr></tbody>
      </table>
    </div><p class="modal-note">Readings are displayed as recorded in the PSI dataset and include values pending verification.</p>`, trigger);
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

byId("prev").addEventListener("click", () => { page -= 1; renderTable(); });
byId("next").addEventListener("click", () => { page += 1; renderTable(); });
byId("sort-oxygen").addEventListener("click", () => { sort = sort === 1 ? -1 : sort + 1; refreshFilters(); });
byId("trial-rows").addEventListener("change", (event) => {
  const input = event.target;
  if (input.checked && selected.size < 3) selected.add(input.value);
  if (!input.checked) selected.delete(input.value);
  updateSelection();
});
byId("compare").addEventListener("click", (event) => compare(event.currentTarget));
byId("reset-selection").addEventListener("click", () => {
  selected.clear();
  updateSelection();
  byId("query").focus();
});
byId("ask-form").addEventListener("submit", (event) => { event.preventDefault(); ask(); });

document.addEventListener("click", (event) => {
  const mapPill = event.target.closest("[data-map-material]");
  if (mapPill) {
    setMapMaterialFilter(mapPill.dataset.mapMaterial, false);
    return;
  }
  const rankBtn = event.target.closest("[data-rank-material]");
  if (rankBtn) {
    setMapMaterialFilter(rankBtn.dataset.rankMaterial, true);
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

  const stats = computeMaterialStats();
  renderLegend(families);
  renderFlammabilityMap();
  renderHazardRanking(stats);
  renderTable();
  renderRecordings();
} catch {
  byId("result-count").textContent = "Failed to load trial records. Please reload the page.";
}