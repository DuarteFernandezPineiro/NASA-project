const PAGE_SIZE = 12;

export async function loadDatasetExplorer({ escape, normalize, saveCsv }) {
  const byId = (id) => document.getElementById(id);
  const selector = byId("psi-table");
  const query = byId("psi-query");
  const type = byId("psi-type");
  const download = byId("psi-download");
  const prev = byId("psi-prev");
  const next = byId("psi-next");
  const status = byId("psi-status");

  let datasets;
  try {
    const response = await fetch("psi-catalog.json");
    if (!response.ok) throw new Error("Dataset unavailable");
    datasets = await response.json();
    if (!datasets.length) throw new Error("Dataset catalog is empty");
  } catch {
    status.textContent =
      "Could not load the PSI tables. Reload the page to retry.";
    return [];
  }

  const groups = new Map();
  for (const dataset of datasets) {
    if (!groups.has(dataset.group)) {
      const group = document.createElement("optgroup");
      group.label = dataset.group;
      groups.set(dataset.group, group);
      selector.append(group);
    }
    groups
      .get(dataset.group)
      .append(new Option(`${dataset.name} · ${dataset.psi}`, dataset.id));
  }

  let active;
  let page = 0;
  let filtered = [];
  let rows = [];
  const metadataColumns = ["CSV line", "Record type", "Repeats CSV line"];
  const number = new Intl.NumberFormat("en-US");

  function cell(value) {
    return value.trim()
      ? escape(value)
      : '<span class="dataset-missing" aria-label="Blank in source">—</span>';
  }

  function render() {
    const terms = normalize(query.value.trim()).split(/\s+/).filter(Boolean);
    filtered = rows.filter(
      ({ row, search }) =>
        (!type.value || row.kind === type.value) &&
        terms.every((term) => search.includes(term)),
    );
    const start = page * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, filtered.length);
    const separator = " · ";
    status.textContent = `${number.format(filtered.length)} of ${number.format(active.rows.length)} source rows`;
    byId("psi-page").textContent = filtered.length
      ? `${start + 1}–${end} of ${filtered.length}`
      : "0 rows";
    prev.disabled = page === 0;
    next.disabled = end >= filtered.length;
    download.disabled = filtered.length === 0;
    byId("psi-rows").innerHTML = filtered.length
      ? filtered
          .slice(start, end)
          .map(
            ({ row }) => `<tr>
          <th scope="row" class="dataset-line">${row.line}</th>
          <td>${escape(row.kind)}${row.repeatOf ? `<span class="dataset-repeat">${separator} Repeats line ${row.repeatOf}</span>` : ""}</td>
          ${row.values.map((value) => `<td>${cell(value)}</td>`).join("")}
        </tr>`,
          )
          .join("")
      : `<tr><td class="empty" colspan="${active.columns.length + 2}">No rows match the current filters.</td></tr>`;
  }

  function resetPage() {
    page = 0;
    render();
  }

  function choose(dataset) {
    active = dataset;
    selector.value = dataset.id;
    query.value = "";
    const counts = Object.entries(dataset.counts);
    type.replaceChildren(
      new Option("All record types", ""),
      ...counts.map(([kind, count]) => new Option(`${kind} (${count})`, kind)),
    );
    type.disabled = counts.length < 2;
    const repeats = dataset.rows.filter((row) => row.repeatOf).length;
    const breakdown = counts.map(
      ([kind, count]) =>
        `${number.format(count)} ${kind.toLowerCase()}${count === 1 ? "" : " rows"}`,
    );
    if (repeats)
      breakdown.push(
        `${repeats} repeated ${repeats === 1 ? "row" : "rows"} retained`,
      );
    byId("psi-name").textContent = dataset.name;
    byId("psi-counts").textContent = breakdown.join(" · ");
    byId("psi-file").textContent = dataset.file;
    byId("psi-note").textContent = dataset.note;
    byId("psi-note").hidden = !dataset.note;
    const link = byId("psi-source");
    link.href = dataset.source;
    link.textContent = `NASA ${dataset.psi} ↗`;
    const caption = byId("psi-caption");
    caption.textContent = `${dataset.name}, NASA ${dataset.psi} source rows`;
    byId("psi-head").innerHTML = `<tr>${[
      ...metadataColumns.slice(0, 2),
      ...dataset.columns,
    ]
      .map(
        (label, index) =>
          `<th scope="col"${index === 0 ? ' class="dataset-line"' : ""}>${escape(label)}</th>`,
      )
      .join("")}</tr>`;
    rows = dataset.rows.map((row) => ({
      row,
      search: normalize([row.line, row.kind, ...row.values].join(" ")),
    }));
    resetPage();
    const url = new URL(location.href);
    url.searchParams.set("dataset", dataset.id);
    return url;
  }

  selector.disabled = false;
  query.disabled = false;
  const requested = new URLSearchParams(location.search).get("dataset");
  choose(datasets.find((d) => d.id === requested) || datasets[0]);
  byId("psi-details").hidden = false;
  byId("psi-coverage").textContent =
    `${datasets.length} tables · ${new Set(datasets.map((d) => d.psi)).size} investigations · ${number.format(datasets.reduce((sum, d) => sum + d.rows.length, 0))} source rows`;
  selector.addEventListener("change", () => {
    const url = choose(datasets.find((d) => d.id === selector.value));
    history.replaceState(null, "", url);
  });
  query.addEventListener("input", resetPage);
  type.addEventListener("change", resetPage);
  prev.addEventListener("click", () => {
    page--;
    render();
  });
  next.addEventListener("click", () => {
    page++;
    render();
  });
  download.addEventListener("click", () => {
    const data = filtered.map(({ row }) => [
      active.psi,
      active.file,
      row.line,
      row.kind,
      row.repeatOf,
      ...row.values,
      active.source,
    ]);
    saveCsv(
      [
        [
          "PSI accession",
          "Source file",
          ...metadataColumns,
          ...active.columns,
          "NASA source",
        ],
        ...data,
      ],
      `${active.id}-rows.csv`,
    );
  });
  return datasets;
}
