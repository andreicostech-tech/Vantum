// Panoul de control vantumit.ro — adrese: /admin/  /admin/articole[/nou|/<slug>]  /admin/texte/<limbă>/<grup>  /admin/proiecte/<limbă>

import config from "../config.js";
import { ApiStore, login } from "./store.js";
import { parsePost, serializePost, slugify, readingTime, formatDate } from "../lib/post-format.js";
import { marked } from "../vendor/marked.esm.js";

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pad = (n) => String(n).padStart(2, "0");
const today = () => new Date().toISOString().slice(0, 10);
const clone = (o) => JSON.parse(JSON.stringify(o));

const BLOG_DIR = "content/blog";
const TEXTS_FILE = "content/i18n.json";
const UPLOADS = "assets/uploads";
const AUTH_KEY = "vantum-admin";

const app = $("#app");
let store = null;
let posts = null;           // cache: [{ slug, path, sha, data, body }]
let texts = null;           // cache: { data, sha } pentru content/i18n.json
let view = null;            // vizualizarea curentă: { area, dirty, save }
const previews = new Map(); // imagini încărcate în sesiune → dataURL (online apar pe site abia după deploy)

/* ---------- Utilitare DOM ---------- */

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k in node && k !== "list") node[k] = v;
    else node.setAttribute(k, v === true ? "" : v);
  }
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
}

function toast(msg, type = "ok") {
  const t = el("div", { class: `toast toast--${type}` }, msg);
  $("#toasts").append(t);
  setTimeout(() => { t.classList.add("is-out"); setTimeout(() => t.remove(), 400); }, type === "err" ? 7000 : 4500);
}

const loading = (text = "Se încarcă…") =>
  `<div class="loading"><span class="spinner"></span>${esc(text)}</div>`;

const savedHint = () =>
  store.mode === "github" ? "Salvat. Site-ul se actualizează în aproximativ un minut." : "Salvat în fișiere. Site-ul local s-a reconstruit.";

const imgSrc = (path) => previews.get(path) || path;

function autoGrow(ta) {
  const fit = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; };
  ta.addEventListener("input", fit);
  requestAnimationFrame(fit);
}

/* ---------- Autentificare ---------- */

function loadToken() {
  for (const st of [localStorage, sessionStorage]) {
    try { const t = st.getItem(AUTH_KEY); if (t) return t; } catch {}
  }
  return null;
}
function saveToken(token, remember) {
  try { (remember ? localStorage : sessionStorage).setItem(AUTH_KEY, token); } catch {}
}
function clearToken() {
  for (const st of [localStorage, sessionStorage]) { try { st.removeItem(AUTH_KEY); } catch {} }
}

function renderLogin(error = "") {
  app.innerHTML = `
    <div class="login">
      <div class="hero__glow"></div>
      <div class="login__card">
        <a class="logo" href="${esc(config.siteUrl)}">V<span>A</span>NTUM</a>
        <p class="eyebrow"><span class="dot"></span> Panou de control</p>
        <h1 class="login__title">Bine ai <em class="outline">revenit.</em></h1>
        <form id="loginForm">
          <label class="field">
            <span class="field__label">Utilizator</span>
            <input class="input" name="user" autocomplete="username" autocapitalize="off" spellcheck="false" required>
          </label>
          <label class="field">
            <span class="field__label">Parolă</span>
            <input class="input" name="password" type="password" autocomplete="current-password" required>
          </label>
          <label class="check"><input type="checkbox" name="remember" checked> Ține-mă minte pe acest dispozitiv</label>
          <p class="form-error" id="loginError">${esc(error)}</p>
          <button class="btn btn--primary" type="submit"><span>Intră în panou</span><span class="btn__arrow">↗</span></button>
        </form>
      </div>
    </div>`;
  $("#loginForm [name=user]").focus();

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const remember = !!f.get("remember");
    const btn = $("button[type=submit]", e.target);
    btn.disabled = true;
    $("#loginError").textContent = "";
    try {
      const res = await login(f.get("user").trim(), f.get("password"), remember);
      saveToken(res.token, remember);
      store = new ApiStore(res);
      start();
    } catch (err) {
      $("#loginError").textContent = err.message;
      btn.disabled = false;
      $("#loginForm [name=password]").select();
    }
  });
}

/* ---------- Shell + rutare ---------- */

function renderShell() {
  const siteUrl = store.mode === "local" ? "/" : config.siteUrl;
  app.innerHTML = `
    <div class="adm">
      <aside class="side">
        <a class="side__brand" href="/admin/"><span class="logo">V<span>A</span>NTUM</span><span class="side__tag">admin</span></a>
        <nav class="side__nav">
          <a href="/admin/" data-area="home"><i>01</i>Panou</a>
          <a href="/admin/articole" data-area="posts"><i>02</i>Articole</a>
          <a href="/admin/texte" data-area="texte"><i>03</i>Texte site</a>
          <a href="/admin/proiecte" data-area="proiecte"><i>04</i>Proiecte</a>
        </nav>
        <div class="side__foot">
          <div class="mode"><span class="dot"></span>${esc(store.label)}</div>
          <a href="${esc(siteUrl)}" target="_blank" rel="noopener">Vezi site-ul ↗</a>
          <button id="logout">Ieșire</button>
        </div>
      </aside>
      <main class="main" id="view"></main>
    </div>`;
  $("#logout")?.addEventListener("click", () => {
    if (!confirmLeave()) return;
    clearToken();
    location.href = BASE + "/";
  });
}

const BASE = "/admin";

function parseRoute(pathname = location.pathname) {
  const parts = pathname.slice(BASE.length).split("/").filter(Boolean).map(decodeURIComponent);
  const area = parts[0] === "articole" ? (parts[1] ? "post" : "posts") : ["texte", "proiecte"].includes(parts[0]) ? "content" : "home";
  return { area, parts };
}

function confirmLeave() {
  return !view?.dirty || confirm("Ai modificări nesalvate. Sigur vrei să pleci de pe pagină?");
}

// Între „Texte site” și „Proiecte” nu se pierde nimic — copia de lucru rămâne în memorie până la salvare
const canLeaveTo = (path) => (view?.area === "content" && parseRoute(path).area === "content") || confirmLeave();

let currentPath = location.pathname;

function navigate(path) {
  if (path === location.pathname) return;
  if (!canLeaveTo(path)) return;
  history.pushState(null, "", path);
  currentPath = path;
  route();
}

// Schimbă adresa fără a reconstrui pagina (ex. după prima salvare a unui articol nou)
function replacePath(path) {
  history.replaceState(null, "", path);
  currentPath = path;
}

window.addEventListener("popstate", () => {
  if (!canLeaveTo(location.pathname)) { history.pushState(null, "", currentPath); return; }
  currentPath = location.pathname;
  route();
});

// Linkurile interne ale panoului se deschid fără reîncărcarea paginii
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[href^=\"/admin\"]");
  if (!a || a.target === "_blank" || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  navigate(a.getAttribute("href"));
});

window.addEventListener("beforeunload", (e) => {
  if (view?.dirty) { e.preventDefault(); e.returnValue = ""; }
});

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && view?.save) {
    e.preventDefault();
    view.save();
  }
});

function setDirty(on = true) {
  if (!view) return;
  view.dirty = on;
  $(".ed__bar")?.classList.toggle("is-dirty", on);
}

async function route() {
  const { area, parts } = parseRoute();
  $$(".side__nav a").forEach((a) => a.classList.toggle("is-active", a.dataset.area === (area === "post" ? "posts" : area === "content" ? parts[0] : area)));
  const root = $("#view");
  if (area !== "content") work = null; // ieșirea din texte/proiecte renunță la copia de lucru (după confirmare)
  view = { area, dirty: false, save: null };
  window.scrollTo(0, 0);
  root.innerHTML = loading();
  try {
    if (area === "home") await renderDashboard(root);
    else if (area === "posts") await renderPosts(root);
    else if (area === "post") await renderEditor(root, parts[1]);
    else if (parts[0] === "proiecte") await renderProjects(root, parts[1]);
    else await renderTexts(root, parts[1], parts[2]);
  } catch (err) {
    if (err.status === 401) { clearToken(); return renderLogin(err.message); }
    console.error(err);
    root.innerHTML = `<div class="empty"><strong>Ceva n-a mers.</strong>${esc(err.message)}</div>`;
  }
}

/* ---------- Date ---------- */

async function loadPosts(force = false) {
  if (posts && !force) return posts;
  const files = (await store.list(BLOG_DIR)).filter((f) => f.name.endsWith(".md"));
  posts = await Promise.all(files.map(async (f) => {
    const { text, sha } = await store.read(f.path);
    const { data, body } = parsePost(text);
    return { slug: f.name.replace(/\.md$/, ""), path: f.path, sha, data, body };
  }));
  posts.sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)));
  return posts;
}

/* ---------- Panou ---------- */

async function renderDashboard(root) {
  const [list, history] = await Promise.all([loadPosts(true), store.history().catch(() => [])]);
  const live = list.filter((p) => !p.data.draft);
  const drafts = list.length - live.length;
  const siteUrl = store.mode === "local" ? "/" : config.siteUrl;
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Bună dimineața." : hour < 18 ? "Bună ziua." : "Bună seara.";

  root.innerHTML = `
    <header class="vh">
      <div>
        <p class="eyebrow">${esc(hello)}</p>
        <h1 class="vh__title">Ce <em class="outline">publicăm</em> azi?</h1>
      </div>
    </header>

    <div class="tiles">
      <div class="tile"><div class="tile__num">${live.length}</div><p>Articole publicate</p></div>
      <div class="tile"><div class="tile__num">${drafts}</div><p>Ciorne</p></div>
      <div class="tile"><div class="tile__num">6</div><p>Limbi pe site</p></div>
    </div>

    <div class="quick">
      <a class="qcard qcard--primary" href="/admin/articole/nou"><span>Articol nou<small>Scrie și publică pe blog</small></span><span class="qcard__arrow">→</span></a>
      <a class="qcard" href="/admin/texte"><span>Texte site<small>Toate textele, în cele 6 limbi</small></span><span class="qcard__arrow">→</span></a>
      <a class="qcard" href="/admin/proiecte"><span>Proiecte<small>Caruselul „Our Work”</small></span><span class="qcard__arrow">→</span></a>
      <a class="qcard" href="${esc(siteUrl)}" target="_blank" rel="noopener"><span>Vezi site-ul<small>${store.mode === "local" ? "Versiunea locală" : esc(config.siteUrl.replace(/^https?:\/\//, ""))}</small></span><span class="qcard__arrow">↗</span></a>
    </div>

    <div class="grid2">
      <section class="panel">
        <div class="panel__head"><p class="eyebrow">Articole recente</p><a href="/admin/articole">Toate →</a></div>
        ${list.length ? `<ul class="feed">${list.slice(0, 6).map((p) => `
          <li><a href="/admin/articole/${encodeURIComponent(p.slug)}">${esc(p.data.title || p.slug)}</a>
          <span>${p.data.draft ? '<span class="pill pill--draft">Ciornă</span>' : `<time>${esc(formatDate(p.data.date))}</time>`}</span></li>`).join("")}
        </ul>` : `<p>Niciun articol încă. <a href="/admin/articole/nou" style="color:var(--bleu)">Scrie primul →</a></p>`}
      </section>
      <section class="panel">
        ${store.mode === "github" ? `
          <div class="panel__head"><p class="eyebrow">Ultimele modificări</p></div>
          <ul class="feed">${history.map((c) => `
            <li><a href="${esc(c.url)}" target="_blank" rel="noopener" title="${esc(c.message)}">${esc(c.message)}</a>
            <time>${esc(new Date(c.date).toLocaleDateString("ro-RO", { day: "numeric", month: "short" }))}</time></li>`).join("")}
          </ul>` : `
          <div class="panel__head"><p class="eyebrow">Mod local</p></div>
          <p>Lucrezi pe calculatorul tău. Salvările scriu direct în <code>content/</code>, iar site-ul de pe <code>localhost</code> se reconstruiește automat.</p>
          <p>Ca să publici, fă commit și push în GitHub — Vercel preia automat.</p>`}
      </section>
    </div>`;
}

/* ---------- Listă articole ---------- */

async function renderPosts(root) {
  const list = await loadPosts(true);
  let filter = "all", q = "";

  root.innerHTML = `
    <header class="vh">
      <div>
        <p class="eyebrow">Blog</p>
        <h1 class="vh__title">Articole</h1>
      </div>
      <div class="vh__actions">
        <a class="btn btn--primary" href="/admin/articole/nou"><span>Articol nou</span><span class="btn__arrow">↗</span></a>
      </div>
    </header>
    <div class="toolbar-row">
      <div class="chips">
        <button class="chip is-active" data-f="all">Toate · ${list.length}</button>
        <button class="chip" data-f="live">Publicate · ${list.filter((p) => !p.data.draft).length}</button>
        <button class="chip" data-f="draft">Ciorne · ${list.filter((p) => p.data.draft).length}</button>
      </div>
      <input class="input" type="search" placeholder="Caută după titlu sau etichetă…" id="postSearch">
    </div>
    <div class="rows" id="rows"></div>`;

  const draw = () => {
    const shown = list.filter((p) =>
      (filter === "all" || (filter === "draft") === !!p.data.draft) &&
      (!q || `${p.data.title} ${(p.data.tags || []).join(" ")}`.toLowerCase().includes(q)));
    const rows = $("#rows");
    if (!shown.length) {
      rows.innerHTML = list.length
        ? `<div class="empty"><strong>Nimic găsit.</strong>Încearcă alt filtru.</div>`
        : `<div class="empty"><strong>Încă niciun articol.</strong><a href="/admin/articole/nou" style="color:var(--bleu)">Scrie primul articol →</a></div>`;
      return;
    }
    rows.replaceChildren(...shown.map((p) => {
      const href = `/admin/articole/${encodeURIComponent(p.slug)}`;
      const row = el("div", { class: "row", onclick: () => navigate(href) },
        el("div", {},
          el("div", { class: "row__title" }, p.data.title || p.slug),
          el("div", { class: "row__sub" }, `/blog/${p.slug}/` + ((p.data.tags || []).length ? `  ·  ${p.data.tags.join(", ")}` : ""))),
        el("span", { class: "row__date" }, formatDate(p.data.date)),
        el("span", { class: `pill pill--${p.data.draft ? "draft" : "live"}` }, p.data.draft ? "Ciornă" : "Publicat"),
        el("div", { class: "row__actions" },
          !p.data.draft && el("a", {
            class: "icon-btn", title: "Vezi pe site", target: "_blank", rel: "noopener",
            href: `${store.mode === "local" ? "" : config.siteUrl.replace(/\/$/, "")}/blog/${p.slug}/`,
            onclick: (e) => e.stopPropagation(),
          }, "↗"),
          el("button", {
            class: "icon-btn", title: "Șterge",
            onclick: (e) => { e.stopPropagation(); deletePost(p).then((ok) => ok && route()); },
          }, "✕")));
      return row;
    }));
  };

  $$(".chip", root).forEach((c) => c.addEventListener("click", () => {
    filter = c.dataset.f;
    $$(".chip", root).forEach((x) => x.classList.toggle("is-active", x === c));
    draw();
  }));
  $("#postSearch").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
  draw();
}

async function deletePost(p) {
  if (!confirm(`Ștergi definitiv articolul „${p.data.title || p.slug}”?`)) return false;
  try {
    await store.remove(p.path, { sha: p.sha, message: `Blog: șterge „${p.data.title || p.slug}”` });
    posts = posts?.filter((x) => x !== p) || null;
    toast("Articol șters.");
    return true;
  } catch (err) {
    toast(err.message, "err");
    return false;
  }
}

/* ---------- Încărcare imagini ---------- */

const MAX_W = 2400;

async function optimize(file) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return { dataUrl, ext: file.name.split(".").pop().toLowerCase() };
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  if (img.width <= MAX_W && file.size < 1.2e6) return { dataUrl, ext: file.type.split("/")[1].replace("jpeg", "jpg") };
  const scale = Math.min(1, MAX_W / img.width);
  const c = Object.assign(document.createElement("canvas"), { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return { dataUrl: c.toDataURL("image/webp", 0.86), ext: "webp" };
}

async function uploadImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("Fișierul nu este o imagine.");
  const { dataUrl, ext } = await optimize(file);
  const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "imagine";
  if (dataUrl.length > 4e6) throw new Error("Imaginea este prea mare (max. ~3 MB). Folosește o imagine JPG/PNG/WebP sau micșoreaz-o.");
  const path = `${UPLOADS}/${today().slice(0, 7)}-${base}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  await store.upload(path, dataUrl.split(",")[1], { message: `Imagine: ${base}` });
  previews.set("/" + path, dataUrl);
  return "/" + path;
}

function pickFile() {
  return new Promise((resolve) => {
    const input = el("input", { type: "file", accept: "image/*", onchange: () => resolve(input.files[0] || null) });
    input.click();
  });
}

function imagePicker(value, onChange) {
  let current = value || "";
  const thumb = el("div", { class: "imgpick__thumb", title: "Alege o imagine" });
  const input = el("input", { class: "input", placeholder: "/assets/uploads/…", value: current });
  const wrap = el("div", { class: "imgpick" }, thumb,
    el("div", { class: "imgpick__row" }, input,
      el("button", { type: "button", class: "icon-btn", title: "Elimină imaginea", onclick: () => set("") }, "✕")));

  function drawThumb() {
    thumb.replaceChildren(current ? el("img", { src: imgSrc(current), alt: "" }) : "＋ Încarcă imagine");
  }
  function set(v) {
    current = v;
    input.value = v;
    drawThumb();
    onChange(v);
  }
  thumb.addEventListener("click", async () => {
    const file = await pickFile();
    if (!file) return;
    wrap.classList.add("is-busy");
    thumb.textContent = "Se încarcă…";
    try { set(await uploadImage(file)); toast("Imagine încărcată."); }
    catch (err) { toast(err.message, "err"); drawThumb(); }
    wrap.classList.remove("is-busy");
  });
  input.addEventListener("input", () => { current = input.value.trim(); drawThumb(); onChange(current); });
  drawThumb();
  return wrap;
}

/* ---------- Editor articol ---------- */

async function renderEditor(root, slugParam) {
  const list = await loadPosts();
  const isNew = slugParam === "nou";
  const existing = isNew ? null : list.find((p) => p.slug === slugParam);
  if (!isNew && !existing) {
    root.innerHTML = `<div class="empty"><strong>Articolul nu există.</strong><a href="/admin/articole" style="color:var(--bleu)">← Înapoi la articole</a></div>`;
    return;
  }

  const state = {
    post: existing,
    slug: existing?.slug || "",
    slugTouched: !isNew,
    data: { title: "", date: today(), excerpt: "", cover: "", tags: [], author: "Echipa Vantum", lang: "ro", draft: isNew, ...clone(existing?.data || {}) },
    body: existing?.body || "",
  };
  let mode = "split";
  try { mode = localStorage.getItem("vantum-admin-pane") || "split"; } catch {}

  root.innerHTML = `
    <div class="ed__bar">
      <a class="back" href="/admin/articole">← Articole</a>
      <span class="pill" id="edStatus"></span>
      <span class="dirty-dot">● nesalvat</span>
      <span class="spacer"></span>
      <div class="seg" id="paneSeg">
        <button data-m="write">Scrie</button><button data-m="split">Împărțit</button><button data-m="preview">Previzualizare</button>
      </div>
      <button class="btn btn--primary" id="saveBtn"><span>Salvează</span></button>
    </div>
    <div class="ed__grid">
      <div class="ed__main">
        <textarea class="ed__title" id="edTitle" rows="1" placeholder="Titlul articolului"></textarea>
        <div class="panes" id="panes">
          <div class="pane pane--write">
            <div class="mdbar" id="mdbar">
              <button data-a="h2" title="Titlu secțiune">H2</button>
              <button data-a="h3" title="Subtitlu">H3</button>
              <span class="sep"></span>
              <button data-a="bold" title="Îngroșat (Ctrl+B)"><b>B</b></button>
              <button data-a="italic" title="Cursiv (Ctrl+I)"><em>I</em></button>
              <button data-a="link" title="Link (Ctrl+K)">🔗</button>
              <span class="sep"></span>
              <button data-a="ul" title="Listă">•</button>
              <button data-a="ol" title="Listă numerotată">1.</button>
              <button data-a="quote" title="Citat">❝</button>
              <button data-a="code" title="Cod">&lt;/&gt;</button>
              <button data-a="hr" title="Separator">—</button>
              <span class="sep"></span>
              <button data-a="image" title="Imagine">🖼 Imagine</button>
            </div>
            <textarea class="ed__body" id="edBody" placeholder="Scrie aici în Markdown…&#10;&#10;## Un subtitlu&#10;Text cu **bold**, *italic* și [linkuri](https://vantumit.ro)." spellcheck="true"></textarea>
          </div>
          <div class="pane pane--preview"><div id="preview"></div></div>
        </div>
      </div>
      <aside class="ed__side" id="edSide"></aside>
    </div>`;

  const titleEl = $("#edTitle"), bodyEl = $("#edBody"), panes = $("#panes"), side = $("#edSide");
  titleEl.value = state.data.title;
  bodyEl.value = state.body;
  autoGrow(titleEl);

  // Panouri scriere / previzualizare
  const setMode = (m) => {
    mode = m;
    panes.dataset.mode = m;
    $$("#paneSeg button").forEach((b) => b.classList.toggle("is-active", b.dataset.m === m));
    try { localStorage.setItem("vantum-admin-pane", m); } catch {}
    renderPreview();
  };
  $$("#paneSeg button").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.m)));

  let previewTimer;
  function renderPreview() {
    if (mode === "write") return;
    const d = state.data;
    const box = $("#preview");
    box.innerHTML = `
      <div class="preview-head">
        <p class="eyebrow"><span class="dot"></span> ${esc(formatDate(d.date))} · ${readingTime(state.body)} min citire</p>
        <h1>${esc(d.title || "Fără titlu")}</h1>
        ${d.excerpt ? `<p>${esc(d.excerpt)}</p>` : ""}
        ${d.cover ? `<img src="${esc(imgSrc(d.cover))}" alt="">` : ""}
      </div>
      <div class="prose">${marked.parse(state.body)}</div>`;
    $$(".prose img", box).forEach((img) => { const p = img.getAttribute("src"); if (previews.has(p)) img.src = previews.get(p); });
  }
  const queuePreview = () => { clearTimeout(previewTimer); previewTimer = setTimeout(renderPreview, 120); };

  function updateStatus() {
    const s = $("#edStatus");
    s.className = `pill pill--${state.data.draft ? "draft" : "live"}`;
    s.textContent = state.data.draft ? "Ciornă" : "Publicat";
  }

  const changed = () => { setDirty(true); queuePreview(); };

  titleEl.addEventListener("input", () => {
    state.data.title = titleEl.value.replace(/\n/g, " ");
    if (!state.slugTouched) { state.slug = slugify(state.data.title); $("#edSlug").value = state.slug; }
    changed();
  });
  titleEl.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); bodyEl.focus(); } });
  bodyEl.addEventListener("input", () => { state.body = bodyEl.value; changed(); });

  // Bara de formatare Markdown
  function wrapSel(before, after = before, placeholder = "text") {
    const { selectionStart: a, selectionEnd: b, value } = bodyEl;
    const sel = value.slice(a, b) || placeholder;
    bodyEl.setRangeText(before + sel + after, a, b, "end");
    bodyEl.setSelectionRange(a + before.length, a + before.length + sel.length);
    bodyEl.focus();
    bodyEl.dispatchEvent(new Event("input"));
  }
  function prefixLines(prefix) {
    const { selectionStart: a, selectionEnd: b, value } = bodyEl;
    const start = value.lastIndexOf("\n", a - 1) + 1;
    const block = value.slice(start, b);
    const out = block.split("\n").map((l, i) => (typeof prefix === "function" ? prefix(i) : prefix) + l).join("\n");
    bodyEl.setRangeText(out, start, b, "end");
    bodyEl.focus();
    bodyEl.dispatchEvent(new Event("input"));
  }
  function insertBlock(text) {
    const { selectionStart: a, value } = bodyEl;
    const pre = a && value[a - 1] !== "\n" ? "\n\n" : "";
    bodyEl.setRangeText(pre + text + "\n", a, bodyEl.selectionEnd, "end");
    bodyEl.focus();
    bodyEl.dispatchEvent(new Event("input"));
  }
  const actions = {
    h2: () => prefixLines("## "),
    h3: () => prefixLines("### "),
    bold: () => wrapSel("**"),
    italic: () => wrapSel("*"),
    link: () => {
      const url = prompt("Adresa linkului:", "https://");
      if (url) wrapSel("[", `](${url})`, "text link");
    },
    ul: () => prefixLines("- "),
    ol: () => prefixLines((i) => `${i + 1}. `),
    quote: () => prefixLines("> "),
    code: () => (bodyEl.value.slice(bodyEl.selectionStart, bodyEl.selectionEnd).includes("\n") ? wrapSel("```\n", "\n```", "cod") : wrapSel("`", "`", "cod")),
    hr: () => insertBlock("---\n"),
    image: async () => {
      const file = await pickFile();
      if (!file) return;
      toast("Se încarcă imaginea…");
      try {
        const path = await uploadImage(file);
        insertBlock(`![${file.name.replace(/\.[^.]+$/, "")}](${path})`);
        toast("Imagine adăugată în articol.");
      } catch (err) { toast(err.message, "err"); }
    },
  };
  $$("#mdbar button").forEach((b) => b.addEventListener("click", () => actions[b.dataset.a]()));
  bodyEl.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = { b: "bold", i: "italic", k: "link" }[e.key.toLowerCase()];
    if (k) { e.preventDefault(); actions[k](); }
  });
  // Lipire imagini direct din clipboard
  bodyEl.addEventListener("paste", async (e) => {
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
    if (!file) return;
    e.preventDefault();
    toast("Se încarcă imaginea…");
    try { insertBlock(`![](${await uploadImage(file)})`); toast("Imagine adăugată în articol."); }
    catch (err) { toast(err.message, "err"); }
  });

  // Setări articol (coloana din dreapta)
  const field = (label, control, hint) =>
    el("label", { class: "field" }, el("span", { class: "field__label" }, label), control, hint && el("span", { class: "field__hint" }, hint));

  const excerptHint = el("span", { class: "field__hint" });
  const countExcerpt = () => {
    const n = state.data.excerpt.length;
    excerptHint.textContent = `${n} / 160 caractere — apare în listă și în Google.`;
    excerptHint.classList.toggle("is-over", n > 160);
  };

  side.append(
    el("div", { class: "field" },
      el("span", { class: "field__label" }, "Stare"),
      el("label", { class: "switch" },
        el("input", {
          type: "checkbox", checked: !state.data.draft,
          onchange: (e) => { state.data.draft = !e.target.checked; updateStatus(); setDirty(); },
        }),
        el("span", { class: "switch__track" }),
        el("span", {}, "Publicat pe site"))),
    field("Adresă (URL)",
      el("div", { class: "input-prefix" }, el("span", {}, "/blog/"),
        el("input", {
          class: "input", id: "edSlug", value: state.slug, placeholder: "titlul-articolului",
          oninput: (e) => { state.slugTouched = true; state.slug = e.target.value; setDirty(); },
          onblur: (e) => { state.slug = slugify(e.target.value); e.target.value = state.slug; },
        }))),
    field("Limba articolului", el("select", {
      class: "input",
      onchange: (e) => { state.data.lang = e.target.value; setDirty(); },
    }, Object.entries(LANG_NAMES).map(([code, name]) => el("option", { value: code, selected: code === (state.data.lang || "ro") }, name))),
    "Articolul apare în limba în care e scris; meniul se traduce automat."),
    field("Data", el("input", {
      class: "input", type: "date", value: state.data.date,
      oninput: (e) => { state.data.date = e.target.value; changed(); },
    })),
    el("label", { class: "field" },
      el("span", { class: "field__label" }, "Rezumat"),
      el("textarea", {
        class: "input", rows: 3, value: state.data.excerpt, placeholder: "O frază sau două despre articol",
        oninput: (e) => { state.data.excerpt = e.target.value; countExcerpt(); changed(); },
      }),
      excerptHint),
    field("Etichete", el("input", {
      class: "input", value: (state.data.tags || []).join(", "), placeholder: "AI, UX, Strategie",
      oninput: (e) => { state.data.tags = e.target.value.split(",").map((t) => t.trim()).filter(Boolean); changed(); },
    }), "Separate prin virgulă."),
    field("Autor", el("input", {
      class: "input", value: state.data.author || "",
      oninput: (e) => { state.data.author = e.target.value; setDirty(); },
    })),
    el("div", { class: "field" },
      el("span", { class: "field__label" }, "Imagine copertă"),
      imagePicker(state.data.cover, (v) => { state.data.cover = v; changed(); })),
    !isNew && el("button", {
      class: "btn btn--danger", type: "button", style: "justify-self:start",
      onclick: async () => { if (await deletePost(state.post)) { setDirty(false); navigate("/admin/articole"); } },
    }, el("span", {}, "Șterge articolul")),
  );
  countExcerpt();
  updateStatus();
  setMode(mode);

  // Salvare
  const saveBtn = $("#saveBtn");
  view.save = async () => {
    const d = state.data;
    d.title = d.title.trim();
    state.slug = slugify(state.slug || d.title);
    $("#edSlug").value = state.slug;
    if (!d.title) { toast("Articolul are nevoie de un titlu.", "err"); titleEl.focus(); return; }
    if (!state.slug) { toast("Adresa (URL) nu poate fi goală.", "err"); return; }
    const clash = state.slug === "nou" || posts.find((p) => p.slug === state.slug && p !== state.post);
    if (clash) { toast(`Există deja un articol la /blog/${state.slug}/.`, "err"); return; }

    const path = `${BLOG_DIR}/${state.slug}.md`;
    const text = serializePost(d, state.body);
    const renamed = state.post && state.post.slug !== state.slug;
    const verb = !state.post ? "articol nou" : d.draft ? "actualizează ciorna" : "actualizează";
    saveBtn.disabled = true;
    try {
      const sha = await store.write(path, text, {
        sha: renamed ? undefined : state.post?.sha,
        message: `Blog: ${verb} „${d.title}”`,
      });
      if (renamed) await store.remove(state.post.path, { sha: state.post.sha, message: `Blog: mută „${d.title}” la /blog/${state.slug}/` });

      const wasNew = !state.post;
      const saved = { slug: state.slug, path, sha, data: clone(d), body: state.body };
      posts = [saved, ...posts.filter((p) => p !== state.post)].sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)));
      state.post = saved;
      state.slugTouched = true;
      setDirty(false);
      replacePath(`/admin/articole/${encodeURIComponent(state.slug)}`);
      toast(d.draft ? "Ciornă salvată — nu apare pe site." : savedHint());
      if (wasNew) return route(); // reafișează editorul ca articol existent (cu butonul de ștergere)
    } catch (err) {
      toast(err.message, "err");
    }
    saveBtn.disabled = false;
  };
  saveBtn.addEventListener("click", view.save);

  if (isNew) titleEl.focus();
}

/* ---------- Câmpuri de formular (folosite la proiecte) ---------- */

const getPath = (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj);
function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
  target[last] = value;
}

function renderField(f, obj, onChange) {
  const val = getPath(obj, f.key);
  const set = (v) => { setPath(obj, f.key, v); onChange(f, v); };
  let control;

  switch (f.type) {
    case "textarea":
      control = el("textarea", { class: "input", rows: f.rows || 3, value: val ?? "", oninput: (e) => set(e.target.value) });
      break;
    case "lines":
      control = el("textarea", {
        class: "input", rows: Math.max(3, (val || []).length + 1), value: (val || []).join("\n"),
        oninput: (e) => set(e.target.value.split("\n").map((l) => l.trim()).filter(Boolean)),
      });
      break;
    case "tags":
      control = el("input", {
        class: "input", value: (val || []).join(", "),
        oninput: (e) => set(e.target.value.split(",").map((t) => t.trim()).filter(Boolean)),
      });
      break;
    case "bool":
      return el("label", { class: "switch" },
        el("input", { type: "checkbox", checked: !!val, onchange: (e) => set(e.target.checked) }),
        el("span", { class: "switch__track" }),
        el("span", {}, f.label));
    case "image":
      control = imagePicker(val, set);
      break;
    case "list":
      control = listEditor(f, obj, onChange);
      break;
    default:
      control = el("input", { class: "input", value: val ?? "", oninput: (e) => set(e.target.value) });
  }
  const tag = f.type === "list" || f.type === "image" ? "div" : "label";
  return el(tag, { class: "field" },
    el("span", { class: "field__label" }, f.label),
    control,
    f.hint && el("span", { class: "field__hint" }, f.hint));
}

function listEditor(f, obj, onChange) {
  const wrap = el("div", { class: "list" });
  const open = new Set();
  const items = () => {
    let arr = getPath(obj, f.key);
    if (!Array.isArray(arr)) { arr = []; setPath(obj, f.key, arr); }
    return arr;
  };
  const touched = () => onChange(f, items());

  function draw() {
    const arr = items();
    wrap.replaceChildren(
      ...arr.map((item, i) => {
        const label = el("span", { class: "litem__label" }, item[f.itemLabel] || "Fără titlu");
        const tools = el("div", { class: "litem__tools" },
          el("button", { type: "button", class: "icon-btn", title: "Mută sus", disabled: i === 0, onclick: (e) => { e.stopPropagation(); move(i, -1); } }, "↑"),
          el("button", { type: "button", class: "icon-btn", title: "Mută jos", disabled: i === arr.length - 1, onclick: (e) => { e.stopPropagation(); move(i, 1); } }, "↓"),
          el("button", { type: "button", class: "icon-btn", title: "Șterge", onclick: (e) => { e.stopPropagation(); remove(i); } }, "✕"));
        const body = el("div", { class: "litem__body" },
          f.fields.map((sub) => renderField(sub, item, (sf) => {
            if (sf.key === f.itemLabel) label.textContent = item[f.itemLabel] || "Fără titlu";
            touched();
          })),
          f.compact && tools);
        const card = el("div", { class: `litem${f.compact ? " litem--compact" : ""}${open.has(item) ? " is-open" : ""}` },
          el("div", {
            class: "litem__head",
            onclick: () => { card.classList.toggle("is-open"); open[card.classList.contains("is-open") ? "add" : "delete"](item); },
          }, el("span", { class: "litem__num" }, pad(i + 1)), label, !f.compact && tools, el("span", { class: "litem__chev" }, "▼")),
          body);
        return card;
      }),
      el("button", { type: "button", class: "list__add", onclick: add }, `＋ ${f.addLabel || "Adaugă"}`),
    );
  }
  function move(i, d) {
    const arr = items();
    [arr[i], arr[i + d]] = [arr[i + d], arr[i]];
    f.onStructure?.("move", i, d);
    touched(); draw();
  }
  function remove(i) {
    const arr = items();
    if (!confirm(`Ștergi „${arr[i][f.itemLabel] || "elementul"}”?`)) return;
    arr.splice(i, 1);
    f.onStructure?.("remove", i);
    touched(); draw();
  }
  function add() {
    const item = Object.fromEntries(f.fields.map((s) => [s.key, s.type === "tags" || s.type === "lines" ? [] : s.type === "bool" ? false : ""]));
    items().push(item);
    f.onStructure?.("add", items().length - 1, item);
    open.add(item);
    touched(); draw();
  }
  draw();
  return wrap;
}

let work = null; // copia de lucru a content/i18n.json, păstrată între pagini până la salvare

const LANG_NAMES = { en: "English", ro: "Română", de: "Deutsch", fr: "Français", es: "Español", it: "Italiano" };
const FALLBACK_ORDER = ["en", "ro", "de", "fr", "es", "it"];

// Grupurile de texte, după prefixul cheii (hero.t1 → hero)
const GROUPS = {
  meta: ["SEO", "Titlul și descrierea care apar în Google."],
  nav: ["Meniu", "Linkurile din meniul de sus."],
  header: ["Header", "Butonul din dreapta sus și selectorul de limbă."],
  hero: ["Hero", "Primul ecran: titlul mare și subtitlul."],
  clients: ["Intro & ticker", "Titlul de sub hero și cuvintele care derulează."],
  process: ["Proces", "Pașii procesului."],
  about: ["Despre", "Servicii, cine suntem și misiunea."],
  stats: ["Cifre", "Textele de sub cifre."],
  cta: ["Apel la acțiune", "Secțiunea cu butonul de contact."],
  work: ["Proiecte — titluri", "Titlul secțiunii și butoanele caruselului."],
  case: ["Fereastra proiectului", "Etichetele din fereastra care se deschide la un proiect."],
  form: ["Formular contact", "Câmpurile, opțiunile și mesajele formularului."],
  footer: ["Footer", "Contact, legal și rețele."],
  wa: ["WhatsApp", "Mesajul precompletat la butonul WhatsApp."],
  blog: ["Blog", "Textele fixe ale paginilor de blog."],
};

const groupOf = (key) => key.split(".")[0];
const groupsIn = (obj) => [...new Set(Object.keys(obj).filter((k) => k !== "cases").map(groupOf))];
const LABELS = {
  "hero.t1": "Titlu — rândul 1", "hero.t2": "Titlu — rândul 2 (verde)", "hero.t3": "Titlu — rândul 3", "hero.sub": "Subtitlu",
  "clients.headline": "Titlu", "clients.ticker": "Cuvinte în ticker",
  "process.s1": "Pasul 1", "process.s2": "Pasul 2", "process.s3": "Pasul 3", "process.s4": "Pasul 4", "process.s5": "Pasul 5",
  "stats.s1": "Cifra 1 (5+)", "stats.s2": "Cifra 2 (∞)", "stats.s3": "Cifra 3 (100%)", "stats.s4": "Cifra 4 (360°)", "stats.s5": "Cifra 5 (+∞)",
  "meta.title": "Titlu în Google", "meta.desc": "Descriere în Google",
};
const humanize = (key) => LABELS[key] || key.split(".").slice(1).join(" ").replace(/([a-z])([A-Z0-9])/g, "$1 $2").toLowerCase() || key;

async function loadTexts(force = false) {
  if (texts && !force) return texts;
  const { text, sha } = await store.read(TEXTS_FILE);
  texts = { data: JSON.parse(text), sha };
  return texts;
}

// Bara de sus, comună pentru „Texte site” și „Proiecte”
function contentBar(title, lang, hrefFor) {
  return `
    <div class="ed__bar${view.dirty ? " is-dirty" : ""}">
      <p class="eyebrow">${esc(title)}</p>
      <span class="dirty-dot">● modificări nesalvate</span>
      <span class="spacer"></span>
      <div class="seg" title="Limba">${Object.keys(work).map((l) => `<a href="${hrefFor(l)}" class="${l === lang ? "is-active" : ""}" title="${esc(LANG_NAMES[l] || l)}">${l.toUpperCase()}</a>`).join("")}</div>
      <button class="btn btn--ghost" id="resetBtn">Renunță</button>
      <button class="btn btn--primary" id="saveBtn">Salvează</button>
    </div>`;
}

async function enterContent() {
  const t = await loadTexts(!work); // la intrarea în secțiune citim versiunea cea mai nouă
  if (!work) work = clone(t.data);
  view.dirty = JSON.stringify(work) !== JSON.stringify(t.data);
}

const onContentChange = () => setDirty(JSON.stringify(work) !== JSON.stringify(texts.data));

function wireContentBar() {
  $("#resetBtn").addEventListener("click", () => {
    if (!view.dirty || !confirm("Renunți la toate modificările nesalvate?")) return;
    work = clone(texts.data);
    setDirty(false);
    route();
  });
  const saveBtn = $("#saveBtn");
  view.save = async () => {
    if (!view.dirty) { toast("Nu sunt modificări de salvat."); return; }
    saveBtn.disabled = true;
    try {
      fillMissingCases(work);
      const sha = await store.write(TEXTS_FILE, JSON.stringify(work, null, 2) + "\n", {
        sha: texts.sha,
        message: `Texte: actualizează ${changedParts(texts.data, work).join(", ") || "site-ul"}`,
      });
      texts = { data: clone(work), sha };
      setDirty(false);
      toast(savedHint());
    } catch (err) {
      toast(err.message, "err");
    }
    saveBtn.disabled = false;
  };
  saveBtn.addEventListener("click", view.save);
}

async function renderTexts(root, langParam, groupParam) {
  await enterContent();
  const lang = work[langParam] ? langParam : "ro";
  const groups = groupsIn(work[lang]);
  const group = groups.includes(groupParam) ? groupParam : groups[0];
  if (lang !== langParam || group !== groupParam) replacePath(`/admin/texte/${lang}/${group}`);
  const [label, desc] = GROUPS[group] || [group, ""];

  root.innerHTML = `
    ${contentBar("Texte site", lang, (l) => `/admin/texte/${l}/${group}`)}
    <div class="ct">
      <nav class="ct__nav">${groups.map((g) => `<a href="/admin/texte/${lang}/${g}" class="${g === group ? "is-active" : ""}">${esc((GROUPS[g] || [g])[0])}</a>`).join("")}</nav>
      <div>
        <div class="ct__head"><h2>${esc(label)}</h2><p>${esc(desc)} Limba: <strong>${esc(LANG_NAMES[lang] || lang)}</strong>.</p></div>
        <div class="form" id="form"></div>
      </div>
    </div>`;

  const obj = work[lang];
  const ref = work.en || {};
  const keys = Object.keys(obj).filter((k) => k !== "cases" && groupOf(k) === group);
  $("#form").append(...keys.map((key) => {
    const val = obj[key];
    const set = (v) => { obj[key] = v; onContentChange(); };
    let control;
    if (Array.isArray(val)) {
      control = el("textarea", {
        class: "input", rows: Math.max(3, val.length + 1), value: val.join("\n"),
        oninput: (e) => set(e.target.value.split("\n").map((l) => l.trim()).filter(Boolean)),
      });
    } else if (String(val).length > 70 || String(val).includes("<")) {
      control = el("textarea", { class: "input", rows: 3, value: val, oninput: (e) => set(e.target.value) });
    } else {
      control = el("input", { class: "input", value: val ?? "", oninput: (e) => set(e.target.value) });
    }
    const hints = [];
    if (Array.isArray(val)) hints.push("Câte unul pe linie.");
    if (String(val).includes("<br>")) hints.push("<br> = rând nou.");
    if (lang !== "en" && ref[key] != null) hints.push(`EN: ${Array.isArray(ref[key]) ? ref[key].join(" · ") : ref[key]}`);
    return el("label", { class: "field" },
      el("span", { class: "field__label" }, humanize(key), el("code", { class: "field__key" }, key)),
      control,
      hints.length && el("span", { class: "field__hint" }, hints.join("  ")));
  }));
  wireContentBar();
}

const CASE_FIELDS = [
  { key: "title", label: "Nume proiect", type: "text" },
  { key: "sector", label: "Domeniu (apare pe card)", type: "text" },
  { key: "tags", label: "Etichete — separate prin virgulă", type: "tags" },
  { key: "desc", label: "Descriere scurtă (card)", type: "textarea", rows: 2 },
  { key: "challenge", label: "Provocarea", type: "textarea" },
  { key: "solution", label: "Ce am făcut", type: "textarea" },
  { key: "results", label: "Rezultate — unul pe linie", type: "lines" },
];

async function renderProjects(root, langParam) {
  await enterContent();
  const lang = work[langParam] ? langParam : "ro";
  if (lang !== langParam) replacePath(`/admin/proiecte/${lang}`);

  root.innerHTML = `
    ${contentBar("Proiecte", lang, (l) => `/admin/proiecte/${l}`)}
    <div class="ct ct--single">
      <div>
        <div class="ct__head">
          <h2>Proiecte</h2>
          <p>Cardurile din caruselul „Our Work” și fereastra fiecărui proiect. Limba: <strong>${esc(LANG_NAMES[lang] || lang)}</strong>.</p>
          <p>Ordinea și numărul proiectelor sunt aceleași în toate limbile. Ce lași necompletat într-o limbă se completează la salvare din altă limbă.</p>
        </div>
        <div class="form" id="form"></div>
      </div>
    </div>`;

  // adăugarea, ștergerea și mutarea unui proiect se aplică în toate limbile
  const others = () => Object.keys(work).filter((l) => l !== lang).map((l) => (work[l].cases ??= []));
  $("#form").append(renderField({
    key: "cases", label: "Proiecte", type: "list", itemLabel: "title", addLabel: "Adaugă proiect", fields: CASE_FIELDS,
    onStructure: (op, i, d) => others().forEach((arr) => {
      if (op === "move") [arr[i], arr[i + d]] = [arr[i + d], arr[i]];
      if (op === "remove") arr.splice(i, 1);
      if (op === "add") arr.push(clone(d));
    }),
  }, work[lang], onContentChange));
  wireContentBar();
}

// Un proiect nou sau un câmp gol într-o limbă preia textul din prima limbă în care e completat
function fillMissingCases(data) {
  const langs = Object.keys(data);
  const order = [...FALLBACK_ORDER.filter((l) => langs.includes(l)), ...langs.filter((l) => !FALLBACK_ORDER.includes(l))];
  const count = Math.max(...langs.map((l) => (data[l].cases || []).length));
  const empty = (v) => v == null || v === "" || (Array.isArray(v) && !v.length);
  for (let i = 0; i < count; i++) {
    for (const f of CASE_FIELDS) {
      const source = order.map((l) => data[l].cases?.[i]?.[f.key]).find((v) => !empty(v));
      if (source === undefined) continue;
      for (const l of langs) {
        data[l].cases ??= [];
        data[l].cases[i] ??= {};
        if (empty(data[l].cases[i][f.key])) data[l].cases[i][f.key] = clone(source);
      }
    }
  }
}

function changedParts(before, after) {
  const strip = (o) => JSON.stringify({ ...o, cases: undefined });
  const parts = Object.keys(after).filter((l) => strip(before[l] || {}) !== strip(after[l])).map((l) => l.toUpperCase());
  if (Object.keys(after).some((l) => JSON.stringify(before[l]?.cases) !== JSON.stringify(after[l].cases))) parts.push("proiecte");
  return parts;
}

/* ---------- Pornire ---------- */

function start() {
  renderShell();
  route();
}

(async () => {
  const token = loadToken();
  if (!token) return renderLogin();
  try {
    store = await ApiStore.resume(token);
    start();
  } catch (err) {
    if (err.status === 401) clearToken();
    renderLogin(err.status === 401 ? "" : err.message);
  }
})();
