// Server local: npm run dev  →  http://localhost:4321  (panou: /admin/)
// - reconstruiește dist/ la orice modificare în content/, src/, admin/, assets/ și fișierele site-ului
// - reîncarcă automat paginile deschise
// - panoul scrie direct în fișierele locale (fără GitHub); login implicit: admin / admin

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { watch, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./build.mjs";
import { createAdminApi, FsBackend } from "./server/admin-api.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, "dist");
const PORT = Number(process.env.PORT) || 4321;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".avif": "image/avif", ".ico": "image/x-icon", ".woff2": "font/woff2",
};

const clients = new Set();
const RELOAD = `<script>new EventSource("/__dev/events").onmessage=()=>location.reload()</script>`;

let timer;
let building = build({ drafts: true }); // build-urile rulează strict unul după altul
function rebuild() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    building = building
      .then(() => build({ drafts: true }))
      .then(() => clients.forEach((res) => res.write("data: reload\n\n")))
      .catch((e) => console.error("✗ build:", e.message));
  }, 120);
}

for (const target of ["content", "src", "admin", "assets", "index.html", "styles.css", "script.js", "i18n.js", "blog.js"]) {
  const p = join(ROOT, target);
  if (existsSync(p)) watch(p, { recursive: true }, rebuild);
}

/* ---------- API panou (aceeași logică ca online, dar scrie pe disc) ---------- */

const adminApi = createAdminApi({
  backend: new FsBackend(ROOT),
  user: process.env.ADMIN_USER || "admin",
  password: process.env.ADMIN_PASSWORD || "admin",
  secret: process.env.ADMIN_SECRET || `local-dev:${ROOT}`,
});

async function api(req, res) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const request = new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: chunks.length ? Buffer.concat(chunks) : undefined,
  });
  const response = await adminApi(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

function events(req, res) {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  clients.add(res);
  req.on("close", () => clients.delete(res));
}

const json = (res, code, data) => {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
};

/* ---------- Fișiere statice din dist/ ---------- */

async function serve(req, res, url) {
  await building;
  let file = join(DIST, decodeURIComponent(url.pathname));
  if (!file.startsWith(DIST)) return res.writeHead(403).end();
  if (existsSync(file) && (await stat(file)).isDirectory()) {
    if (!url.pathname.endsWith("/")) return res.writeHead(301, { location: url.pathname + "/" }).end();
    file = join(file, "index.html");
  }
  // Paginile panoului (/admin/articole, /admin/continut/…) sunt servite de aceeași aplicație
  if (!existsSync(file) && url.pathname.startsWith("/admin/") && !extname(url.pathname)) file = join(DIST, "admin", "index.html");
  if (!existsSync(file)) return res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("404 — pagina nu există");
  const type = TYPES[extname(file).toLowerCase()] || "application/octet-stream";
  let data = await readFile(file);
  if (type.startsWith("text/html") && !url.pathname.startsWith("/admin")) data = data.toString().replace("</body>", `${RELOAD}</body>`);
  res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
  res.end(data);
}

await building;
createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === "/api/admin") await api(req, res);
    else if (url.pathname === "/__dev/events") events(req, res);
    else await serve(req, res, url);
  } catch (e) {
    json(res, e.status || 500, { error: e.message });
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`\n  Site:  http://localhost:${PORT}\n  Panou: http://localhost:${PORT}/admin/\n`);
});
