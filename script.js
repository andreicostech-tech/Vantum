// ============ DATA ============
// Card colours for the case studies. Their texts live in i18n.js (`cases`), in the same order.
const CASE_HUES = [150, 320, 30, 195, 260, 120, 220];
// which project type (index in `form.types`) each case study's "start a similar project" picks
const CASE_TYPES = [0, 1, 2, 3, 2, 5, 2];

// ============ LANGUAGE ============
const LANG_KEY = 'vantum-lang';
let lang = 'en';
let t = I18N.en;

const store = {
  get(key, where = localStorage) { try { return where.getItem(key); } catch { return null; } },
  set(key, value, where = localStorage) { try { where.setItem(key, value); } catch { /* storage blocked */ } },
};

const escapeHtml = (str) => str.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function applyLanguage(code) {
  lang = I18N[code] ? code : 'en';
  t = I18N[lang];
  document.documentElement.lang = lang;
  document.getElementById('metaDesc').content = t['meta.desc'];

  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t[el.dataset.i18n]; });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t[el.dataset.i18nHtml]; });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t[el.dataset.i18nAria]));
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t[el.dataset.i18nPh]; });
  document.getElementById('waBtn').href = `https://wa.me/40725740498?text=${encodeURIComponent(t['wa.text'])}`;

  document.getElementById('langCurrent').textContent = lang.toUpperCase();
  langMenu.querySelectorAll('[role="option"]').forEach((li) => li.setAttribute('aria-selected', String(li.dataset.lang === lang)));

  renderTicker();
  renderFormOptions();
  renderCards();
  if (caseModal.open) openCase(openCaseIndex);
}

// a saved choice wins; otherwise guess from the browser, then correct it from the visitor's IP country
async function detectLanguage() {
  const saved = store.get(LANG_KEY);
  if (saved && I18N[saved]) return applyLanguage(saved);

  const browser = (navigator.languages || [navigator.language || 'en']).map((l) => l.slice(0, 2).toLowerCase()).find((l) => I18N[l]);
  applyLanguage(browser || 'en');

  const country = await getCountry();
  if (country && !store.get(LANG_KEY)) applyLanguage(COUNTRY_LANG[country] || 'en');
}

async function getCountry() {
  const cached = store.get('vantum-country', sessionStorage);
  if (cached) return cached;
  const sources = ['https://ipapi.co/country/', 'https://get.geojs.io/v1/ip/country'];
  for (const url of sources) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      const code = (await res.text()).trim().toUpperCase();
      if (res.ok && /^[A-Z]{2}$/.test(code)) {
        store.set('vantum-country', code, sessionStorage);
        return code;
      }
    } catch { /* try the next source */ }
  }
  return null;
}

// --- language picker ---
const langBtn = document.getElementById('langBtn');
const langMenu = document.getElementById('langMenu');

langMenu.innerHTML = Object.entries(LANGS).map(([code, name]) =>
  `<li role="option" tabindex="-1" data-lang="${code}"><b>${code.toUpperCase()}</b>${name}</li>`).join('');

const setLangMenu = (open) => {
  langMenu.hidden = !open;
  langBtn.setAttribute('aria-expanded', String(open));
  if (open) (langMenu.querySelector('[aria-selected="true"]') || langMenu.firstElementChild).focus();
};
const pickLang = (li) => {
  store.set(LANG_KEY, li.dataset.lang);
  applyLanguage(li.dataset.lang);
  setLangMenu(false);
  langBtn.focus();
};

langBtn.addEventListener('click', () => setLangMenu(langMenu.hidden));
langMenu.addEventListener('click', (e) => { const li = e.target.closest('[data-lang]'); if (li) pickLang(li); });
langMenu.addEventListener('keydown', (e) => {
  const items = [...langMenu.children];
  const i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (items[i]) pickLang(items[i]); }
  if (e.key === 'Escape' || e.key === 'Tab') { setLangMenu(false); if (e.key === 'Escape') langBtn.focus(); }
});
document.addEventListener('click', (e) => { if (!e.target.closest('#lang')) setLangMenu(false); });

// ============ TICKER ============
function renderTicker() {
  const items = t['clients.ticker'].map((word) => `<span class="ticker__item">${escapeHtml(word)}</span><span class="ticker__dot"></span>`).join('');
  document.getElementById('ticker').innerHTML = items + items;
}

// ============ PROJECT REQUEST FORM ============
// Requests are emailed to contact@vantumit.ro by Web3Forms. The access key is meant to be
// public: it can only send messages to that inbox.
const WEB3FORMS_KEY = '47bec94e-1d80-4a43-b998-a5d60db46704';
const leadModal = document.getElementById('leadModal');
const leadForm = document.getElementById('leadForm');
const leadDone = document.getElementById('leadDone');
const leadStatus = document.getElementById('leadStatus');
const leadSubmit = leadForm.querySelector('.lead__submit');

// select options are indexes into the translated lists, so a choice survives a language switch
function renderFormOptions() {
  leadForm.querySelectorAll('select[data-options]').forEach((select) => {
    const chosen = select.value;
    const first = `<option value="">${select.required ? t['form.choose'] : '—'}</option>`;
    select.innerHTML = first + t[select.dataset.options].map((label, i) => `<option value="${i}">${escapeHtml(label)}</option>`).join('');
    select.value = chosen;
  });
}

function openLead(type) {
  leadForm.hidden = false;
  leadDone.hidden = true;
  leadStatus.textContent = '';
  if (type !== undefined && type !== '') leadForm.elements.type.value = String(type);
  if (caseModal.open) caseModal.close();
  if (!leadModal.open) leadModal.showModal();
}

document.addEventListener('click', (e) => {
  const opener = e.target.closest('[data-open-form]');
  if (!opener) return;
  e.preventDefault();
  setMenu(false);
  openLead(opener.dataset.openForm);
});
document.getElementById('leadClose').addEventListener('click', () => leadModal.close());
document.getElementById('leadDoneClose').addEventListener('click', () => leadModal.close());
leadModal.addEventListener('click', (e) => { if (e.target === leadModal) leadModal.close(); });

leadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (leadForm.elements.botcheck.checked) return;

  // the email is always written in Romanian, whatever language the visitor used
  const ro = I18N.ro;
  const f = leadForm.elements;
  const pick = (list, value) => (value === '' ? '—' : ro[list][Number(value)]);
  const type = pick('form.types', f.type.value);
  const payload = {
    access_key: WEB3FORMS_KEY,
    subject: `Cerere nouă de pe site: ${type} — ${f.name.value.trim()}`,
    from_name: 'Site Vantum',
    email: f.email.value.trim(),
    Nume: f.name.value.trim(),
    Firmă: f.company.value.trim() || '—',
    Telefon: f.phone.value.trim() || '—',
    'Tipul proiectului': type,
    'Buget orientativ': pick('form.budgets', f.budget.value),
    'Termen dorit': pick('form.deadlines', f.deadline.value),
    'Descrierea cerinței': f.message.value.trim(),
    'Acord GDPR': 'Da',
    'Limba site-ului': LANGS[lang],
  };

  leadSubmit.disabled = true;
  leadSubmit.textContent = t['form.sending'];
  leadStatus.textContent = '';
  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.message || res.status);
    leadForm.reset();
    leadForm.hidden = true;
    leadDone.hidden = false;
  } catch {
    leadStatus.textContent = t['form.error'];
  } finally {
    leadSubmit.disabled = false;
    leadSubmit.textContent = t['form.submit'];
  }
});

// ============ CASE STUDY MODAL ============
const caseModal = document.getElementById('caseModal');
const caseContent = document.getElementById('caseContent');
let openCaseIndex = 0;

function openCase(i) {
  openCaseIndex = i;
  const c = t.cases[i];
  caseContent.innerHTML = `
    <div class="case__hero card__thumb" style="--h:${CASE_HUES[i]}">
      <div class="card__tiles">${'<i></i>'.repeat(12)}</div>
    </div>
    <div class="case__body">
      <p class="case__sector">${escapeHtml(c.sector)}</p>
      <h2 class="case__title" id="caseTitle">${escapeHtml(c.title)}</h2>
      <div class="card__tags">${c.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
      <h3>${t['case.challenge']}</h3>
      <p>${escapeHtml(c.challenge)}</p>
      <h3>${t['case.solution']}</h3>
      <p>${escapeHtml(c.solution)}</p>
      <h3>${t['case.results']}</h3>
      <ul class="case__results">${c.results.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
      <a href="#contact" class="btn btn--primary" id="caseCta" data-open-form="${CASE_TYPES[i]}">${t['case.cta']}</a>
    </div>`;
  if (!caseModal.open) caseModal.showModal();
}

document.getElementById('caseClose').addEventListener('click', () => caseModal.close());
// clicking the dark backdrop (the dialog itself, outside its content) closes it
caseModal.addEventListener('click', (e) => {
  if (e.target === caseModal) caseModal.close();
});

// ============ HEADER ============
const header = document.getElementById('header');
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');

const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 20);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// the logo reloads the page and lands back at the top
document.querySelector('.logo').addEventListener('click', (e) => {
  e.preventDefault();
  history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  location.reload();
});

const setMenu = (open) => {
  nav.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', String(open));
};
burger.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ============ INTRO (touch screens) ============
// The V assembles itself (CSS, 0.45s), flickers on, and evaporates: about 1.1s in all.
// It runs on a fixed clock instead of waiting for the page to finish loading.
const intro = document.getElementById('intro');
if (getComputedStyle(intro).display === 'none') {
  intro.remove();
} else {
  setTimeout(() => intro.classList.add('is-lit'), 450);
  setTimeout(() => intro.classList.add('is-out'), 720);
  setTimeout(() => intro.remove(), 1200);
}

// ============ CAROUSEL (coverflow) ============
const stage = document.getElementById('carouselStage');
let active = 0;

// how the cards fan out: wide screens show every card, smaller ones only the neighbours
const DESKTOP = { rotate: 15, depth: 10, offset: 90, scale: 0.82, visible: 7, xPow: 0.7, rPow: 0.3 };
const TABLET = { rotate: 25, depth: 8, offset: 85, scale: 0.8, visible: 1, xPow: 1, rPow: 1 };

let cards = [];

function renderCards() {
  stage.innerHTML = t.cases.map((c, i) => `
  <article class="card" data-index="${i}" style="--h:${CASE_HUES[i]}" aria-label="${escapeHtml(c.title)}">
    <div class="card__thumb">
      <span class="card__brand">${escapeHtml(c.sector)}</span>
      <div class="card__tiles">${'<i></i>'.repeat(12)}</div>
    </div>
    <div class="card__body">
      <h3 class="card__title">${escapeHtml(c.title)}</h3>
      <div class="card__tags">${c.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
      <p class="card__desc">${escapeHtml(c.desc)}</p>
      <button class="card__btn" type="button">${t['work.view']}</button>
    </div>
  </article>`).join('');
  cards = [...stage.children];
  layout();
}

function layout() {
  const n = cards.length;
  const half = Math.floor(n / 2);
  const c = window.innerWidth >= 1200 ? DESKTOP : TABLET;

  cards.forEach((card, i) => {
    // shortest signed distance from the active card, wrapping around
    let d = i - active;
    if (d > half) d -= n;
    if (d < -half) d += n;

    const abs = Math.abs(d);
    const side = Math.sign(d);
    const hidden = abs > c.visible;
    // hidden cards wait just past the last visible slot, faded out
    const slot = hidden ? c.visible + 0.5 : abs;
    const x = side * c.offset * Math.pow(slot, c.xPow);
    const z = abs === 0 ? 0 : -c.depth * (slot * 0.5 + 0.5);
    const rot = side * c.rotate * Math.pow(slot, c.rPow);
    const scale = Math.pow(c.scale, hidden ? c.visible + 1 : abs);

    card.style.transform =
      `translate(-50%, -50%) translateX(${x}%) translateZ(${z}rem) rotateY(${rot}deg) scale(${scale})`;
    card.style.zIndex = String(hidden ? 0 : n - abs);
    card.style.opacity = hidden ? '0.1' : '1';
    card.style.pointerEvents = hidden ? 'none' : 'auto';
    card.classList.toggle('is-active', d === 0);
    card.setAttribute('aria-hidden', String(d !== 0));
    card.querySelector('.card__btn').tabIndex = d === 0 || window.innerWidth < 768 ? 0 : -1;
  });
}

function go(index) {
  active = (index + cards.length) % cards.length;
  layout();
}

document.getElementById('prev').addEventListener('click', () => go(active - 1));
document.getElementById('next').addEventListener('click', () => go(active + 1));

stage.addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  // a drag already moved the carousel, so ignore the click that ends it
  if (dragged) { dragged = false; e.preventDefault(); return; }
  if (card.classList.contains('is-active') || window.innerWidth < 768) {
    // phones show the cards as a plain list, so every card's button works there
    if (e.target.closest('.card__btn')) openCase(Number(card.dataset.index));
    return;
  }
  e.preventDefault();
  go(Number(card.dataset.index));
});

document.getElementById('carousel').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') go(active - 1);
  if (e.key === 'ArrowRight') go(active + 1);
});

// swipe / drag
let startX = null;
let dragged = false;
stage.addEventListener('pointerdown', (e) => { startX = e.clientX; dragged = false; });
stage.addEventListener('pointerup', (e) => {
  if (startX === null) return;
  const dx = e.clientX - startX;
  startX = null;
  if (Math.abs(dx) > 50) { dragged = true; go(active + (dx < 0 ? 1 : -1)); }
});
stage.addEventListener('dragstart', (e) => e.preventDefault());

window.addEventListener('resize', layout);
detectLanguage();

// ============ WORK DOTS ============
// Dots drift around the section; the ones near the cursor get linked by lines.
const dotsCanvas = document.getElementById('workDots');
const workSection = document.getElementById('work');
const dotsCtx = dotsCanvas.getContext('2d');
let dots = [];
let dotsW = 0;
let dotsH = 0;
let dotsConf = null;
let dotsFrame = null;
const mouse = { x: 0, y: 0 };

function resetDots() {
  const ratio = window.devicePixelRatio || 1;
  const rect = workSection.getBoundingClientRect();
  dotsW = rect.width;
  dotsH = rect.height;
  dotsCanvas.width = dotsW * ratio;
  dotsCanvas.height = dotsH * ratio;
  dotsCtx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const vw = window.innerWidth;
  dotsConf = vw < 768
    ? { count: 40, link: 60, radius: 100 }
    : { count: vw < 1200 ? 60 : 100, link: 80, radius: 150 };

  dots = Array.from({ length: dotsConf.count }, () => ({
    x: Math.random() * dotsW,
    y: Math.random() * dotsH,
    vx: Math.random() - 0.5,
    vy: Math.random() - 0.5,
    r: Math.random() * 1.5,
  }));
  mouse.x = dotsW / 2;
  mouse.y = dotsH / 2;
  drawDots();
}

function drawDots() {
  dotsCtx.clearRect(0, 0, dotsW, dotsH);
  dotsCtx.fillStyle = '#cecece';
  dots.forEach((p) => {
    dotsCtx.beginPath();
    dotsCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    dotsCtx.fill();
  });

  dotsCtx.lineWidth = 0.5;
  for (let i = 0; i < dots.length; i++) {
    const a = dots[i];
    const fromMouse = Math.hypot(a.x - mouse.x, a.y - mouse.y);
    if (fromMouse >= dotsConf.radius) continue;
    const alpha = Math.max(0, 0.9 * (1 - (fromMouse / dotsConf.radius) * 0.5));
    for (let j = i + 1; j < dots.length; j++) {
      const b = dots[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) >= dotsConf.link) continue;
      dotsCtx.strokeStyle = `rgba(206, 206, 206, ${alpha})`;
      dotsCtx.beginPath();
      dotsCtx.moveTo(a.x, a.y);
      dotsCtx.lineTo(b.x, b.y);
      dotsCtx.stroke();
    }
  }
}

function tickDots() {
  dots.forEach((p) => {
    if (p.y < 0 || p.y > dotsH) p.vy = -p.vy;
    else if (p.x < 0 || p.x > dotsW) p.vx = -p.vx;
    p.x += p.vx;
    p.y += p.vy;
  });
  drawDots();
  dotsFrame = requestAnimationFrame(tickDots);
}

window.addEventListener('mousemove', (e) => {
  const rect = workSection.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
}, { passive: true });
window.addEventListener('resize', resetDots, { passive: true });
resetDots();

// only animate while the section is on screen
new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting && !dotsFrame && !reduceMotion) dotsFrame = requestAnimationFrame(tickDots);
  if (!entry.isIntersecting && dotsFrame) { cancelAnimationFrame(dotsFrame); dotsFrame = null; }
}, { threshold: 0.1, rootMargin: '50px' }).observe(workSection);

// ============ REVEAL + COUNTERS ============

// data-final swaps the last number for a symbol, e.g. counting up and landing on ∞
function countUp(el) {
  const target = Number(el.dataset.count);
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  const final = el.dataset.final || prefix + target + suffix;
  if (reduceMotion) { el.textContent = final; return; }

  const duration = 1600;
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = t < 1 ? prefix + Math.round(target * eased) + suffix : final;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    if (el.dataset.count) countUp(el);
    else el.classList.add('is-visible');
    observer.unobserve(el);
  });
}, { threshold: 0.3 });

document.querySelectorAll('.reveal, [data-count]').forEach((el) => observer.observe(el));

// ============ FOOTER WORDMARK ============
// keep the letters hidden until the footer scrolls into view, then play the intro and loop
const footerMark = document.getElementById('footerMark');
if (!reduceMotion) {
  footerMark.classList.add('is-waiting');
  new IntersectionObserver(([entry], obs) => {
    if (!entry.isIntersecting) return;
    footerMark.classList.replace('is-waiting', 'is-live');
    obs.disconnect();
  }, { threshold: 0.35 }).observe(footerMark);
}

// ============ FOOTER YEAR ============
document.getElementById('year').textContent = new Date().getFullYear();
