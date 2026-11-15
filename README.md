# Flame in Freefall

**NASA Space Apps Challenge 2026 · [Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/)**

An interactive dashboard that explores and summarizes the 129 trials of NASA's **Burning and Suppression of Solids–II (BASS-II)** experiment on the International Space Station, and answers questions about them with citations to the original NASA pages.

## What it does

- **Trial map.** Initial calibrated O₂ and single airflow readings, with markers for ignition yes, no or unknown. The map reports excluded records; the explorer retains the original airflow entries.
- **Documented outcomes.** Ignition and spread counts and percentages, overall and by material family, using all trials in each denominator.
- **Trial explorer.** Filters, comparison of up to three trials with differences and missing fields marked, CSV downloads and original ISS recordings.
- **Ask NASA documents.** A retrieval-augmented assistant over the BASS-II summary report and NASA's ISS combustion guide. Every claim links to the PDF page that supports it; answers flag when a question goes beyond the tested range.

## Key findings

1. **PMMA rods.** NASA reported 13.5% O₂ at the low-flow microgravity flammability boundary for the rods studied and 15.4% for upward spread in a normal-gravity test with additional forced flow (§6.1.4, p. 76).
2. **Thin PMMA in opposed flow.** In this film series, NASA measured low-flow extinction velocities of 10 ± 5 mm/s at 21% O₂ and 30 ± 5 mm/s at 16% O₂ (Table 2.1, p. 28).
3. **Combustion products.** NASA estimated heat release below 100 W for most trials and reported CO/CO₂ ratios about ten times those of efficient flue gases (§1.6, p. 11).
4. **Lunar gravity.** The comparison of PMMA flame spread covers downward spread in normal gravity and experiments in ISS microgravity (§2.3.7, p. 40).

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

Run the ten acceptance checks locally with `npm run test:ai` for document search or `npm run test:ai -- ai` for generation. Expected answers, source pages and recorded results are in [`flame-in-freefall/PRUEBAS-IA.md`](flame-in-freefall/PRUEBAS-IA.md).

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
- Outcome proportions describe samples tested across different geometries and conditions. See the [field and decision table](flame-in-freefall/DATOS-BASS-II.md).
- The ISS trials cover microgravity. The PMMA comparison with normal gravity provides no lunar measurements.

## Use of AI

The dashboard uses OpenAI models to answer questions over NASA documents. The team also used AI coding assistants during development; all data, figures and citations were checked against the NASA sources.
