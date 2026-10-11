// Formatul unui articol: front matter (o valoare JSON pe linie) + corp Markdown.
// Folosit atât de build.mjs (Node) cât și de panoul /admin (browser).
//
// ---
// title: "Titlul articolului"
// date: "2026-10-11"
// tags: ["AI", "UX"]
// draft: false
// ---
// Textul în **Markdown**...

export const POST_FIELDS = ["title", "date", "excerpt", "cover", "tags", "author", "lang", "draft"];

export function parsePost(source) {
  const text = source.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const data = {};
  if (!m) return { data, body: text };
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    const raw = line.slice(i + 1).trim();
    try { data[key] = JSON.parse(raw); } catch { data[key] = raw.replace(/^['"]|['"]$/g, ""); }
  }
  return { data, body: m[2].replace(/^\n+/, "") };
}

export function serializePost(data, body) {
  const keys = [...POST_FIELDS, ...Object.keys(data).filter((k) => !POST_FIELDS.includes(k))];
  const lines = keys
    .filter((k) => data[k] !== undefined && data[k] !== "" && !(Array.isArray(data[k]) && !data[k].length))
    .map((k) => `${k}: ${JSON.stringify(data[k])}`);
  return `---\n${lines.join("\n")}\n---\n\n${body.trim()}\n`;
}

export function slugify(s) {
  return String(s)
    .normalize("NFD").replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function readingTime(body) {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (isNaN(d)) return iso || "";
  return d.toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
