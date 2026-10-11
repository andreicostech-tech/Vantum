// Panoul lucrează cu fișiere (content/*.json, content/blog/*.md, assets/uploads/*) prin /api/admin.
// Serverul decide unde ajung: pe disc (`npm run dev`) sau ca commit în GitHub (site-ul publicat).

const API = "/api/admin";

export class StoreError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function call(action, { token, params = {}, body } = {}) {
  const qs = new URLSearchParams({ action, ...params });
  let r;
  try {
    r = await fetch(`${API}?${qs}`, {
      method: body ? "POST" : "GET",
      cache: "no-store",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new StoreError("Serverul nu răspunde. Verifică conexiunea.", 0);
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = r.status === 413 ? "Fișierul este prea mare." : data.error || `Eroare ${r.status}`;
    throw new StoreError(msg, r.status);
  }
  return data;
}

export async function login(user, password, remember) {
  return call("login", { body: { user, password, remember } });
}

export class ApiStore {
  constructor({ token, mode, label }) {
    Object.assign(this, { token, mode, label });
  }
  static async resume(token) {
    const me = await call("me", { token });
    return new ApiStore({ token, mode: me.mode, label: me.label });
  }

  async read(path) {
    return call("read", { token: this.token, params: { path } });
  }
  list(dir) {
    return call("list", { token: this.token, params: { path: dir } });
  }
  async write(path, content, { sha, message } = {}) {
    return (await call("write", { token: this.token, body: { path, content, sha, message } })).sha;
  }
  async upload(path, base64, { message } = {}) {
    await call("write", { token: this.token, body: { path, content: base64, encoding: "base64", message } });
  }
  async remove(path, { sha, message } = {}) {
    await call("remove", { token: this.token, body: { path, sha, message } });
  }
  history() {
    return call("history", { token: this.token });
  }
}
