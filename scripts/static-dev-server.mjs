import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const port = Number(process.env.PORT || 4173);
const root = resolve(process.cwd());
const movementPatternsFile = resolve(root, "src/data/enemy-movement-patterns.json");

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".json", "application/json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".ico", "image/x-icon"]
]);

function resolveFile(urlPath) {
  const rawPath = urlPath === "/" ? "/index.html" : decodeURIComponent(urlPath);
  const target = normalize(join(root, rawPath));
  if (!target.startsWith(root)) return null;
  if (existsSync(target) && statSync(target).isFile()) return target;
  return null;
}

function readJsonBody(req) {
  return new Promise((resolvePromise, rejectPromise) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        rejectPromise(new Error("Request body too large."));
      }
    });
    req.on("end", () => {
      try {
        resolvePromise(raw ? JSON.parse(raw) : null);
      } catch (error) {
        rejectPromise(error);
      }
    });
    req.on("error", rejectPromise);
  });
}

function readMovementPatterns() {
  try {
    const raw = existsSync(movementPatternsFile) ? readFileSync(movementPatternsFile, "utf8") : "[]";
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeMovementPatterns(patterns) {
  writeFileSync(movementPatternsFile, JSON.stringify(patterns, null, 2));
}

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "POST" && url.pathname === "/api/enemy-movement-patterns") {
    readJsonBody(req)
      .then((payload) => {
        const pattern = payload?.pattern;
        if (!pattern || typeof pattern !== "object" || !Array.isArray(pattern.steps)) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: "Invalid pattern payload." }));
          return;
        }
        const patterns = readMovementPatterns();
        patterns.push(pattern);
        writeMovementPatterns(patterns);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        res.end(JSON.stringify({ ok: true, count: patterns.length, file: "src/data/enemy-movement-patterns.json" }));
      })
      .catch((error) => {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: String(error?.message || error) }));
      });
    return;
  }

  const filePath = resolveFile(url.pathname);
  if (!filePath) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": mimeTypes.get(extname(filePath)) || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  createReadStream(filePath).pipe(res);
});

server.listen(port, () => {
  console.log(`Dark Mage Roguelike server running at http://127.0.0.1:${port}`);
});
