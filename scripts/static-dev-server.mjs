import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const port = Number(process.env.PORT || 4173);
const root = resolve(process.cwd());

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

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
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
