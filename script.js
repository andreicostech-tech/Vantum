// ============ DATA ============
// Edit this list to change the case studies shown in the carousel.
const projects = [
  { name: 'Learnly', hue: 185, tags: ['Digital Monetization', 'Performance Optimization', 'News Platform'] },
  { name: 'Institut Français', hue: 200, tags: ['Multisite Platform', 'Web Development', 'Custom CMS'] },
  { name: 'Alpha', hue: 265, tags: ['E-commerce', 'UX / UI'] },
  { name: 'Solaria', hue: 40, tags: ['Web App', 'Dashboard'] },
  { name: 'North Logistics', hue: 140, tags: ['Consulting', 'Automation'] },
  { name: 'Top Metrology', hue: 20, tags: ['Web Development', 'Search Redesign'] },
  { name: 'Robotic Cleaning Solutions', hue: 190, tags: ['Web Development', 'Lead Automation'] },
];

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

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ============ CAROUSEL (coverflow) ============
const stage = document.getElementById('carouselStage');
let active = 0;

// how the cards fan out: wide screens show every card, smaller ones only the neighbours
const DESKTOP = { rotate: 15, depth: 10, offset: 90, scale: 0.82, visible: 7, xPow: 0.7, rPow: 0.3 };
const TABLET = { rotate: 25, depth: 8, offset: 85, scale: 0.8, visible: 1, xPow: 1, rPow: 1 };

stage.innerHTML = projects.map((p, i) => `
  <article class="card" data-index="${i}" style="--h:${p.hue}" aria-label="${p.name}">
    <div class="card__thumb">
      <span class="card__brand">${p.name}</span>
      <div class="card__tiles">${'<i></i>'.repeat(12)}</div>
    </div>
    <div class="card__body">
      <h3 class="card__title">${p.name}</h3>
      <div class="card__tags">${p.tags.map((t) => `<span>${t}</span>`).join('')}</div>
      <p class="card__desc">A showcase of our successful collaboration with ${p.name}. Explore the challenges, solutions, and results.</p>
      <a class="card__btn" href="#work">Check Study Case</a>
    </div>
  </article>`).join('');

const cards = [...stage.children];

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
    card.querySelector('.card__btn').tabIndex = d === 0 ? 0 : -1;
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
  if (card.classList.contains('is-active')) return;
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
layout();

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

function countUp(el) {
  const target = Number(el.dataset.count);
  const suffix = el.dataset.suffix || '';
  if (reduceMotion) { el.textContent = target + suffix; return; }

  const duration = 1600;
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(target * eased) + suffix;
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
