"""Join the PSI experimental table with the observations in NASA/TM-20210011385."""
import csv
import json
import re
from importlib import import_module
from pathlib import Path

import pdfplumber

# The extractor is also runnable as scripts/extract-outcomes.py.
extract_outcomes = import_module("extract-outcomes").extract_outcomes

PROJECT = Path(__file__).resolve().parents[1]
INPUT = PROJECT.parent
TABLES = ["A.1", "A.1", "A.2", "A.3", "A.3", "A.4", "A.4", "A.5", "A.5", "A.6", "A.6"]


def read_report():
    records = {}
    with pdfplumber.open(INPUT / "TM-20210011385.pdf") as doc:
        for page_number, table in enumerate(TABLES, 111):
            page = doc.pages[page_number - 1]
            borders = sorted(
                (r for r in page.rects if r["width"] > 120 and r["height"] < 1.5 and r["x0"] > 900),
                key=lambda r: r["top"],
            )
            for upper, lower in zip(borders[1:], borders[2:]):
                def cell(left, right):
                    region = page.crop((left, upper["bottom"], right, lower["top"]))
                    return " ".join(region.extract_text().split())

                test_id = cell(168, 186).replace(" ", "")
                sample = cell(187, 209).replace(" ", "")
                if not re.fullmatch(r"[A-Z]\d+[a-z]?", test_id):
                    continue
                key = (test_id, sample.lower())
                if key in records:
                    raise ValueError(f"Repeated PDF test and sample: {key}")
                layout = cell(299, 338)
                records[key] = {
                    "pdfPage": page_number,
                    "page": page_number - 8,
                    "table": table,
                    "direction": {"Opposed": "Opuesto", "Concurrent": "Concurrente",
                                  "Stagnation": "Estancamiento"}.get(layout),
                    "layoutRaw": layout,
                    "material": cell(210, 251),
                    "observation": cell(upper["x0"] + 0.5, upper["x1"]),
                }
    return records


def number(value):
    return float(value) if re.fullmatch(r"-?(?:\d+(?:\.\d*)?|\.\d+)", value) else None


def material_family(label, report_material):
    text = f"{label} {report_material}".lower()
    if "nomex" in text:
        return "Nomex"
    if "sibal" in text:
        return "SIBAL"
    if "pmma" in text:
        return "PMMA"
    if "wax" in text:
        return "Cera"
    if "rod" in text:
        return "Varilla sin polímero explícito"
    return "Otros"


def main():
    report = read_report()
    videos = json.loads((PROJECT / "dist" / "media" / "catalog.json").read_text(encoding="utf-8"))
    records = []
    with (INPUT / "PSI-25_Experimental table_BASS-II.csv").open(encoding="utf-8-sig", newline="") as file:
        for index, row in enumerate(csv.reader(file)):
            if index == 0 or not any(row):
                continue
            pi, test_id, date, gmt, sample, material, restrictor, fan, air, gain, frames, *gases = (
                re.sub(r"\s+", " ", value).strip() for value in row
            )
            source = report.get((test_id, sample.lower()))
            recordings = videos.get(test_id, [])
            records.append({
                "id": test_id, "sample": sample, "date": date, "gmt": gmt, "pi": pi,
                "material": material,
                "family": material_family(material, (source or {}).get("material", "") + (" PMMA" if test_id == "B3" else "")),
                "restrictor": restrictor, "fan": fan, "air": air, "gain": gain, "frames": frames,
                "initialO2": number(gases[0]), "gasReadings": gases,
                "video": recordings[0]["seconds"] if recordings else None,
                "recordings": recordings, "report": source, "csvLine": index + 1,
                **extract_outcomes(test_id, source),
            })
    (PROJECT / "dist" / "trials.json").write_text(
        json.dumps(records, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    missing = [row["id"] for row in records if row["report"] is None]
    print(f"{len(records)} CSV records, {len(records) - len(missing)} matched report rows.")
    print(f"Unmatched IDs: {', '.join(missing)}")


if __name__ == "__main__":
    main()
