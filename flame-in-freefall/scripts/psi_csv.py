"""Read a NASA PSI table while keeping its values and physical CSV line numbers."""

import csv
from io import StringIO


def read_table(path):
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp1252")

    reader = csv.reader(StringIO(text, newline=""), strict=True)
    header = next(reader)
    rows = []
    while True:
        start = reader.line_num + 1
        values = next(reader, None)
        if values is None:
            break
        if not any(value.strip() for value in values):
            continue
        if len(values) != len(header):
            raise ValueError(f"{path.name}, line {start}: expected {len(header)} cells, got {len(values)}")
        rows.append((start, values))
    return header, rows
