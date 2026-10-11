// Paginile de blog. Headerul, footerul și butonul WhatsApp sunt luate din index.html la fiecare
// build, ca blogul să arate mereu exact ca restul site-ului. Textele fixe (titlu, „înapoi” etc.)
// au chei în content/i18n.json și se traduc în limba vizitatorului (blog.js).

import { formatDate } from "../admin/lib/post-format.js";

export const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const CARD_HUES = [150, 320, 30, 195, 260, 120, 220]; // aceleași culori ca la proiecte (script.js)

// Bucățile comune extrase din index.html; ancorele (#about) devin linkuri spre prima pagină (/#about)
export function chromeFrom(indexHtml) {
  const grab = (re, what) => {
    const m = indexHtml.match(re);
    if (!m) throw new Error(`Nu găsesc ${what} în index.html`);
    return m[0];
  };
  const absolute = (html) => html
    .replace(/href="#home"/g, 'href="/"')
    .replace(/href="#/g, 'href="/#')
    .replace(/href="(?!https?:|mailto:|tel:|\/|#)([^"]+)"/g, 'href="/$1"')
    .replace(/ data-open-form(="[^"]*")?/g, "");
  return {
    header: absolute(grab(/<header class="header"[\s\S]*?<\/header>/, "headerul")),
    footer: `<footer class="footer">\n    ${absolute(grab(/<div class="footer__body"[\s\S]*?(?=<\/footer>)/, "footerul")).trim()}\n  </footer>`,
    whatsapp: grab(/<a class="wa"[\s\S]*?<\/a>/, "butonul WhatsApp"),
  };
}

function page({ chrome, lang = "ro", title, description, url, image, body }) {
  return `<!DOCTYPE html>
<html lang="${esc(lang)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(url)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(url)}">${image ? `\n  <meta property="og:image" content="${esc(new URL(image, url).href)}">` : ""}
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Red+Hat+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&family=Nunito:wght@700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
</head>
<body class="blog-page">

  ${chrome.header}

  <main>
${body}
  </main>

  ${chrome.footer}

  ${chrome.whatsapp}

  <script src="/i18n.js"></script>
  <script src="/blog.js"></script>
</body>
</html>
`;
}

export function postCard(post, i) {
  const d = post.data;
  const thumb = d.cover
    ? `<img src="${esc(d.cover)}" alt="" loading="lazy">`
    : `<div class="card__tiles">${"<i></i>".repeat(12)}</div>`;
  return `<a class="post-card" href="/blog/${post.slug}/" style="--h:${CARD_HUES[i % CARD_HUES.length]}">
          <div class="card__thumb post-card__thumb">${thumb}</div>
          <div class="card__body">
            <p class="post-card__meta"><time datetime="${esc(d.date)}">${esc(formatDate(d.date))}</time> · ${post.minutes} <span data-i18n="blog.minutes">min de citit</span></p>
            <h3 class="card__title">${esc(d.title)}</h3>
            ${d.excerpt ? `<p class="card__desc">${esc(d.excerpt)}</p>` : ""}
            ${d.tags?.length ? `<div class="card__tags">${d.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
          </div>
        </a>`;
}

export function blogIndexPage({ chrome, base, posts, ro }) {
  const body = `
    <section class="blog-hero">
      <div class="container">
        <h1 class="blog-hero__title" data-i18n="blog.title">${esc(ro["blog.title"])}</h1>
        <p class="blog-hero__intro" data-i18n="blog.intro">${esc(ro["blog.intro"])}</p>
      </div>
    </section>

    <section class="blog-list">
      <div class="container">
        ${posts.length
          ? `<div class="posts">\n        ${posts.map(postCard).join("\n        ")}\n      </div>`
          : `<p class="blog-empty" data-i18n="blog.empty">${esc(ro["blog.empty"])}</p>`}
      </div>
    </section>`;
  return page({
    chrome, title: `Blog — Vantum`, description: ro["blog.intro"], url: `${base}/blog/`, body,
  });
}

export function postPage({ chrome, base, post, others, ro }) {
  const d = post.data;
  const body = `
    <article class="article">
      <header class="article__head container">
        <a class="article__back" href="/blog/" data-i18n="blog.back">${esc(ro["blog.back"])}</a>
        <p class="post-card__meta"><time datetime="${esc(d.date)}">${esc(formatDate(d.date))}</time> · ${post.minutes} <span data-i18n="blog.minutes">${esc(ro["blog.minutes"])}</span>${d.author ? ` · ${esc(d.author)}` : ""}</p>
        <h1 class="article__title">${esc(d.title)}</h1>
        ${d.excerpt ? `<p class="article__lead">${esc(d.excerpt)}</p>` : ""}
        ${d.tags?.length ? `<div class="card__tags">${d.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
      </header>
      ${d.cover ? `<figure class="article__cover container"><img src="${esc(d.cover)}" alt=""></figure>` : ""}
      <div class="prose container">
${post.html}
      </div>
    </article>
${others.length ? `
    <section class="blog-list blog-list--more">
      <div class="container">
        <h2 class="section-title"><span data-i18n="blog.more">${esc(ro["blog.more"])}</span></h2>
        <div class="posts">
        ${others.map(postCard).join("\n        ")}
        </div>
      </div>
    </section>` : ""}`;
  return page({
    chrome,
    lang: d.lang || "ro",
    title: `${d.title} — Vantum`,
    description: d.excerpt || ro["blog.intro"],
    url: `${base}/blog/${post.slug}/`,
    image: d.cover,
    body,
  });
}
