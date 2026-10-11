// Construiește site-ul în dist/ — Vercel rulează asta la fiecare commit.
//  - copiază site-ul așa cum este (index.html, styles.css, redesign/, favicon etc.)
//  - adaugă textele din content/i18n.json în i18n.js
//  - generează blogul din content/blog/*.md (/blog/ și /blog/<articol>/)
//  - copiază panoul de control în /admin/
// Rulare locală: npm run build   (sau npm run dev pentru server cu reîncărcare automată)

import { readFile, writeFile, mkdir, readdir, rm, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { marked } from "marked";
import { parsePost, readingTime } from "./admin/lib/post-format.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "dist");
const BASE = "https://vantumit.ro";

// Ce NU ajunge pe site (surse, unelte, conținut brut)
const PRIVATE = new Set([
  ".git", ".gitignore", ".vercel", "node_modules", "dist", "content", "src", "server", "api", "admin",
  "build.mjs", "dev.mjs", "package.json", "package-lock.json", "vercel.json", "README.md", "test.txt",
]);

async function write(rel, content) {
  const file = join(OUT, rel);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
}

async function loadPosts({ drafts }) {
  const dir = join(ROOT, "content/blog");
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md"));
  const posts = await Promise.all(files.map(async (f) => {
    const { data, body } = parsePost(await readFile(join(dir, f), "utf8"));
    return { slug: f.replace(/\.md$/, ""), data, body, html: marked.parse(body), minutes: readingTime(body) };
  }));
  return posts
    .filter((p) => drafts || !p.data.draft)
    .sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)));
}

export async function build({ drafts = false } = {}) {
  const started = Date.now();
  const t = await import(`${pathToFileURL(join(ROOT, "src/blog.js"))}?v=${started}`);
  const texts = JSON.parse(await readFile(join(ROOT, "content/i18n.json"), "utf8"));
  const posts = await loadPosts({ drafts });

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  // 1. Site-ul existent, neschimbat
  for (const entry of await readdir(ROOT)) {
    if (!PRIVATE.has(entry)) await cp(join(ROOT, entry), join(OUT, entry), { recursive: true });
  }

  // 2. Textele (toate limbile)
  const i18n = (await readFile(join(ROOT, "i18n.js"), "utf8")).trimEnd();
  await write("i18n.js", `${i18n}\n\nconst I18N = ${JSON.stringify(texts, null, 2)};\n`);

  // 3. Blog — linkul din meniu apare doar când există cel puțin un articol publicat
  const source = await readFile(join(ROOT, "index.html"), "utf8");
  let index = source;
  if (!posts.length) index = index.replace(/[ \t]*<a [^>]*data-blog-link[^>]*>.*?<\/a>\r?\n?/, "");
  await write("index.html", index);

  const chrome = t.chromeFrom(source);
  const ro = texts.ro;
  await write("blog/index.html", t.blogIndexPage({ chrome, base: BASE, posts, ro }));
  for (const post of posts) {
    const others = posts.filter((p) => p !== post).slice(0, 3);
    await write(`blog/${post.slug}/index.html`, t.postPage({ chrome, base: BASE, post, others, ro }));
  }

  // 4. Panoul de control
  await cp(join(ROOT, "admin"), join(OUT, "admin"), { recursive: true });
  await cp(join(ROOT, "node_modules/marked/lib/marked.esm.js"), join(OUT, "admin/vendor/marked.esm.js"));

  // 5. SEO
  const urls = ["/", ...(posts.length ? ["/blog/", ...posts.map((p) => `/blog/${p.slug}/`)] : [])];
  await write("sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${BASE}${u}</loc></url>`).join("\n")}\n</urlset>\n`);
  if (!existsSync(join(ROOT, "robots.txt"))) {
    await write("robots.txt", `User-agent: *\nDisallow: /admin/\nDisallow: /redesign/\nDisallow: /redesignwebsite/\nDisallow: /stickere-moto/\nSitemap: ${BASE}/sitemap.xml\n`);
  }

  console.log(`✓ build: ${posts.length} articole publicate, ${Date.now() - started} ms`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  build({ drafts: process.argv.includes("--drafts") }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
