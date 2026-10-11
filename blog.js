// ============ BLOG PAGES ============
// The blog reuses the site's header and footer; this applies the visitor's language to them
// (same choice as the home page, saved under `vantum-lang`) and runs the header menus.
// Articles themselves stay in the language they were written in.

const LANG_KEY = 'vantum-lang';
const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage blocked */ } },
};

const langBtn = document.getElementById('langBtn');
const langMenu = document.getElementById('langMenu');

function applyLanguage(code) {
  const lang = I18N[code] ? code : 'en';
  const t = I18N[lang];
  document.querySelectorAll('[data-i18n]').forEach((el) => { if (t[el.dataset.i18n] != null) el.textContent = t[el.dataset.i18n]; });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { if (t[el.dataset.i18nHtml] != null) el.innerHTML = t[el.dataset.i18nHtml]; });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { if (t[el.dataset.i18nAria] != null) el.setAttribute('aria-label', t[el.dataset.i18nAria]); });
  const wa = document.getElementById('waBtn');
  if (wa && t['wa.text']) wa.href = `${wa.href.split('?')[0]}?text=${encodeURIComponent(t['wa.text'])}`;

  const locale = { en: 'en-GB', ro: 'ro-RO', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT' }[lang];
  document.querySelectorAll('time[datetime]').forEach((el) => {
    const d = new Date(`${el.getAttribute('datetime')}T00:00:00Z`);
    if (!isNaN(d)) el.textContent = d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  });

  document.getElementById('langCurrent').textContent = lang.toUpperCase();
  langMenu.querySelectorAll('[role="option"]').forEach((li) => li.setAttribute('aria-selected', String(li.dataset.lang === lang)));
}

// --- language picker ---
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

const saved = store.get(LANG_KEY);
const browser = (navigator.languages || [navigator.language || 'en']).map((l) => l.slice(0, 2).toLowerCase()).find((l) => I18N[l]);
applyLanguage(saved && I18N[saved] ? saved : browser || 'en');

// ============ HEADER ============
const header = document.getElementById('header');
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');

const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 20);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

const setMenu = (open) => {
  nav.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', String(open));
};
burger.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });

document.getElementById('year').textContent = new Date().getFullYear();
