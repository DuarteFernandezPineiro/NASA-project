const REPORT =
  "https://ntrs.nasa.gov/api/citations/20210011385/downloads/TM-20210011385.pdf";
const GUIDE =
  "https://www.nasa.gov/sites/default/files/atoms/files/np-2015-10-034-jsc_combustion_in_reduced_gravity-iss-mini-book-011116-508.pdf";
export const documents = {
  report: {
    url: REPORT,
    name: "NASA/TM-20210011385, BASS-II Summary Report (2021)",
  },
  guide: {
    url: GUIDE,
    name: "NASA NP-2015-10-034-JSC, A Researcher's Guide to: Combustion Science (2015)",
  },
};
export const reportLink = (source) =>
  `${documents[source.doc]?.url || REPORT}#page=${source.pdfPage}`;

export const isMissing = (value) =>
  value == null || /^(?:none|n\/?a|-*|—)$/i.test(String(value).trim());

export function airReading(raw) {
  if (isMissing(raw)) return { value: null, status: "Missing" };
  const match = String(raw)
    .trim()
    .match(/^((?:\d+(?:\.\d+)?|\.\d+))(?:\s*cm\/s)?$/i);
  return match
    ? { value: Number(match[1]), status: "Single reading" }
    : { value: null, status: "Multiple / annotated" };
}

const featuredNotes = {
  B1: "La muestra prendió rápidamente. Se cortó el flujo cuando la llama había recorrido aproximadamente la mitad de la muestra y se extinguió enseguida. El informe describe hollín y un frente de llama azul.",
  B3: "El informe anota que, con menor flujo, la llama era más azul en conjunto y seguía produciendo algo de hollín. La nota estima que el O₂ inicial probablemente era 20,6 %.",
  F1: "El Nomex prendió brevemente, la llama no se propagó y se extinguió mientras el ignitor seguía encendido.",
};

// Short report passages that complement the complete index.
export const methods = [
  {
    id: "methods",
    section: "1.2",
    pdfPage: 13,
    page: 5,
    title: "Experiment Description",
    text: "The video overlay displayed the air velocity transducer reading in cm/s, fan voltage and radiometer signal. The fan voltage was calibrated against the airspeed transducer at the end of every operations day. The radiometer signal was uncalibrated and served to observe flame dynamics and steadiness.",
  },
  {
    id: "gases",
    section: "1.4",
    pdfPage: 14,
    page: 6,
    title: "Combustion Products",
    text: "O2, CO2 and CO sensor readings were taken before and after each test. Gaseous nitrogen from the ISS was used to dilute the atmosphere in the working volume and lower its O2 concentration.",
  },
  {
    id: "gravity",
    section: "2.3.7",
    pdfPage: 48,
    page: 40,
    title: "Results and Discussion",
    text: "Section 2.3.7 compares a normal-gravity, downward PMMA spread experiment with the ISS microgravity sample. In this comparison for 100 µm PMMA the normal-gravity average was 2.0 mm/s. The highest measured microgravity spread value was about 2.2 mm/s under the tested conditions.",
  },
];

/* ---------- Text analysis ---------- */

const normalize = (value) =>
  value.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");
const stopWords = new Set(
  "a al an and are as at be by con como cual cuales cuando de del did do does donde el en ensayo ensayos es esta este for from fue ha han hay how in informe is it la las lo los mas nasa o of on or para paso por que se segun si sobre son su sus the this to un una was were what when which with y".split(
    " ",
  ),
);

// Spanish query stems mapped to the English vocabulary of the report.
const glossary = [
  [
    /^extin|^exting|^apag|^supres|^suprim|^sofoc/,
    "extinction extinguish quench suppression suppress extinguisher",
  ],
  [/^fri[oa]s?$/, "cool"],
  [/^gota/, "droplet droplets"],
  [/^vela/, "candle"],
  [/^esfer/, "spherical sphere"],
  [/^gas(es|eos)?/, "gas gaseous"],
  [/^premezcl/, "premixed"],
  [/^supercrit/, "super critical supercritical"],
  [/^instalaci|^equipo/, "facilities facility hardware rack"],
  [/^guantera/, "glovebox"],
  [/^detec/, "detection detector"],
  [/^boyan|^flotab|^convec/, "buoyancy buoyant convection"],
  [/^difus/, "diffusion"],
  [/^sopl|^blowoff/, "blowoff"],
  [/^aire|^flujo|^ventil|^corriente/, "flow airflow velocity ventilation"],
  [/^velocidad|^rapid/, "velocity rate speed"],
  [/^redu|^cort|^baj|^dismin/, "reduce decrease lower off"],
  [/^encend|^ignic|^prend/, "ignition ignite igniter"],
  [/^propag|^avanz/, "spread propagation"],
  [/^oxigen/, "oxygen o2"],
  [/^llama/, "flame"],
  [/^fuego|^incendi/, "fire flame"],
  [/^gravedad/, "gravity"],
  [/^microgravedad/, "microgravity"],
  [/^tierra|^terrestre/, "normal gravity earth 1g"],
  [/^limite|^umbral|^frontera/, "limit boundary"],
  [/^inflamab/, "flammability flammable"],
  [/^material/, "material fuel sample"],
  [/^combustible/, "fuel"],
  [/^grosor|^espesor|^grues|^delgad|^fin[oa]s?$/, "thickness thick thin"],
  [/^varilla|^barra|^cilindr/, "rod cylinder"],
  [/^lamina|^pelicula|^hoja/, "film sheet"],
  [/^tela|^tejido/, "fabric"],
  [/^algodon/, "cotton"],
  [/^hollin/, "soot sooty"],
  [/^humo/, "smoke soot"],
  [/^azul/, "blue"],
  [/^calor|^termic/, "heat thermal"],
  [/^temperatura/, "temperature"],
  [/^radia/, "radiative radiation"],
  [/^radiom/, "radiometer"],
  [/^calibr/, "calibrated calibration calibrate uncalibrated"],
  [/^senal/, "signal"],
  [/^lectura/, "reading readings"],
  [/^lunar|^luna$/, "lunar moon partial gravity"],
  [/^perdida/, "loss"],
  [/^segur|^riesgo|^peligr/, "safety flammability hazard"],
  [/^nave|^espacial|^tripul/, "spacecraft crew"],
  [/^conclus|^result|^hallazg/, "conclusions results"],
  [/^opuest|^contra/, "opposed"],
  [/^concurrent|^favor/, "concurrent"],
  [/^estanc/, "stagnation"],
  [/^medi[cdr]|^sensor|^instrument/, "sensor measurement"],
  [/^monoxido/, "co monoxide"],
  [/^dioxido/, "co2 dioxide"],
  [/^nitrogen|^dilu/, "nitrogen dilution n2"],
  [/^presion/, "pressure"],
  [/^tasa|^ritmo/, "rate"],
  [/^quem|^arde|^ardi|^combust/, "burn burning combustion"],
  [/^critic/, "critical"],
  [/^duracion|^tiempo/, "time duration delay"],
  [/^tamano|^diametro|^ancho|^anchura/, "size diameter width"],
  [/^modelo|^simula|^numeric/, "model numerical computation"],
  [/^estrech|^canal/, "narrow channel"],
];

const stem = (word) =>
  word.length > 4
    ? word
        .replace(/(?:ing|ed|es|s)$/, "")
        .replace(/(?:tion|ment)s?$/, (suffix) => suffix.replace(/s$/, ""))
    : word;
const words = (value) =>
  (normalize(value).match(/[a-z0-9]+/g) || []).filter(
    (word) => !stopWords.has(word),
  );
const docTerms = (value) => words(value).map(stem);

function queryTerms(question) {
  const terms = new Set();
  for (const word of words(question)) {
    terms.add(stem(word));
    for (const [pattern, expansion] of glossary) {
      if (pattern.test(word))
        for (const extra of expansion.split(" ")) terms.add(stem(extra));
    }
  }
  return [...terms];
}

/* ---------- Scope of each part of the report ---------- */

// Each investigator ran different samples; a passage only describes its own series.
const scopes = {
  2: {
    table: "A.1",
    label: "Bhattacharjee: thin PMMA films, opposed flow (tests B)",
  },
  3: { table: "A.2", label: "Ferkul: Nomex fabric (tests F)" },
  4: {
    table: "A.3",
    label: "Fernandez-Pello: PMMA rods, opposed spread (tests P)",
  },
  5: {
    table: "A.4",
    label:
      "Miller and Wichman: PMMA slabs, narrow channel comparison (tests M)",
  },
  6: { table: "A.5", label: "Olson: PMMA rods in axial flow (tests O)" },
  7: {
    table: "A.6",
    label: "T'ien: SIBAL cotton-fiberglass fabric, concurrent flow (tests T)",
  },
};
const general =
  "All BASS-II: hardware, sensors, combustion products and overall conclusions";
const guideScope =
  "2015 overview of NASA microgravity combustion research (droplets, gas flames, solids, fire safety, ISS facilities); written before BASS-II results, not BASS-II test data";
const majorOf = (section) => String(section ?? "").split(".")[0];
const scopeOfChunk = (chunk) =>
  chunk.doc === "guide"
    ? guideScope
    : scopes[majorOf(chunk.section)]?.label || general;
const majorOfTable = (table) =>
  Object.keys(scopes).find((major) => scopes[major].table === table);

/* ---------- Index ---------- */

let reportChunks = [];
let vectorStore = null; // { dims, vectors: Map<id, Int8Array> }
const corpusCache = new WeakMap();

function decodeVector(encoded) {
  const binary = atob(encoded);
  const vector = new Int8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1)
    vector[i] = (binary.charCodeAt(i) << 24) >> 24;
  return vector;
}

/** Load the report passages and, optionally, their embedding vectors. */
export function loadIndex({ chunks, vectors } = {}) {
  if (Array.isArray(chunks)) reportChunks = chunks;
  vectorStore = vectors?.vectors
    ? {
        dims: vectors.dims,
        model: vectors.model,
        vectors: new Map(
          Object.entries(vectors.vectors).map(([id, value]) => [
            id,
            decodeVector(value),
          ]),
        ),
      }
    : null;
}

export const hasVectors = () => Boolean(vectorStore);
export const embeddingConfig = () =>
  vectorStore
    ? { model: vectorStore.model, dimensions: vectorStore.dims }
    : null;

function buildCorpus(trials) {
  const passages = [...methods, ...reportChunks].map((chunk) => ({
    kind: "report",
    id: chunk.id,
    doc: chunk.doc || "report",
    pdfPage: chunk.pdfPage,
    page: chunk.page,
    section: chunk.section,
    title: chunk.title,
    text: chunk.text,
    scope: scopeOfChunk(chunk),
    searchable: `${chunk.title} ${chunk.title} ${chunk.text}`,
  }));
  const tests = trials
    .filter((trial) => trial.report?.observation)
    .map((trial) => ({
      kind: "trial",
      id: trial.id,
      doc: "report",
      pdfPage: trial.report.pdfPage,
      page: trial.report.page,
      table: trial.report.table,
      text: trial.report.observation,
      scope: scopes[majorOfTable(trial.report.table)]?.label || general,
      setup: {
        sample: trial.sample,
        material: trial.family + " · " + trial.material,
        direction: trial.report.direction,
        initialO2CalibratedPercentByVolume: trial.initialO2,
        airDisplay: trial.air,
        ...(trial.id === "B3"
          ? { initialO2UncalibratedPercentByVolume: 20.9 }
          : {}),
      },
      searchable: `${trial.id === "O2" ? "" : trial.id} ${trial.family} ${trial.material} ${trial.report.layoutRaw || ""} ${trial.report.observation}`,
    }));
  const docs = [...passages, ...tests];
  const frequency = new Map();
  let total = 0;
  for (const doc of docs) {
    doc.terms = new Map();
    const list = docTerms(doc.searchable);
    for (const term of list)
      doc.terms.set(term, (doc.terms.get(term) || 0) + 1);
    doc.length = list.length;
    total += list.length;
    for (const term of doc.terms.keys())
      frequency.set(term, (frequency.get(term) || 0) + 1);
  }
  return {
    docs,
    frequency,
    average: total / Math.max(docs.length, 1),
    chunks: reportChunks,
  };
}

function corpusFor(trials) {
  let corpus = corpusCache.get(trials);
  if (!corpus || corpus.chunks !== reportChunks) {
    corpus = buildCorpus(trials);
    corpusCache.set(trials, corpus);
  }
  return corpus;
}

/* ---------- Ranking ---------- */

function lexicalScores({ docs, frequency, average }, terms) {
  const k1 = 1.4;
  const b = 0.7;
  return docs.map((doc) => {
    let score = 0;
    for (const term of terms) {
      const count = doc.terms.get(term);
      if (!count) continue;
      const idf = Math.log(
        1 +
          (docs.length - frequency.get(term) + 0.5) /
            (frequency.get(term) + 0.5),
      );
      score +=
        (idf * (count * (k1 + 1))) /
        (count + k1 * (1 - b + (b * doc.length) / average));
    }
    return score;
  });
}

function semanticScores(docs, queryVector) {
  if (!vectorStore || !queryVector || queryVector.length !== vectorStore.dims)
    return null;
  return docs.map((doc) => {
    const vector = vectorStore.vectors.get(doc.id);
    if (!vector) return 0;
    let dot = 0;
    let norm = 0;
    for (let i = 0; i < vector.length; i += 1) {
      dot += vector[i] * queryVector[i];
      norm += vector[i] * vector[i];
    }
    return norm ? dot / Math.sqrt(norm) : 0;
  });
}

const order = (scores) =>
  scores
    .map((score, index) => ({ score, index }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

const publicSource = ({
  kind,
  id,
  doc,
  pdfPage,
  page,
  table,
  section,
  title,
  text,
  setup,
  scope,
}) =>
  kind === "trial"
    ? { id, doc, pdfPage, page, table, text, setup, scope }
    : { id, doc, pdfPage, page, section, title, text, scope };

export function namedTrialEvidence(question, trials) {
  const asked = new Set(
    normalize(question).match(/\b[a-z]{1,2}\d{1,2}[a-z]?\b/g) || [],
  );
  // Keep the oxygen symbol separate from trial O2.
  const explicitTrialO2 =
    /\b(?:ensayos?|tests?|trials?)\s+o2\b/i.test(question) ||
    /^\s*o2\s*[?.!]?\s*$/i.test(question);
  return corpusFor(trials).docs.filter(
    (doc) =>
      doc.kind === "trial" &&
      asked.has(doc.id.toLowerCase()) &&
      (doc.id !== "O2" || explicitTrialO2),
  );
}

/**
 * Rank report passages and test observations for a question.
 * Lexical BM25 always runs; when a query embedding is supplied and vectors are
 * loaded, both rankings are merged with reciprocal rank fusion.
 */
export function rankEvidence(question, trials, limit = 9, queryVector = null) {
  const corpus = corpusFor(trials);
  const { docs } = corpus;
  const exact = namedTrialEvidence(question, trials);

  const lexical = order(lexicalScores(corpus, queryTerms(question)));
  const semanticRaw = semanticScores(docs, queryVector);
  const semantic = semanticRaw ? order(semanticRaw).slice(0, 40) : [];
  const fused = new Map();
  for (const ranking of [lexical.slice(0, 40), semantic]) {
    ranking.forEach(({ index }, position) =>
      fused.set(index, (fused.get(index) || 0) + 1 / (60 + position)),
    );
  }
  const best = lexical[0]?.score || 0;
  const ranked = [...fused.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([index]) => docs[index])
    .filter(
      (doc) =>
        semanticRaw || !best || lexicalRelevant(doc, lexical, docs, best),
    );

  // A question about named tests only takes passages from those tests' own series
  // (plus the general sections), and fewer of them, so other experiments do not leak in.
  const series = new Set(exact.map((doc) => majorOfTable(doc.table)));
  const allowed = (doc) =>
    !exact.length ||
    (doc.doc !== "guide" &&
      (!scopes[majorOf(doc.section)] || series.has(majorOf(doc.section))));
  const passageCap = exact.length ? 4 : limit;
  // The guide is background: it may take at most four slots while the report still has candidates.
  const guideCap = 4;
  let guideCount = 0;
  const held = [];
  const normalized = normalize(question);
  const topic =
    /radiomet/.test(normalized) && /calibr|signal|senal/.test(normalized)
      ? "methods"
      : /(?:\bo2\b|oxigen|oxygen)/.test(normalized) &&
          /(?:\bco2\b|nitrogen|dilu)/.test(normalized)
        ? "gases"
        : /\bpmma\b/.test(normalized) &&
            /grav/.test(normalized) &&
            /propag|spread/.test(normalized)
          ? "gravity"
          : null;
  const reference = exact.length === 0 && docs.find((doc) => doc.id === topic);
  const picked = reference ? [reference] : [...exact];
  const trialCap = exact.length ? exact.length : Math.ceil(limit / 2);
  let trialCount = exact.length;
  let passageCount = reference ? 1 : 0;
  for (const doc of ranked) {
    if (picked.length >= limit) break;
    if (picked.includes(doc)) continue;
    if (doc.kind === "trial") {
      if (trialCount >= trialCap) continue;
      trialCount += 1;
    } else {
      if (passageCount >= passageCap || !allowed(doc)) continue;
      if (doc.doc === "guide") {
        if (guideCount >= guideCap) {
          held.push(doc);
          continue;
        }
        guideCount += 1;
      }
      passageCount += 1;
    }
    picked.push(doc);
  }
  for (const doc of held) {
    if (picked.length >= limit || passageCount >= passageCap) break;
    picked.push(doc);
    passageCount += 1;
  }
  return picked.map(publicSource);
}

// Without embeddings, drop weak keyword matches so unrelated questions return nothing.
function lexicalRelevant(doc, lexical, docs, best) {
  const entry = lexical.find(({ index }) => docs[index] === doc);
  return entry && entry.score >= Math.max(1.2, best * 0.35);
}

/** Pick the sentences of a passage that best match the question. */
function excerpt(text, question, size = 2) {
  const terms = new Set(queryTerms(question));
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z(])/);
  if (sentences.length <= size) return text;
  const scored = sentences
    .map((sentence, index) => ({
      index,
      score: docTerms(sentence).filter((term) => terms.has(term)).length,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, size)
    .sort((a, b) => a.index - b.index);
  return scored.map(({ index }) => sentences[index]).join(" … ");
}

function trialExcerpt(source, airOrDirection, asksOxygen) {
  const {
    direction,
    airDisplay,
    initialO2CalibratedPercentByVolume: calibrated,
    initialO2UncalibratedPercentByVolume: uncalibrated,
  } = source.setup;
  const context = [];
  if (airOrDirection) {
    if (direction) context.push(`Flujo: ${direction}.`);
    if (airDisplay) {
      const air = airReading(airDisplay);
      context.push(
        `Air display: ${air.value === null ? airDisplay + " (registro original)" : air.value + " cm/s"}.`,
      );
    }
  }
  if (asksOxygen && calibrated != null)
    context.push(
      `O₂ inicial calibrado: ${String(calibrated).replace(".", ",")} %.`,
    );
  if (asksOxygen && uncalibrated != null)
    context.push(
      `O₂ inicial sin calibrar: ${String(uncalibrated).replace(".", ",")} %.`,
    );
  return [
    `${source.id} · ${featuredNotes[source.id] || source.text}`,
    ...context,
  ].join(" ");
}

export const asksLunarSpread = (question) => {
  const normalized = normalize(question);
  return (
    /\b(?:luna|lunar|moon)\b/.test(normalized) &&
    /\bpmma\b/.test(normalized) &&
    /propag|spread/.test(normalized)
  );
};

export function findEvidence(question, trials, note = "") {
  const named = namedTrialEvidence(question, trials);
  const records = named.length
    ? named.slice(0, 4).map(publicSource)
    : rankEvidence(question, trials, 4);
  if (asksLunarSpread(question) && records[0]?.id === "gravity") {
    return {
      mode: "search",
      note,
      claims: [
        {
          text: "Los ensayos citados comparan la propagación descendente en gravedad normal con microgravedad en la ISS. La evidencia disponible no permite calcular una velocidad de propagación en gravedad lunar.",
          sources: [records[0]],
        },
      ],
    };
  }
  const airOrDirection = /aire|flujo|air|flow|direccion/.test(
    normalize(question),
  );
  const asksOxygen = /\bo2\b|oxigen|oxygen/.test(normalize(question));
  const completePassages = new Set(methods.map((source) => source.id));
  return {
    mode: "search",
    note,
    claims: records.length
      ? records.map((source) => ({
          text: source.setup
            ? trialExcerpt(source, airOrDirection, asksOxygen)
            : `${source.title ? `${source.title}: ` : ""}${completePassages.has(source.id) ? source.text : excerpt(source.text, question)}`,
          sources: [source],
        }))
      : [
          {
            text: "No hay pasajes vinculados que respondan a esa pregunta. Prueba con un identificador de ensayo como B1, B3 o F1.",
            sources: [],
          },
        ],
  };
}
