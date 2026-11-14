const REPORT = "https://ntrs.nasa.gov/api/citations/20210011385/downloads/TM-20210011385.pdf";
export const reportLink = (source) => `${REPORT}#page=${source.pdfPage}`;

const featuredNotes = {
  B1: "La muestra prendió rápidamente. Se cortó el flujo cuando la llama había recorrido aproximadamente la mitad de la muestra y se extinguió enseguida. El informe describe hollín y un frente de llama azul.",
  B3: "El informe anota que, con menor flujo, la llama era más azul en conjunto y seguía produciendo algo de hollín. También señala incertidumbre sobre la lectura inicial de oxígeno.",
  F1: "El Nomex prendió brevemente, la llama no se propagó y se extinguió mientras el ignitor seguía encendido.",
};

export const methods = [
  { id: "methods", pdfPage: 13, page: 5, keywords: "radiómetro radiometro camara calibration calibracion sensor montaje ventilacion microgravedad", text: "The video overlay displayed the air velocity transducer reading in cm/s, fan voltage and radiometer signal. The fan voltage was calibrated against the airspeed transducer at the end of every operations day. The radiometer signal was uncalibrated and served to observe flame dynamics and steadiness." },
  { id: "gases", pdfPage: 14, page: 6, keywords: "gas gases oxigeno o2 co co2 nitrogeno ppm sensores medicion antes despues", text: "O2, CO2 and CO sensor readings were taken before and after each test. Nitrogen dilution was used to reach lower O2 levels in the working volume." },
  { id: "gravity", pdfPage: 48, page: 40, keywords: "gravedad tierra terrestres downward 1g normal propagacion mm/s pmma", text: "Section 2.3.7 compares a normal-gravity, downward PMMA spread experiment with the ISS microgravity sample. In this comparison for 100 µm PMMA the normal-gravity average was 2.0 mm/s. The highest measured microgravity spread value was about 2.2 mm/s under the tested conditions." },
];

const normalize = (value) => value.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");
const stopWords = new Set("a al an and con como cual cuales de del el en ensayo ensayos fue informe la las los nasa o para paso por que se si un una y what which did the in on with".split(" "));
const groups = [
  [/extin|exting|apaga|blow.?off|flame out|went out/i, "extinction"],
  [/aire|airflow|flujo|flow|ventil/i, "flow"],
  [/redu|cort|turn.*off|decreas|lower|shut|cut|baj/i, "reduced"],
  [/encend|ignit|prendi|flash/i, "ignition"],
  [/propag|spread/i, "spread"],
  [/oxigen|oxygen|\bo2\b/i, "oxygen"],
];
function tokens(value) {
  const plain = normalize(value);
  const words = plain.match(/[a-z0-9]+/g) || [];
  return new Set([...words.filter((word) => !stopWords.has(word)), ...groups.filter(([re]) => re.test(plain)).map(([, key]) => key)]);
}

export function rankEvidence(question, trials, limit = 9) {
  const words = tokens(question);
  // The chemical symbol O₂ folds to the test ID O2 during normalization.
  const explicitTrialO2 = /\b(?:ensayos?|tests?|trials?)\s+o2\b/i.test(question)
    || /^\s*o2\s*[?.!]?\s*$/i.test(question);
  const exactIds = trials.filter((trial) => words.has(trial.id.toLowerCase())
    && (trial.id !== "O2" || explicitTrialO2));
  const items = trials.filter((trial) => trial.report?.observation).map((trial) => ({
    id: trial.id, pdfPage: trial.report.pdfPage, page: trial.report.page, table: trial.report.table,
    text: trial.report.observation,
    setup: {
      sample: trial.sample, material: trial.family + " · " + trial.material,
      direction: trial.report.direction, initialO2CalibratedPercentByVolume: trial.initialO2,
      airDisplay: trial.air, ...(trial.id === "B3" ? { initialO2UncalibratedPercentByVolume: 20.9 } : {}),
    },
    keywords: `${trial.id === "O2" ? "" : trial.id} ${trial.family} ${trial.material} ${trial.report.direction || ""}`,
  }));
  const ranked = [...items, ...methods].map((source) => {
    const referenceWords = tokens(`${source.keywords} ${source.text}`);
    let score = exactIds.some((trial) => trial.id === source.id) ? 100 : 0;
    for (const word of words) if (referenceWords.has(word)) score += word === "flow" ? 1 : 2;
    return { source, score };
  });
  return ranked.filter(({ score, source }) => exactIds.length ? score >= 100 : score >= (source.setup ? 3 : 2))
    .sort((a, b) => b.score - a.score).slice(0, limit).map(({ source }) => source);
}

export function findEvidence(question, trials, note = "") {
  const records = rankEvidence(question, trials, 3);
  return {
    mode: "search",
    note,
    claims: records.length
      ? records.map((source) => ({ text: source.setup ? `${source.id} · ${featuredNotes[source.id] || source.text}` : source.text, sources: [source] }))
      : [{ text: "No hay pasajes vinculados que respondan a esa pregunta. Prueba con un identificador de ensayo como B1, B3 o F1.", sources: [] }],
  };
}
