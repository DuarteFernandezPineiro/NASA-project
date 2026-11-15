"""Build the retrieval index for the two NASA documents in the repository.

- NASA/TM-20210011385, the BASS-II summary report (test data and analysis).
- NP-2015-10-034-JSC, "A Researcher's Guide to: Combustion Science" (2015 overview
  of NASA microgravity combustion research on the ISS).

Splits the narrative part of each PDF into section-aware passages and writes
dist/chunks.json. With --embed it also calls the OpenAI embeddings API and
writes dist/vectors.json (int8-quantised, base64) for semantic retrieval.

    python scripts/build-index.py            # passages only
    python scripts/build-index.py --embed    # passages + vectors (needs OPENAI_API_KEY)
"""

import argparse
import base64
import json
import os
import re
import urllib.request
from pathlib import Path

import pdfplumber

PROJECT = Path(__file__).resolve().parents[1]
PDF = PROJECT.parent / "TM-20210011385.pdf"
GUIDE_PDF = (
    PROJECT.parent
    / "np-2015-10-034-jsc_combustion_in_reduced_gravity-iss-mini-book-011116-508.pdf"
)
GUIDE_CONTENTS = (6, 7)  # PDF pages of the table of contents
GUIDE_BODY = range(
    8, 49
)  # "Why Conduct Combustion Research..." up to the funding and citation pages
DIST = PROJECT / "dist"

FIRST_BODY_PAGE = 9  # PDF page of printed page 1
TABLE_PAGES = range(
    111, 122
)  # Appendix A matrices: rotated tables, already in trials.json
LAST_BODY_PAGE = 136  # Appendix E onwards is a list of publications
TARGET_WORDS = 170
MAX_WORDS = 230
EMBED_MODEL = "text-embedding-3-small"
EMBED_DIMS = 256

HEADING = re.compile(r"^(\d\.\d(?:\.\d+)?|[A-D]\.\d)\s+([A-Z][^=]*[^.,;=])$")
APPENDIX = re.compile(r"^Appendix ([A-E])\.\s*[—-]\s*(.+)$")
FOOTER = re.compile(r"^NASA/TM-20210011385\s+\d+$")
SKIPPED = re.compile(
    r"references|acknowledg|publications resulting|research citations|symbols", re.I
)
PLAIN_HEADINGS = {"Summary", "Symbols", "Acronyms", "References", "Nomenclature"}
CITATION = re.compile(
    r"et al\.:|[Pp]resented at|\bpp\. \d|https?://|^\d{1,2}\. [A-Z][\w’'-]+, [A-Z]"
    r"|[A-Z][\w’'-]+, [A-Z][\w.]*(?: [A-Z]\.)?;? and [A-Z][\w’'-]+, [A-Z][\w. ]*:|^[A-Z][\w’'-]+, [A-Z][\w.]*:"
)
SUBSCRIPT_LINE = re.compile(r"^(?:[\dxgs∞fF]{1,3}\s*){1,12}$")


def clean_lines(text):
    for line in text.split("\n"):
        line = line.strip()
        if not line or FOOTER.match(line) or SUBSCRIPT_LINE.match(line):
            continue
        yield line


def fix_chemistry(text):
    text = re.sub(r"\bO (?=[a-z(,.;)]|[A-Z][a-z])", "O2 ", text)
    text = re.sub(r"\bN (?=flow|dilution|concentration|[,.;)])", "N2 ", text)
    text = re.sub(
        r"\bCO (?=,? and CO\b|sensor in the CDM|scrubb|monitor|levels? (?:rose|increas))",
        "CO2 ",
        text,
    )
    text = re.sub(r"\bCO to CO ratio", "CO to CO2 ratio", text)
    text = re.sub(r"\s+([,.;)])", r"\1", text)
    return re.sub(r"\s{2,}", " ", text).strip()


def read_sections():
    """Yield (section_number, section_title, pdf_page, sentence) in reading order."""
    number, title, skip = "0", "Front matter", True
    with pdfplumber.open(PDF) as doc:
        for index, page in enumerate(doc.pages, 1):
            if (
                index < FIRST_BODY_PAGE
                or index > LAST_BODY_PAGE
                or index in TABLE_PAGES
            ):
                continue
            buffer = []
            for line in clean_lines(page.extract_text() or ""):
                heading = HEADING.match(line)
                appendix = APPENDIX.match(line)
                major = re.match(r"^(\d)\.0\s+([A-Z].+)$", line)
                if line in PLAIN_HEADINGS:
                    yield from flush(buffer, number, title, index, skip)
                    buffer = []
                    if line == "Summary":
                        number, title, skip = "0", "Summary", False
                    else:
                        skip = True
                    continue
                if heading or appendix or major:
                    yield from flush(buffer, number, title, index, skip)
                    buffer = []
                    if appendix:
                        number, title = appendix.group(1), appendix.group(2)
                    elif major:
                        number, title = major.group(1) + ".0", major.group(2)
                    else:
                        number, title = heading.group(1), heading.group(2)
                    skip = bool(SKIPPED.search(title))
                    continue
                buffer.append(line)
            yield from flush(buffer, number, title, index, skip)


def flush(lines, number, title, page, skip):
    if skip or not lines:
        return
    text = fix_chemistry(" ".join(lines))
    for sentence in re.split(r"(?<=[.!?])\s+(?=[A-Z(])", text):
        words = sentence.split()
        if len(words) < 4 or CITATION.search(sentence):
            continue
        for start in range(0, len(words), MAX_WORDS):
            yield number, title, page, " ".join(words[start : start + MAX_WORDS])


def read_guide():
    """Yield (section, title, pdf_page, sentence) for the Researcher's Guide."""
    with pdfplumber.open(GUIDE_PDF) as doc:
        pages = {
            index: (doc.pages[index - 1].dedupe_chars().extract_text() or "")
            for index in [*GUIDE_CONTENTS, *GUIDE_BODY]
        }
    headings = set()
    for index in GUIDE_CONTENTS:
        for line in pages[index].split("\n"):
            entry = re.match(r"^(.+?)\s+\d{1,2}$", line.strip())
            if entry:
                headings.add(entry.group(1).lower())
    title = "Why Conduct Combustion Research in Microgravity?"
    for index in GUIDE_BODY:
        buffer = []
        for line in pages[index].split("\n"):
            line = line.strip().replace("ﬂ", "fl").replace("ﬁ", "fi")
            if not line or re.fullmatch(r"\d{1,4}", line):
                continue
            if line.lower() in headings:
                yield from flush(buffer, "G", title, index, False)
                buffer, title = [], line
                continue
            buffer.append(line)
        yield from flush(buffer, "G", title, index, False)


def build_chunks(sentences, doc, page_offset, label):
    chunks, current, words = [], [], 0
    key = None

    def close():
        nonlocal current, words
        if current and words >= 25:
            number, title, page = key[0], key[1], current[0][0]
            chunks.append(
                {
                    "doc": doc,
                    "section": number,
                    "title": title,
                    "pdfPage": page,
                    "page": page - page_offset,
                    "text": " ".join(sentence for _, sentence in current),
                }
            )
        current, words = [], 0

    for number, title, page, sentence in sentences:
        if key != (number, title):
            close()
            key = (number, title)
        count = len(sentence.split())
        if words + count > MAX_WORDS or (words >= TARGET_WORDS and current):
            tail = current[-1]
            close()
            current, words = [tail], len(tail[1].split())  # one-sentence overlap
        current.append((page, sentence))
        words += count
    close()

    seen = {}
    for chunk in chunks:
        base = label(chunk)
        seen[base] = seen.get(base, 0) + 1
        chunk["id"] = base if seen[base] == 1 else f"{base}{chr(96 + seen[base])}"
    return [
        {
            "id": c["id"],
            "doc": c["doc"],
            "section": c["section"],
            "title": c["title"],
            "pdfPage": c["pdfPage"],
            "page": c["page"],
            "text": c["text"],
        }
        for c in chunks
    ]


def build_all():
    report = build_chunks(
        read_sections(),
        "report",
        FIRST_BODY_PAGE - 1,
        lambda c: f"{c['section']}·p{c['page']}",
    )
    guide = build_chunks(read_guide(), "guide", 0, lambda c: f"Guide·p{c['page']}")
    return report + guide


def embed(texts, key):
    vectors = []
    for start in range(0, len(texts), 64):
        request = urllib.request.Request(
            "https://api.openai.com/v1/embeddings",
            data=json.dumps(
                {
                    "model": EMBED_MODEL,
                    "dimensions": EMBED_DIMS,
                    "input": texts[start : start + 64],
                }
            ).encode(),
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.load(response)["data"]
        vectors += [
            item["embedding"] for item in sorted(data, key=lambda item: item["index"])
        ]
        print(f"  embedded {len(vectors)}/{len(texts)}")
    return vectors


def quantise(vector):
    return base64.b64encode(
        bytes((max(-127, min(127, round(v * 127))) & 0xFF) for v in vector)
    ).decode()


def load_key():
    key = os.environ.get("OPENAI_API_KEY")
    env = PROJECT / ".env"
    if not key and env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.startswith("OPENAI_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"')
    return key


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument(
        "--embed", action="store_true", help="also write dist/vectors.json"
    )
    args = parser.parse_args()

    chunks = build_all()
    (DIST / "chunks.json").write_text(
        json.dumps(chunks, ensure_ascii=False, indent=0) + "\n", encoding="utf-8"
    )
    counts = {doc: sum(c["doc"] == doc for c in chunks) for doc in ("report", "guide")}
    print(
        f"{len(chunks)} passages -> dist/chunks.json ({counts['report']} report, {counts['guide']} guide)"
    )

    if args.embed:
        key = load_key()
        if not key:
            raise SystemExit("OPENAI_API_KEY is missing (environment or .env)")
        trials = json.loads((DIST / "trials.json").read_text(encoding="utf-8"))
        items = [(c["id"], f"{c['title']}. {c['text']}") for c in chunks]
        items += [
            (
                t["id"],
                f"Test {t['id']}, {t['material']}, {t['report'].get('layoutRaw') or ''} flow, "
                f"{t['initialO2']}% O2. {t['report']['observation']}",
            )
            for t in trials
            if (t.get("report") or {}).get("observation")
        ]
        vectors = embed([text for _, text in items], key)
        payload = {
            "model": EMBED_MODEL,
            "dims": EMBED_DIMS,
            "vectors": {
                item_id: quantise(vector)
                for (item_id, _), vector in zip(items, vectors)
            },
        }
        (DIST / "vectors.json").write_text(json.dumps(payload) + "\n", encoding="utf-8")
        print(f"{len(vectors)} vectors -> dist/vectors.json")


if __name__ == "__main__":
    main()
