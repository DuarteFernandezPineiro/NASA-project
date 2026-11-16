import { createReadStream } from "node:fs";
import { stat, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { parseEnv } from "node:util";
import { handleAsk } from "./assistant.mjs";
import { loadIndex } from "./dist/evidence.js";

const root = new URL("./dist/", import.meta.url);
const trials = JSON.parse(await readFile(new URL("trials.json", root), "utf8"));
const optionalJson = async (name) => {
  try {
    return JSON.parse(await readFile(new URL(name, root), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  }
};
// Report passages (scripts/build-index.py) and, when generated, their embedding vectors.
loadIndex({
  chunks: await optionalJson("chunks.json"),
  vectors: await optionalJson("vectors.json"),
});
let localConfig = {};
try {
  localConfig = parseEnv(
    await readFile(new URL("./.env", import.meta.url), "utf8"),
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const assistantEnv = {
  OPENAI_API_KEY: localConfig.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  OPENAI_MODEL: localConfig.OPENAI_MODEL || process.env.OPENAI_MODEL,
};
const types = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  mp4: "video/mp4",
  webp: "image/webp",
};

async function handle(req, res) {
  if (
    !["127.0.0.1", "localhost"].includes(
      (req.headers.host || "").replace(/:\d+$/, ""),
    )
  ) {
    res.writeHead(403).end();
    return;
  }
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname === "/api/ask") {
    const request = new Request(
      new URL(url.pathname, `http://${req.headers.host}`),
      {
        method: req.method,
        headers: req.headers,
        ...(req.method === "POST"
          ? { body: Readable.toWeb(req), duplex: "half" }
          : {}),
      },
    );
    const response = await handleAsk(request, trials, assistantEnv);
    res
      .writeHead(response.status, Object.fromEntries(response.headers))
      .end(await response.text());
    return;
  }
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  const name = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  if (
    !/^(?:index\.html|style\.css|app\.js|evidence\.js|trials\.json|psi-extra\.json|psi-catalog\.json|datasets\.js|chunks\.json|media\/(?:[a-z]\d+[a-z]?(?:-second|-stills)?\.mp4|(?:[a-z]\d+[a-z]?|hero)\.webp))$/.test(
      name,
    )
  ) {
    res.writeHead(404).end("Recurso no encontrado");
    return;
  }
  const path = new URL(name, root);
  let size;
  try {
    ({ size } = await stat(path));
  } catch {
    res.writeHead(404).end("Recurso no encontrado");
    return;
  }
  let start = 0;
  let end = size - 1;
  const range = req.headers.range;
  const headers = {
    "Content-Type": types[name.split(".").at(-1)],
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  };
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match?.[1]) {
      start = Number(match[1]);
      if (match[2]) end = Math.min(Number(match[2]), end);
    } else if (match?.[2]) {
      start = Math.max(size - Number(match[2]), 0);
    }
    if (!match || (!match[1] && !match[2]) || start > end || start >= size) {
      res.writeHead(416, { "Content-Range": `bytes */${size}` }).end();
      return;
    }
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  res.writeHead(range ? 206 : 200, {
    ...headers,
    "Content-Length": end - start + 1,
  });
  if (req.method === "HEAD") res.end();
  else {
    const stream = createReadStream(path, { start, end });
    res.on("close", () => stream.destroy());
    stream.on("error", () => res.destroy());
    stream.pipe(res);
  }
}

const port = Number(process.env.PORT || 4187);
createServer((req, res) => {
  handle(req, res).catch(() => {
    if (!res.headersSent) res.writeHead(500).end("Error del servidor");
    else res.destroy();
  });
}).listen(port, "127.0.0.1", () =>
  console.log(`Flame in Freefall · http://127.0.0.1:${port}`),
);
