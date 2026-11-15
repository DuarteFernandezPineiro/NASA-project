"""Import the PSI experimental tables of FLEX (PSI-69), SAFFIRE-II (PSI-99) and BASS (PSI-26).

Reads the CSV files downloaded from NASA Physical Sciences Informatics, kept next to the
BASS-II table in the repository root, and writes dist/psi-extra.json.

    python scripts/import-psi-extra.py
"""
import csv
import json
import re
from collections import Counter
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT.parent
MMHG_PER_PSI = 51.715

SOURCES = {
    "flex": {"psi": "PSI-69", "doi": "10.60555/mbq8-0451", "file": "PSI-69_Experimental_table_FLEX.csv"},
    "saffire2": {"psi": "PSI-99", "doi": "10.60555/2chp-m469", "file": "PSI-99_Experimental_table_SAFFIRE-2.csv"},
    "bass": {"psi": "PSI-26", "doi": "10.60555/58h4-dy80", "file": "PSI-26_Experimental_table_BASS.csv"},
}


def number(value):
    match = re.search(r"-?\d+(?:\.\d+)?", value or "")
    return float(match.group()) if match else None


def read(name):
    raw = (ROOT / SOURCES[name]["file"]).read_bytes()
    text = raw.decode("utf-8-sig") if raw.startswith(b"\xef\xbb\xbf") else raw.decode("cp1252", errors="replace")
    return list(csv.reader(text.splitlines()))


def flex():
    rows = read("flex")
    header, body = rows[0], [r for r in rows[1:] if len(r) >= 15 and r[0].strip()]
    tests = []
    for r in body:
        pressure = number(r[5])
        co2, he = number(r[8]) or 0.0, number(r[9]) or 0.0
        tests.append({
            "test": int(r[0]), "id": r[1], "date": r[2], "fuel": r[4],
            "pressureMmHg": pressure if pressure else None,
            "pressurePsi": round(pressure / MMHG_PER_PSI, 2) if pressure else None,
            "o2": number(r[6]), "n2": number(r[7]), "co2": co2, "he": he,
            "diluent": "CO2" if co2 > 0 else "He" if he > 0 else "N2",
            "dropletMm": number(r[10]), "extinctionMm": number(r[11]),
            "burnRate": number(r[12]), "burnTimeS": number(r[13]),
            "testEnd": r[14].strip(),
        })
    return tests


def saffire2():
    rows = read("saffire2")
    header = rows[0]
    samples, notes = [], []
    material = ""
    for r in rows[1:]:
        if not r or not r[0].strip():
            continue
        if r[0].startswith("Note"):
            notes.append(r[0].strip())
            continue
        if not re.match(r"^\d-\d$", r[0].strip()):
            continue
        blank = not r[1].strip()
        material = r[1].strip() or material  # a blank cell repeats the material above
        samples.append({
            "sample": r[0].strip(), "material": material, "materialFromAbove": blank, "thickness": r[2].strip(),
            "lengthCm": number(r[3]), "airflowCmS": number(r[5]), "o2": r[6].strip(),
            "flowDirection": r[10].strip(), "burnTime": r[9].strip(),
            "ugBurnLength": r[11].strip(), "ugSpreadRate": r[12].strip(),
            "oneGBurnLength": r[13].strip(), "oneGSpreadRate": r[14].strip(),
        })
    return {"columns": header, "samples": samples, "notes": notes}


def bass():
    rows = read("bass")
    runs = [r for r in rows[1:] if len(r) >= 6 and r[3].strip()]
    def family(material):
        m = material.lower()
        if "sibal" in m: return "SIBAL fabric"
        if "nomex" in m: return "Nomex"
        if "ultem" in m: return "Ultem"
        if "wax" in m or "candle" in m: return "Wax / candle"
        if "pmma" in m or "sphere" in m: return "PMMA"
        return "Other"
    counts = Counter(family(r[5]) for r in runs)
    return {"runs": len(runs), "dates": [runs[0][0], runs[-1][0]], "materials": dict(counts.most_common())}


def main():
    out = {
        "sources": SOURCES,
        "flex": flex(),
        "saffire2": saffire2(),
        "bass": bass(),
    }
    (PROJECT / "dist" / "psi-extra.json").write_text(json.dumps(out, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"FLEX {len(out['flex'])} tests, SAFFIRE-II {len(out['saffire2']['samples'])} samples, "
          f"BASS {out['bass']['runs']} runs -> dist/psi-extra.json")


if __name__ == "__main__":
    main()
