"""Build a browseable catalog of the NASA PSI CSV files tracked beside the app."""

import json
import re
from collections import Counter
from pathlib import Path

from psi_csv import read_table

ROOT = Path(__file__).resolve().parents[2]
DESTINATION = ROOT / "flame-in-freefall" / "dist" / "psi-catalog.json"

# Catalog labels describe what one source row represents, including summary-only tables.
TABLES = [
    (25, "BASS-II", "BASS-II", "Solid combustion", "Trial"),
    (26, "BASS", "BASS", "Solid combustion", "Run"),
    (98, "SAFFIRE-1", "Saffire-I", "Solid combustion", "Sample"),
    (99, "SAFFIRE-2", "Saffire-II", "Solid combustion", "Sample"),
    (100, "SAFFIRE-3", "Saffire-III", "Solid combustion", "Sample"),
    (69, "FLEX", "FLEX", "Liquid droplets", "Trial"),
    (68, "Flex2", "FLEX-2", "Liquid droplets", "Configuration"),
    (39, "CFI", "Cool Flames Investigation", "Liquid droplets", "Run"),
    (101, "SAME-R", "SAME-R", "Smoke and aerosols", "Run"),
    (102, "SAME", "SAME", "Smoke and aerosols", "Configuration"),
    (47, "DAFT", "DAFT", "Smoke and aerosols", "Session"),
    (20, "ACME BRE", "ACME BRE", "Gas flames", "Session summary"),
    (21, "CLD Flame", "ACME CLD Flame", "Gas flames", "Session summary"),
    (22, "ACME E-FIELD Flames", "ACME E-FIELD Flames", "Gas flames", "Session summary"),
    (23, "ACME s-Flame", "ACME s-Flame", "Gas flames", "Session summary"),
    (
        10,
        "Flame Design_Normal Flame",
        "Flame Design · Normal",
        "Gas flames",
        "Test record",
    ),
    (
        10,
        "Flame Design_Inverse Flame",
        "Flame Design · Inverse",
        "Gas flames",
        "Test record",
    ),
    (159, "CFI-G_Normal Flames", "CFI-G · Normal", "Gas flames", "Test record"),
    (159, "CFI-G_Inverse Flames", "CFI-G · Inverse", "Gas flames", "Test record"),
    (106, "Slice", "SLICE", "Gas flames", "Session summary"),
    (107, "Spice", "SPICE", "Gas flames", "Measurement record"),
    (
        142,
        "Data Summary Table",
        "Cool flame studies · Figure index",
        "Related research",
        "Figure reference",
    ),
    (
        181,
        "Experimental Table_PSI_181",
        "ISSI solder study",
        "Related research",
        "Sample inventory",
    ),
]

NOTES = {
    20: "Flames Ignited counts ignitions within each session. Listed oxygen values can be approximate; chamber pressures are absent from the summary.",
    21: "MFC values are controller capacities as described in the source notes. Fuel labels and ranges are shown as published.",
    22: "An undated row with a fuel concentration is kept as a condition detail. It carries no separate ignition count.",
    23: "Atmosphere and fuel cells contain descriptions, including approximations. Flames Ignited is a session count.",
    25: "Air display can contain multiple readings and notes. See the BASS-II Trial Explorer for the report-linked outcomes.",
    26: "The run list includes a soot-cleaning entry. Each run has sample metadata; the CSV gives no airflow, oxygen or outcome.",
    39: "Repeated source rows are retained. The Oxygen, Nitrogen and Helium columns are displayed on their published scale.",
    68: "The table gives ranges and possible settings by fuel. It does not enumerate the individual runs.",
    69: "Pressure is given in mmHg and initial gas composition in mole fractions. The burning-rate header in the source says mm.",
    98: "Pre-test flow imagery identifiers are separate entries alongside the burn samples.",
    99: "Pre-test imagery and the four source footnotes are retained. Blank material cells and strings such as «037 mm» are shown as published.",
    101: "Date strings omit the year in the CSV. The timing fields use seconds and blanks remain blank.",
    102: "Some material descriptions refer to conditions in rows 1–4 without repeating the numeric entries.",
    106: "Dates and fuel cells may describe several tests or calibrations within a session.",
    107: "Several records share timestamps or repeat all fields. These CSV rows are measurements and are retained individually.",
    142: "This table indexes publications and figures. No numeric series was transcribed from the linked figures.",
    159: "Ignition and termination labels are specific to CFI-G. Text codes, original units and annotations are retained.",
    181: "The table inventories solder samples and methods in microgravity and on Earth, without combustion outcomes.",
}


def row_kind(psi, default, values):
    sample = values[0].strip()
    if psi in (98, 99):
        if re.match(r"^Note \d", sample):
            return "Footnote"
        if sample.startswith("F") and "Pre-test" in values[1]:
            return "Pre-test imagery"
    if psi == 26 and not values[3].strip():
        return "Maintenance"
    if psi == 22 and not values[1].strip():
        return "Condition detail"
    return default


def build():
    datasets = []
    for psi, suffix, title, group, default in TABLES:
        accession = f"PSI-{psi}"
        filename = f"{accession}_Experimental table_{suffix}.csv"
        columns, source = read_table(ROOT / filename)
        table_id = accession.lower()
        if psi in (10, 159):
            table_id += "-inverse" if "Inverse" in suffix else "-normal"
        seen = {}
        rows = []
        for line, values in source:
            key = tuple(value.strip() for value in values)
            first = seen.setdefault(key, line)
            record = {
                "line": line,
                "kind": row_kind(psi, default, values),
                "values": values,
            }
            if first != line:
                record["repeatOf"] = first
            rows.append(record)
        datasets.append(
            {
                "id": table_id,
                "psi": accession,
                "name": title,
                "group": group,
                "file": filename,
                "source": f"https://psi.nasa.gov/physci/repo/data/investigations/{accession}",
                "note": NOTES.get(psi, ""),
                "columns": [column.strip() for column in columns],
                "counts": dict(Counter(row["kind"] for row in rows)),
                "rows": rows,
            }
        )
    supplied = {file.name for file in ROOT.glob("PSI-*_Experimental table_*.csv")}
    indexed = {dataset["file"] for dataset in datasets}
    if supplied != indexed:
        raise ValueError(
            f"Catalog coverage changed. Newly supplied: {sorted(supplied - indexed)}; missing: {sorted(indexed - supplied)}"
        )
    return datasets


if __name__ == "__main__":
    datasets = build()
    DESTINATION.write_text(
        json.dumps(datasets, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(
        f"{len(datasets)} tables, {len({data['psi'] for data in datasets})} investigations, "
        f"{sum(len(data['rows']) for data in datasets)} source rows -> dist/psi-catalog.json"
    )
