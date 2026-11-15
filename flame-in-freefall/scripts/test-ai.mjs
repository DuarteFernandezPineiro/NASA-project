
import { readFile } from "node:fs/promises";
import { parseArgs, parseEnv } from "node:util";
import { handleAsk } from "../assistant.mjs";
import { loadIndex, reportLink } from "../dist/evidence.js";

const { positionals, values } = parseArgs({
  allowPositionals: true, options: { "env-file": { type: "string" } },
});
const mode = positionals[0] ?? "search";
if (positionals.length > 1 || !["search", "ai"].includes(mode) || (values["env-file"] && mode !== "ai")) {
  throw new Error("Usage: npm run test:ai -- [search|ai] [--env-file PATH]");
}

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const optional = async (path) => {
  try { return await read(path); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
};
const [markdown, data, chunks, vectors, dotenv] = await Promise.all([
  read("../PRUEBAS-IA.md"), read("../dist/trials.json"), read("../dist/chunks.json"),
  mode === "ai" ? optional("../dist/vectors.json") : undefined,
  mode === "ai" ? (values["env-file"] ? readFile(values["env-file"], "utf8") : optional("../.env")) : undefined,
]);
const trials = JSON.parse(data);
loadIndex({ chunks: JSON.parse(chunks), vectors: vectors && JSON.parse(vectors) });
const local = dotenv ? parseEnv(dotenv) : {};
const env = mode === "ai" ? {
  OPENAI_API_KEY: local.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  OPENAI_MODEL: local.OPENAI_MODEL || process.env.OPENAI_MODEL,
} : {};
if (mode === "ai" && !env.OPENAI_API_KEY) throw new Error("Configure OPENAI_API_KEY before running AI generation.");

const normalize = (text) => text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/\s+/g, " ");
const cutoff = /cort|interrump|apag.{0,24}flujo|detuv.{0,24}flujo|cut off|turned flow off/;
const extinguished = /exting|apag|flame out/;
const opposed = /opuest|oppos/;
const quickIgnition = /(?:prend|ignit|encend).{0,32}(?:rapid|enseguida|quick|inmediat)/;
const noSpread = /(?:no (?:se )?(?:propag|extend)|sin propag|did not spread)/;
const igniterOn = /(?:ignit|encend).{0,48}(?:encendid|activ|on\b)|(?:sigui|mantuvo).{0,32}(?:encendid|activ)/;
const noSustain = /(?:no|sin|not).{0,36}(?:sost|mantu|mantuv|sustain)/;
const noReadings = /(?:no|sin).{0,90}(?:lectura|medicion|sensor reading).{0,70}(?:posterior|despues)|no postburn sensor readings/;
const speedUnit = /(?:\d\s*(?:cm|mm|m)\s*(?:\/\s*(?:s|seg)|\s·?\s*s\s*[-−]\s*1)|\d\s*(?:milimetro|centimetro|metro)s?\s+por\s+segundo)/;
const unsupportedLunar = /(?:insuficien|no permite|no se puede|no es posible|no (?:hay|existen)|no puede|no podemos|no se dispone|cannot|insufficien)/;

// Each group checks facts in claims attributed to the corresponding NASA source.
// Printed pages and PDF targets come from the Markdown table.
const checks = [
  [["B1", quickIgnition, /mitad|half/, cutoff, extinguished]],
  [["B3", /22[.,]2\s*%/, /calibrad/, /20[.,]6\s*%/, /probabl|estim|nota|observacion/]],
  [
    ["B1", /\b5\s*cm\/s/, opposed, cutoff, extinguished],
    ["B3", /\b2\s*cm\/s/, opposed, /azul|blue/, /hollin|soot/],
  ],
  [["B22", /(?:ignit|ignic|prend|encend)/, /\b5\s*cm\/s/, /0[.,]36/, /potenciomet|fan pot|ajuste.{0,40}ventilador/, extinguished]],
  [["F1", /breve|brief|momentane|fugaz/, noSpread, igniterOn, extinguished]],
  [
    ["F1", /breve|brief|momentane|fugaz/, noSpread, igniterOn],
    ["F2", noSustain],
    ["F3", /destello|flash|llamarada/, noSustain, noReadings],
  ],
  [[null, /(?:sin calibr|no.{0,45}calibr|uncalibrated)/, /dinamic|dynamic/, /estabil|steady|steadiness/, /ventilador|fan voltage/, /(?:cada|every).{0,25}(?:jornada|dia|day)/]],
  [[null, /antes.{0,35}despues|before.{0,20}after/, /nitrogen/, /dilu/, /\biss\b|estacion espacial/]],
  [[null, /2[.,]0\s*mm\/s/, /media|promedio|average/, /descendent|downward/, /2[.,]2\s*mm\/s/, /maxim|highest/, /micrograv/]],
  [[null, /gravedad normal|normal.gravity/, /micrograv/]],
];

const questionTable = markdown.split(/^## /m, 1)[0];
const cases = questionTable.split(/\r?\n/).flatMap((line) => {
  const row = /^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/.exec(line);
  if (!row) return [];
  const [, id, question, expected, citations] = row;
  const links = [...citations.matchAll(/https:\/\/ntrs\.nasa\.gov\/[^)\s]+#page=(\d+)/g)];
  return [{ id: Number(id), question, expected, urls: links.map(([url]) => url) }];
});
if (cases.length !== checks.length || cases.some(({ id, urls }, i) => id !== i + 1 || !urls.length)) {
  throw new Error("PRUEBAS-IA.md must contain the ten numbered questions and their NASA PDF links.");
}

let failed = 0;
for (const { id, question, expected, urls } of cases) {
  const request = new Request("http://localhost/api/ask", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }),
  });
  const response = await handleAsk(request, trials, env);
  const result = await response.json();
  const claims = result.claims ?? [];
  const text = normalize(claims.map((claim) => claim.text).join(" "));
  const sources = claims.flatMap((claim) => claim.sources);
  const isExpectedSource = (source) => source.doc === "report" && source.pdfPage === source.page + 8
    && urls.includes(reportLink(source));
  const failures = [];
  if (!response.ok) failures.push("HTTP " + response.status);
  if (result.mode !== mode) failures.push("mode " + result.mode + ", expected " + mode);
  for (const url of urls) {
    if (!sources.some((source) => isExpectedSource(source) && reportLink(source) === url)) failures.push("missing " + url);
  }
  for (const [trial, ...facts] of checks[id - 1]) {
    const relevant = claims.filter((claim) => claim.sources.some((source) =>
      isExpectedSource(source) && (!trial || source.id === trial)));
    const supported = normalize(relevant.map((claim) => claim.text).join(" "));
    if (!relevant.length) failures.push("missing citation for " + (trial || "report passage"));
    for (const fact of facts) {
      if (!fact.test(supported)) failures.push((trial ? trial + " " : "") + "missing evidence matching " + fact);
    }
  }
  if (id === 4 && /0[.,]36\s*(?:cm|mm|m)\s*\/\s*s/i.test(text)) failures.push("potentiometer setting expressed as a speed");
  if (id === 10 && (!unsupportedLunar.test(text) || speedUnit.test(text))) failures.push("lunar answer must abstain without giving a speed");

  const tags = [...new Set(sources.filter(isExpectedSource).map((source) => source.id + " p." + source.page))];
  console.log([id, failures.length ? "FAIL" : "PASS", result.mode, result.retrieval, tags.join(", ")].filter(Boolean).join(" | "));
  if (failures.length) {
    failed++;
    console.error("  " + failures.join("\n  ") + "\n  Expected: " + expected + "\n  Actual: " + claims.map((claim) => claim.text).join(" "));
    if (result.note) console.error("  " + result.note);
  }
}

console.log((cases.length - failed) + "/" + cases.length + " passed (" + mode + ")");
process.exitCode = Number(failed > 0);
