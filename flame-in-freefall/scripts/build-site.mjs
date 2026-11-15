import { cp, mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const client = new URL("dist/client/", root);
const server = new URL("dist/server/", root);
await mkdir(client, { recursive: true });
await mkdir(server, { recursive: true });
for (const path of ["index.html", "style.css", "trials.json", "psi-extra.json", "chunks.json", "app.js", "evidence.js", "media"]) {
  await cp(new URL(`dist/${path}`, root), new URL(path, client), { recursive: true });
}
const evidence = await readFile(new URL("dist/evidence.js", root), "utf8");
const assistant = (await readFile(new URL("assistant.mjs", root), "utf8"))
  .replace(/^import \{[^}]+\} from "\.\/dist\/evidence\.js";\r?\n/m, "");
const data = await readFile(new URL("dist/trials.json", root), "utf8");
const optional = async (path) => {
  try { return await readFile(new URL(path, root), "utf8"); }
  catch (error) { if (error.code !== "ENOENT") throw error; return "undefined"; }
};
const chunks = await optional("dist/chunks.json");
const vectors = await optional("dist/vectors.json");
await writeFile(new URL("index.js", server), `${evidence}\n${assistant}
const trials = ${data};
loadIndex({ chunks: ${chunks}, vectors: ${vectors} });
export default {
  fetch(request, env) {
    if (new URL(request.url).pathname === "/api/ask") return handleAsk(request, trials, env);
    return env.ASSETS.fetch(request);
  }
};
`);
await writeFile(new URL("wrangler.json", server), JSON.stringify({
  main: "index.js",
  compatibility_date: "2025-05-01",
  assets: { directory: "../client", binding: "ASSETS", run_worker_first: ["/api/*"] },
}, null, 2) + "\n");
