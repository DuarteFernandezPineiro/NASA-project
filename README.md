# Flame in Freefall

**NASA Space Apps Challenge 2026 · [Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/)**

An interactive dashboard that explores and summarizes the 129 trials of NASA's **Burning and Suppression of Solids–II (BASS-II)** experiment on the International Space Station, and answers questions about them with citations to the original NASA pages.

## Submission demo

- [Seven-slide presentation (PDF)](submission/Flame-in-Freefall.pdf)
- [Flame in Freefall application (restricted access)](https://flame-in-freefall-bass-ii.knowingpanda2.chatgpt.site)
- [AI and generated data disclosure](submission/AI-DISCLOSURE.md)

## What it does

- **Trial map.** Initial calibrated O₂ and single airflow readings, with markers for ignition yes, no or unknown. An optional overlay shows the uncertainty ranges for the thin-PMMA experiments in NASA Table 2.1. The map reports excluded records; the explorer retains the original airflow entries.
- **Documented outcomes.** Ignition and spread counts and percentages, overall and by material family, using all trials in each denominator.
- **Trial explorer.** Filters, comparison of up to three trials with differences and missing fields marked, CSV downloads and original ISS recordings.
- **Investigations at a glance.** BASS-II compared with Saffire, FLEX, SAME, DAFT, the ACME experiments and others: what burned, hardware, what varied, key result and which part of fire safety (prevention, detection, suppression) each informs, with a team rating of habitat relevance. Every cell is sourced.
- **PSI Data Explorer.** Browse, search and export all 23 experimental CSV tables in the repository, covering 21 investigations. Units and CSV line numbers stay with each table. See [coverage and data treatment](flame-in-freefall/DATOS-PSI.md).
- **Beyond BASS-II.** Test-level data from three more PSI investigations: the 274 FLEX droplet tests plotted by O₂ and pressure against the lunar habitat target, coloured by suppressant (CO₂, helium), with the share of tests ending in flame extinction by O₂ level; the nine Saffire-II samples compared between microgravity and normal gravity; and the BASS run list.
- **Exploration Advisor.** A comparison of four environments with links to NASA references and the limits of the BASS-II evidence.
- **Decades of NASA microgravity combustion.** An interactive timeline from drop towers to SoFIE.
- **Ask NASA documents.** A retrieval-augmented assistant over the BASS-II summary report and NASA's ISS combustion guide. Every claim links to the PDF page that supports it; answers flag when a question goes beyond the tested range.

## Key findings

1. **PMMA rods.** NASA reported 13.5% O₂ at the low-flow microgravity flammability boundary for the rods studied and 15.4% for upward spread in a normal-gravity test with additional forced flow (§6.1.4, p. 76).
2. **Thin PMMA in opposed flow.** In this film series, NASA measured low-flow extinction velocities of 10 ± 5 mm/s at 21% O₂ and 30 ± 5 mm/s at 16% O₂ (Table 2.1, p. 28).
3. **Combustion products.** NASA estimated heat release below 100 W for most trials and reported CO/CO₂ ratios about ten times those of efficient flue gases (§1.6, p. 11).
4. **Lunar gravity.** The comparison of PMMA flame spread covers downward spread in normal gravity and experiments in ISS microgravity (§2.3.7, p. 40).
5. **FLEX at 30–34% O₂.** In FLEX, 24 droplet tests ran at 30–34% O₂, 17 of them near 10.4 psi. Two ended in flame extinction; the rest ended with the fuel consumed or the droplet disrupted. At ≤15% O₂, 45 of 48 ended in extinction. Fuels, pressures and droplet sizes differ between these groups (PSI-69).
6. **Saffire-II silicone.** At about 22% O₂ and 20 cm/s, the four silicone samples showed no burn length in microgravity; in the normal-gravity comparison two burned completely and one burned 7.6 cm (PSI-99).

## NASA data

| Source                                                                                                                                                                                                | Use                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [PSI-25 BASS-II experimental table](https://doi.org/10.60555/4qc4-de67) (NASA Physical Sciences Informatics)                                                                                          | 129 trial records and recordings                                       |
| [NASA/TM-20210011385, BASS-II Summary Report](https://ntrs.nasa.gov/citations/20210011385)                                                                                                            | Trial observations (Appendix A) and 238 indexed passages               |
| [PSI-69 FLEX experimental table](https://doi.org/10.60555/mbq8-0451)                                                                                                                                  | 274 droplet tests: fuel, pressure, O₂ and diluent, how each test ended |
| [PSI-99 SAFFIRE-II experimental table](https://doi.org/10.60555/2chp-m469)                                                                                                                            | 9 samples burned in microgravity and in normal gravity                 |
| [PSI-26 BASS experimental table](https://doi.org/10.60555/58h4-dy80)                                                                                                                                  | List of 121 runs and samples (no O₂, airflow or outcome)               |
| [NP-2015-10-034-JSC, A Researcher's Guide to: Combustion Science](https://www.nasa.gov/sites/default/files/atoms/files/np-2015-10-034-jsc_combustion_in_reduced_gravity-iss-mini-book-011116-508.pdf) | 88 indexed passages of context on other ISS combustion experiments     |

### PSI records cited in "Investigations at a glance"

As required by NASA's Science Mission Directorate open-science guidance, each investigation is cited by its PSI persistent identifier.

| Investigation             | PSI record                                                            | DOI                                                      |
| ------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| BASS                      | PSI-26                                                                | [10.60555/58h4-dy80](https://doi.org/10.60555/58h4-dy80) |
| BASS-II                   | PSI-25                                                                | [10.60555/4qc4-de67](https://doi.org/10.60555/4qc4-de67) |
| Saffire-I                 | PSI-98                                                                | [10.60555/0t15-1z43](https://doi.org/10.60555/0t15-1z43) |
| Saffire-II                | PSI-99                                                                | [10.60555/2chp-m469](https://doi.org/10.60555/2chp-m469) |
| Saffire-III               | PSI-100                                                               | [10.60555/040q-4h36](https://doi.org/10.60555/040q-4h36) |
| FLEX                      | PSI-69                                                                | [10.60555/mbq8-0451](https://doi.org/10.60555/mbq8-0451) |
| FLEX-2                    | PSI-68                                                                | [10.60555/byp8-h018](https://doi.org/10.60555/byp8-h018) |
| SAME                      | PSI-102                                                               | [10.60555/gd4k-8h62](https://doi.org/10.60555/gd4k-8h62) |
| SAME-R                    | PSI-101                                                               | [10.60555/2np7-jv14](https://doi.org/10.60555/2np7-jv14) |
| ACME BRE                  | PSI-20                                                                | [10.60555/vb93-3y72](https://doi.org/10.60555/vb93-3y72) |
| ACME CFI-G                | PSI-159                                                               | [10.60555/cyt1-kh64](https://doi.org/10.60555/cyt1-kh64) |
| ACME E-FIELD Flames       | PSI-22                                                                | [10.60555/se5a-8c73](https://doi.org/10.60555/se5a-8c73) |
| SPICE                     | PSI-107                                                               | [10.60555/9kbh-e962](https://doi.org/10.60555/9kbh-e962) |
| SLICE                     | PSI-106                                                               | [10.60555/pm12-rg61](https://doi.org/10.60555/pm12-rg61) |
| Cool Flames Investigation | [PSI-39](https://psi.nasa.gov/physci/repo/data/investigations/PSI-39) | not shown on the record page                             |

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

- PSI source rows represent different things, including individual tests, samples, session summaries, configurations and reference entries. The FLEX extinction shares by O₂ band describe the droplet tests under their own conditions.
- Habitat relevance in "Investigations at a glance" is a team assessment, not a NASA rating.
- Ignition outcome is documented for 116 of 129 trials; flame spread is stated explicitly in only 28.
- Outcome proportions describe samples tested across different geometries and conditions. See the [field and decision table](flame-in-freefall/DATOS-BASS-II.md).
- The ISS trials cover microgravity. The PMMA comparison with normal gravity provides no lunar measurements.

## Use of AI

The dashboard uses OpenAI models to answer questions over NASA documents. The team also used AI coding assistants during development; all data, figures and citations were checked against the NASA sources.
