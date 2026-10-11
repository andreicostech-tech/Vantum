// API-ul panoului de control: autentificare cu utilizator + parolă și acces la fișierele de conținut.
// Rulează ca funcție serverless (Netlify / Vercel) și în `npm run dev`.
// Browserul nu vede niciodată tokenul GitHub — acesta stă doar în variabilele de mediu ale serverului.
//
// Rute: /api/admin?action=login|me|read|list|write|remove|history

import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, readdir, mkdir, unlink, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

const WRITABLE = ["content/", "assets/uploads/"];
const SESSION_DAYS = { short: 1, long: 30 };

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/* ---------- Stocare ---------- */

export class FsBackend {
  mode = "local";
  label = "Local · fișiere pe disc";
  constructor(root) { this.root = root; }

  async read(path) {
    const file = join(this.root, path);
    if (!existsSync(file)) throw new HttpError(404, "Fișier inexistent");
    return { text: await readFile(file, "utf8"), sha: String((await stat(file)).mtimeMs) };
  }
  async list(dir) {
    const abs = join(this.root, dir);
    if (!existsSync(abs)) return [];
    return (await readdir(abs)).map((name) => ({ name, path: `${dir}/${name}` }));
  }
  async write(path, content, { encoding = "utf8" } = {}) {
    const file = join(this.root, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(content, encoding));
    return String((await stat(file)).mtimeMs);
  }
  async remove(path) {
    const file = join(this.root, path);
    if (existsSync(file)) await unlink(file);
  }
  async history() { return []; }
}

export class GitHubBackend {
  mode = "github";
  constructor({ repo, branch, token }) {
    Object.assign(this, { repo, branch, token });
    this.label = `GitHub · ${repo}@${branch}`;
  }

  async call(method, url, body) {
    const r = await fetch(`https://api.github.com/repos/${this.repo}${url}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "vantum-admin",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = {
        401: "Tokenul GitHub de pe server este invalid sau expirat.",
        403: "Tokenul GitHub de pe server nu are drept de scriere (Contents: Read and write).",
        404: "Nu am găsit repo-ul sau fișierul pe GitHub.",
        409: "Fișierul a fost modificat între timp. Reîncarcă pagina și reîncearcă.",
        422: "GitHub a respins modificarea (fișierul a fost probabil modificat între timp).",
      }[r.status];
      throw new HttpError(r.status === 401 || r.status === 403 ? 502 : r.status, msg || data.message || `Eroare GitHub ${r.status}`);
    }
    return data;
  }
  contents(path) {
    return `/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
  }
  ref() { return `?ref=${encodeURIComponent(this.branch)}`; }

  async read(path) {
    const d = await this.call("GET", this.contents(path) + this.ref());
    return { text: Buffer.from(d.content, "base64").toString("utf8"), sha: d.sha };
  }
  async list(dir) {
    try {
      const d = await this.call("GET", this.contents(dir) + this.ref());
      return d.map((f) => ({ name: f.name, path: f.path, sha: f.sha }));
    } catch (e) {
      if (e.status === 404) return [];
      throw e;
    }
  }
  async write(path, content, { encoding = "utf8", sha, message } = {}) {
    const d = await this.call("PUT", this.contents(path), {
      message: message || `Actualizează ${path}`,
      content: encoding === "base64" ? content : Buffer.from(content, "utf8").toString("base64"),
      branch: this.branch,
      ...(sha ? { sha } : {}),
    });
    return d.content.sha;
  }
  async remove(path, { sha, message } = {}) {
    if (!sha) sha = (await this.read(path)).sha;
    await this.call("DELETE", this.contents(path), { message: message || `Șterge ${path}`, sha, branch: this.branch });
  }
  async history(limit = 6) {
    const list = await this.call("GET", `/commits?sha=${encodeURIComponent(this.branch)}&per_page=${limit}`);
    return list.map((c) => ({
      message: c.commit.message.split("\n")[0],
      date: c.commit.author?.date,
      url: c.html_url,
    }));
  }
}

/* ---------- Sesiuni ---------- */

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const digest = (s) => createHash("sha256").update(String(s)).digest();
const same = (a, b) => timingSafeEqual(digest(a), digest(b));

function sign(payload, secret) {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${b64url(createHmac("sha256", secret).update(body).digest())}`;
}
function verify(token, secret) {
  const [body, sig] = String(token).split(".");
  if (!body || !sig) return null;
  const expected = b64url(createHmac("sha256", secret).update(body).digest());
  if (!same(sig, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

function safePath(p) {
  const path = String(p || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!path || path.split("/").some((s) => s === ".." || s === ".") || !WRITABLE.some((w) => path.startsWith(w) || path + "/" === w)) {
    throw new HttpError(403, "Cale nepermisă");
  }
  return path.replace(/\/$/, "");
}

/* ---------- Handler ---------- */

const json = (status, data) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export function createAdminApi({ backend, user, password, secret }) {
  return async function handle(request) {
    try {
      if (!backend || !user || !password || !secret) {
        throw new HttpError(500, "Panoul nu este configurat pe server (lipsesc variabilele ADMIN_USER, ADMIN_PASSWORD sau GITHUB_TOKEN / GITHUB_REPO).");
      }
      const url = new URL(request.url);
      const action = url.searchParams.get("action");
      const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};

      if (action === "login") {
        const ok = same(body.user ?? "", user) & same(body.password ?? "", password);
        if (!ok) {
          await new Promise((r) => setTimeout(r, 800)); // încetinește încercările repetate
          throw new HttpError(401, "Utilizator sau parolă greșită.");
        }
        const days = body.remember ? SESSION_DAYS.long : SESSION_DAYS.short;
        const token = sign({ u: user, exp: Date.now() + days * 864e5 }, secret);
        return json(200, { token, mode: backend.mode, label: backend.label });
      }

      const session = verify((request.headers.get("authorization") || "").replace(/^Bearer /, ""), secret);
      if (!session) throw new HttpError(401, "Sesiunea a expirat. Autentifică-te din nou.");

      switch (action) {
        case "me":
          return json(200, { user: session.u, mode: backend.mode, label: backend.label });
        case "read":
          return json(200, await backend.read(safePath(url.searchParams.get("path"))));
        case "list":
          return json(200, await backend.list(safePath(url.searchParams.get("path"))));
        case "history":
          return json(200, await backend.history());
        case "write": {
          if (request.method !== "POST") break;
          const sha = await backend.write(safePath(body.path), body.content ?? "", {
            encoding: body.encoding === "base64" ? "base64" : "utf8", sha: body.sha, message: body.message,
          });
          return json(200, { sha });
        }
        case "remove":
          if (request.method !== "POST") break;
          await backend.remove(safePath(body.path), { sha: body.sha, message: body.message });
          return json(200, { ok: true });
      }
      throw new HttpError(404, "Acțiune necunoscută");
    } catch (err) {
      if (!err.status) console.error(err);
      return json(err.status || 500, { error: err.status ? err.message : "Eroare de server." });
    }
  };
}

// Configurare din variabilele de mediu (Netlify / Vercel)
export function adminApiFromEnv(env = process.env) {
  const backend = env.GITHUB_TOKEN && env.GITHUB_REPO
    ? new GitHubBackend({ repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH || "main", token: env.GITHUB_TOKEN })
    : null;
  const secret = env.ADMIN_SECRET || (env.GITHUB_TOKEN && env.ADMIN_PASSWORD
    ? createHash("sha256").update(`${env.GITHUB_TOKEN}:${env.ADMIN_PASSWORD}`).digest("hex")
    : "");
  return createAdminApi({ backend, user: env.ADMIN_USER, password: env.ADMIN_PASSWORD, secret });
}
