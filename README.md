# Flame in Freefall

**NASA Space Apps Challenge 2026 · [Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/)**

An interactive dashboard that summarizes, ranks and interprets the 129 trials of NASA's **Burning and Suppression of Solids–II (BASS-II)** experiment on the International Space Station, and answers questions about them with citations to the original NASA pages.

## What it does

- **Flammability map.** Every trial plotted by initial O₂ against airflow, coloured by material and marked by outcome (sustained flame, brief flame or no ignition). A band marks the planned lunar habitat atmosphere (≥30% O₂), which no BASS-II trial reaches.
- **Hazard ranking.** Materials ordered by documented outcomes: the lowest O₂ at which a flame was sustained, the share of trials that burned, and the O₂ consumed. Each entry shows how many trials support it.
- **Trial explorer.** Filters, side-by-side comparison of up to three trials, and the original ISS video recordings.
- **Ask NASA documents.** A retrieval-augmented assistant over the BASS-II summary report and NASA's ISS combustion guide. Every claim links to the PDF page that supports it; answers flag when a question goes beyond the tested range.

## Key findings

1. **Microgravity extends flammability.** PMMA rods kept burning down to 13.5% O₂ in very weak airflow, below the 15.4% limit of the normal-gravity upward test used to screen spacecraft materials (TM-20210011385, §6.1.4, p. 76).
2. **Starving the flame works.** Thin PMMA stops spreading below a critical opposed-flow velocity that does not depend on film thickness and rises as O₂ falls (§2.2.8, p. 28).
3. **Small fires, toxic smoke.** Most tests released well below 100 W, but CO/CO₂ ratios were an order of magnitude higher than in efficient flue gases (§1.6, p. 11).
4. **The lunar gap.** A Moon base is expected to run at ≥30% O₂ and ≤10.2 psi; BASS-II covers 13.6–22.2% O₂ at ISS pressure.

## NASA data

| Source | Use |
|---|---|
| [PSI-25 BASS-II experimental table](https://doi.org/10.60555/4qc4-de67) (NASA Physical Sciences Informatics) | 129 trial records and recordings |
| [NASA/TM-20210011385, BASS-II Summary Report](https://ntrs.nasa.gov/citations/20210011385) | Trial observations (Appendix A) and 238 indexed passages |
| [NP-2015-10-034-JSC, A Researcher's Guide to: Combustion Science](https://www.nasa.gov/sites/default/files/atoms/files/np-2015-10-034-jsc_combustion_in_reduced_gravity-iss-mini-book-011116-508.pdf) | 88 indexed passages of context on other ISS combustion experiments |

## How the assistant works

1. `scripts/build-index.py` splits both PDFs into section-aware passages and embeds them (`text-embedding-3-small`, 256 dimensions).
2. Each question is answered from up to nine sources ranked by BM25 (with a Spanish–English glossary) fused with embedding similarity.
3. The model (`gpt-4.1-mini`) must cite source IDs for every claim; the server rejects any answer citing a source it was not given and falls back to showing the passages.
4. Guardrails: passages are scoped to the investigator's own trial series, setup descriptions cannot support safety claims, fan potentiometer settings are never reported as velocities, and anything outside 13.6–22.2% O₂ is flagged as untested.

Acceptance questions with expected answers and page references are in [`flame-in-freefall/PRUEBAS-IA.md`](flame-in-freefall/PRUEBAS-IA.md).

## Run locally

Requires Node.js 22 or later.

```bash
cd flame-in-freefall
cp .env.example .env    # add OPENAI_API_KEY to enable the AI answers
node server.mjs         # http://127.0.0.1:4187
```

Without a key, the assistant still returns the matching NASA passages.

## Limitations

- Only BASS-II trial data; other investigations appear only as context from the 2015 guide.
- Ignition outcome is documented for 116 of 129 trials; flame spread is stated explicitly in only 28.
- The hazard ranking is a team heuristic, not a NASA flammability rating, and materials were tested under different conditions.
- No trial reaches lunar habitat O₂ levels or partial gravity.

## Use of AI

The dashboard uses OpenAI models to answer questions over NASA documents. The team also used AI coding assistants during development; all data, figures and citations were checked against the NASA sources.
