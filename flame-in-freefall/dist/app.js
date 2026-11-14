import { findEvidence, reportLink } from "./evidence.js";

const byId = (id) => document.getElementById(id);
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[c]);
const normalize = (value) => value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
const number = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const oxygen = (value) => value == null ? "—" : `${number.format(value)} %`;
const PAGE_SIZE = 7;
const selected = new Set();
const modal = byId("modal");
const modalBody = byId("modal-body");
let trials = [];
let page = 1;
let sort = 0;
let requester;
let pending = false;

function citation(source, prefix = "NASA") {
  const label = source.table ? `${prefix} · ${source.table} · p. ${source.page}` : `${prefix} · p. ${source.page}`;
  return `<a class="citation" href="${reportLink(source)}" target="_blank" rel="noreferrer">${escape(label)} ↗</a>`;
}

function formatField(label, value) {
  return `<div><dt>${label}</dt><dd>${escape(value || "Sin dato")}</dd></div>`;
}

function filteredTrials() {
  const query = normalize(byId("query").value.trim()).split(/\s+/).filter(Boolean);
  const material = byId("material").value;
  const band = byId("oxygen").value;
  const flow = byId("flow").value;
  const videoOnly = byId("video-only").checked;
  const filtered = trials.filter((trial) => {
    const searchable = normalize(`${trial.id} muestra ${trial.sample} ${trial.family} ${trial.material} ${trial.pi}`);
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
  byId("selected").textContent = selected.size === 3 ? "3 seleccionados · máximo" : `${selected.size} seleccionados`;
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
    <td><input type="checkbox" value="${escape(trial.id)}" aria-label="Seleccionar ensayo ${escape(trial.id)}"></td>
    <td><button type="button" class="trial-link" data-trial="${escape(trial.id)}">${escape(trial.id)}</button></td>
    <td>${escape(trial.material)}</td>
    <td>${oxygen(trial.initialO2)}</td>
    <td>${escape(trial.report?.direction || "Sin confirmar")}</td>
    <td>${trial.video ? `<button class="play-small" aria-label="Ver vídeo ${escape(trial.id)}" type="button" data-video="${escape(trial.id)}">▶</button>` : ""}</td>
  </tr>`);
  byId("trial-rows").innerHTML = rows.join("") || '<tr><td colspan="6" class="empty">No hay ensayos que coincidan con estos filtros.</td></tr>';
  byId("result-count").textContent = `${filtered.length} de ${trials.length} registros`;
  byId("page-label").textContent = filtered.length ? `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} de ${filtered.length}` : "0 registros";
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

function renderRecordings() {
  byId("recording-grid").innerHTML = trials.filter((trial) => trial.video).map((trial) => `
    <button class="recording" type="button" data-video="${trial.id}" aria-label="Ver grabación del ensayo ${trial.id}">
      <span class="recording-poster"><img src="media/${trial.id.toLowerCase()}.webp" loading="lazy" alt=""><b aria-hidden="true">▶</b></span>
      <span class="recording-label"><strong>${trial.id} · ${escape(trial.family)}</strong><small>Muestra ${escape(trial.sample)} · ${duration(trial.video)}</small></span>
    </button>`).join("");
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
  showModal(`Grabación ${trial.id} · ${trial.family}`, `
    <video controls playsinline preload="metadata" poster="media/${name}.webp" src="media/${name}.mp4" aria-label="Grabación original del ensayo ${trial.id}"></video>
    <p class="modal-note">Muestra ${escape(trial.sample)} · ${duration(trial.video)} de grabación</p>
    <div class="detail-actions"><button class="primary" data-trial="${trial.id}" type="button">Ficha del ensayo</button>
    ${trial.report ? citation(trial.report) : ""}</div>`, trigger);
}

const observation = (trial) => trial.report?.observation || "Sin observación vinculada en el apéndice A.";
const gasNames = ["O₂ inicial calibrado (%)", "O₂ final calibrado (%)", "CO₂ inicial (%)", "CO₂ final (%)", "CO inicial (ppm)", "CO final (ppm)"];
const gasValue = (trial, index) => /^(?:none|n\/?a|-*)$/i.test(trial.gasReadings[index]) ? "Sin dato" : trial.gasReadings[index];

function showTrial(trial, trigger) {
  showModal(`Ensayo ${trial.id} · muestra ${trial.sample}`, `
    <p><strong>${escape(trial.material)}</strong> · ${escape(trial.pi)}</p>
    <dl class="facts">
      ${formatField("Dirección del flujo", trial.report?.direction || "Sin confirmar")}
      ${formatField("Air display · lectura original", trial.air)}
      ${formatField("Fan display · lectura original", trial.fan)}
      ${gasNames.map((name, index) => formatField(name, gasValue(trial, index))).join("")}
    </dl>
    <h3>Observación del informe</h3><p lang="${trial.report?.observation ? "en" : "es"}">${escape(observation(trial))}</p>
    <div class="detail-actions">
      ${trial.report ? citation(trial.report) : ""}
      ${trial.video ? `<button type="button" class="primary" data-video="${trial.id}">Ver grabación</button>` : ""}
    </div>`, trigger);
}

function compare(trigger) {
  const records = Array.from(selected, (id) => trials.find((trial) => trial.id === id));
  const fields = [
    ["Material", (trial) => trial.material], ["Muestra", (trial) => trial.sample],
    ["Dirección del flujo", (trial) => trial.report?.direction || "Sin confirmar"],
    ["Air display · original", (trial) => trial.air || "Sin dato"],
    ...gasNames.map((name, index) => [name, (trial) => gasValue(trial, index)]),
    ["Observación del informe", observation],
  ];
  showModal("Comparar ensayos", `
    <div class="table-scroll" role="region" aria-label="Comparación de ensayos" tabindex="0">
      <table class="compare-table">
        <thead><tr><th scope="col">Variable</th>${records.map((trial) => `<th scope="col">${trial.id}</th>`).join("")}</tr></thead>
        <tbody>${fields.map(([label, getter]) => `<tr><th scope="row">${label}</th>${records.map((trial) => `<td>${escape(getter(trial))}</td>`).join("")}</tr>`).join("")}
        <tr><th scope="row">Fuente</th>${records.map((trial) => `<td>${trial.report ? citation(trial.report) : "Sin enlace en el apéndice"}</td>`).join("")}</tr></tbody>
      </table>
    </div><p class="modal-note">Las lecturas se muestran como figuran en la tabla PSI e incluyen valores pendientes de verificar.</p>`, trigger);
}

function displayAnswer(result) {
  const mode = result.mode === "ai" ? "Respuesta de IA" : "Búsqueda documental";
  byId("answer").innerHTML = `<div class="answer-mode">${mode}</div>` +
    (result.note ? `<p class="muted">${escape(result.note)}</p>` : "") +
    result.claims.map(({ text, sources }) => `<article><p>${escape(text)}</p>${
      sources.length ? `<div class="citations">${sources.map((source) => citation(source, source.id || "NASA")).join("")}</div>` : ""
    }</article>`).join("");
}

async function ask() {
  const question = byId("question").value.trim();
  if (!question || pending || !trials.length) return;
  pending = true;
  byId("ask").disabled = true;
  byId("answer").textContent = "Consultando el informe…";
  try {
    const response = await fetch("/api/ask", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }), signal: AbortSignal.timeout(35000),
    });
    if (!response.ok) throw new Error("No disponible");
    displayAnswer(await response.json());
  } catch {
    displayAnswer(findEvidence(question, trials, "La IA generativa no está disponible en esta sesión. Se muestran pasajes del informe."));
  } finally {
    pending = false;
    byId("ask").disabled = false;
  }
}

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
  if (!response.ok) throw new Error("Datos no disponibles");
  trials = await response.json();
  const ordered = new Map(["B1", "B3", "F1"].map((id, index) => [id, index]));
  trials.sort((a, b) => (ordered.get(a.id) ?? 100) - (ordered.get(b.id) ?? 100));
  for (const family of [...new Set(trials.map((trial) => trial.family))].sort((a, b) => a.localeCompare(b, "es"))) {
    byId("material").add(new Option(family));
  }
  byId("total-trials").textContent = trials.length;
  renderTable();
  renderRecordings();
} catch {
  byId("result-count").textContent = "No se pudieron cargar los ensayos. Recarga la página.";
}
