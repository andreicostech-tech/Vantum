(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* =========================================================
     Intro: inima se așază pe „i”, apoi intro-ul dispare
     ========================================================= */
  var intro = $('#intro');
  function endIntro() {
    if (!intro || intro.classList.contains('is-leaving')) return;
    intro.classList.add('is-leaving');
    root.classList.remove('has-intro');
    root.classList.add('intro-done');
    try { sessionStorage.setItem('bt-intro', '1'); } catch (e) {}
    setTimeout(function () { intro.remove(); }, 950);
  }
  if (root.classList.contains('has-intro') && intro) {
    setTimeout(endIntro, 3100);
    intro.addEventListener('click', endIntro);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') endIntro(); });
  }

  /* =========================================================
     Header compact la scroll
     ========================================================= */
  var header = $('#header');
  function onScroll() { header.classList.toggle('is-scrolled', window.scrollY > 40); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* =========================================================
     Hero carousel
     ========================================================= */
  var hero = $('#hero');
  var slides = $$('.slide', hero);
  var dotsWrap = $('.hero-dots', hero);
  var bar = $('.hero-progress span', hero);
  var DURATION = 6500;
  var current = 0, timer = null;

  slides.forEach(function (_, i) {
    var b = document.createElement('button');
    b.className = 'hero-dot';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', 'Slide ' + (i + 1));
    b.addEventListener('click', function () { go(i, true); });
    dotsWrap.appendChild(b);
  });
  var dots = $$('.hero-dot', dotsWrap);

  function go(i, user) {
    current = (i + slides.length) % slides.length;
    slides.forEach(function (s, k) {
      s.classList.toggle('is-active', k === current);
      s.setAttribute('aria-hidden', k === current ? 'false' : 'true');
    });
    dots.forEach(function (d, k) { d.classList.toggle('is-active', k === current); });
    hero.classList.toggle('on-dark', slides[current].getAttribute('data-theme') === 'dark');
    restart();
  }
  function restart() {
    clearTimeout(timer);
    bar.classList.remove('run');
    void bar.offsetWidth; // repornește animația barei
    bar.style.animationDuration = DURATION + 'ms';
    bar.classList.add('run');
    timer = setTimeout(function () { go(current + 1); }, DURATION);
  }
  $$('.hero-arrow', hero).forEach(function (b) {
    b.addEventListener('click', function () { go(current + Number(b.getAttribute('data-dir')), true); });
  });

  // pauză la hover
  hero.addEventListener('mouseenter', function () { clearTimeout(timer); bar.style.animationPlayState = 'paused'; });
  hero.addEventListener('mouseleave', function () {
    bar.style.animationPlayState = 'running';
    var left = DURATION * (1 - bar.offsetWidth / hero.offsetWidth);
    timer = setTimeout(function () { go(current + 1); }, Math.max(left, 400));
  });

  // swipe pe mobil
  var x0 = null;
  hero.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  hero.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 45) go(current + (dx < 0 ? 1 : -1), true);
    x0 = null;
  });
  document.addEventListener('keydown', function (e) {
    if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === 'ArrowRight') go(current + 1, true);
    if (e.key === 'ArrowLeft') go(current - 1, true);
  });
  go(0);

  /* =========================================================
     Produse
     ========================================================= */
  var P = 'img/products/';
  var B = 'https://buchetino.ro/';
  var products = {
    popular: [
      { id: 224, name: 'Inimă trandafiri criogenați gigant', cat: 'Trandafiri criogenați', price: 4500, img: 'inima-gigant-1.jpg', url: B + 'trandafiri-criogenati/224-inima-mare-trandafiri-criogenati.html', badge: 'Bestseller' },
      { id: 88, name: 'Trandafiri criogenați cutii Luxury', cat: 'Cutii Luxury', price: 5000, img: 'luxury-1.jpg', url: B + 'trandafiri-criogenati/88-trandafiri-criogenati-cutii-luxury.html' },
      { id: 331, name: 'Trandafir criogenat mov deschis', cat: 'În cupolă de sticlă', price: 500, img: 'cupola-mov.jpg', url: B + 'acasa/331-trandafir-criogenat-cupola.html' },
      { id: 432, name: 'Inimă trandafiri criogenați mare', cat: 'Trandafiri criogenați', price: 1700, img: 'inima-mare.jpg', url: B + 'acasa/432-inima-tradafiri-criogenati-mare.html' },
      { id: 487, name: 'Trandafiri criogenați cutie mare', cat: 'Cutie mare', price: 4500, img: 'cutie-mare-1.jpg', url: B + 'acasa/487-trandafiri-criogenati-cutie-mare.html' },
      { id: 85, name: 'Trandafiri criogenați cutii Luxury', cat: 'Cutii Luxury', price: 5000, img: 'luxury-2.jpg', url: B + 'trandafiri-criogenati/85-trandafiri-criogenati-cutii-luxury.html', badge: 'Exclusiv' },
      { id: 462, name: 'Trandafiri criogenați cutie medie', cat: 'Cutie medie', price: 1000, img: 'cutie-medie-1.jpg', url: B + 'acasa/462-trandafiri-criogenati-cutie-medie.html' },
      { id: 223, name: 'Trandafiri criogenați cutie mare', cat: 'Cutie mare', price: 4500, img: 'cutie-mare-2.jpg', url: B + 'trandafiri-criogenati-cutie-mare/223-trandafiri-criogenati-cutie-mare.html' }
    ],
    flori: [
      { id: 'b101', name: 'Buchet 101 trandafiri roșii', cat: 'Buchete flori', price: 1500, img: 'buchet-101.jpg', url: B + '40-buchete-trandafiri-imperiali', badge: 'Bestseller' },
      { id: 'bimp', name: 'Buchet imens bujori imperiali', cat: 'Buchete de bujori', price: 4500, img: 'bujori-imperiali.jpg', url: B + '78-buchete-imense-de-bujori' },
      { id: 'b51', name: 'Buchet 51 de bujori', cat: 'Buchete de bujori', price: 2800, img: 'bujori-51.jpg', url: B + '78-buchete-imense-de-bujori' },
      { id: 'nmare', name: 'Trandafiri naturali cutie mare', cat: 'Florărie non stop', price: 800, img: 'naturali-mare.jpg', url: B + '24-trandafiri-naturali-cutie-mare' }
    ],
    cadouri: [
      { id: 'dolce', name: 'Cutie Buchetino Dolce', cat: 'Buchetino Dolce', price: 900, img: 'dolce.jpg', url: B + '62-buchetino-dolce' },
      { id: 'armand', name: 'Armand de Brignac Gold Brut', cat: 'Șampanie', price: 3000, img: 'armand-gold.jpg', url: B + '71-sampanie' },
      { id: 'dom', name: 'Dom Pérignon Rosé', cat: 'Șampanie', price: 2500, img: 'dom-rose.jpg', url: B + '71-sampanie' },
      { id: 'nmica', name: 'Trandafiri naturali în cutie mică', cat: 'Florărie non stop', price: 400, img: 'naturali-mica.jpg', url: B + '6-florarie-non-stop' }
    ]
  };
  var byId = {};
  Object.keys(products).forEach(function (k) { products[k].forEach(function (p) { byId[p.id] = p; }); });

  function lei(n) { return n.toLocaleString('ro-RO').replace(/\s/g, '.') + ' lei'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var grid = $('#productGrid');
  function render(tab) {
    grid.innerHTML = products[tab].map(function (p, i) {
      return '<article class="card" style="animation-delay:' + (i * 60) + 'ms">' +
        '<div class="card-media">' +
          (p.badge ? '<span class="badge">' + esc(p.badge) + '</span>' : '') +
          '<button class="fav" aria-label="Adaugă la favorite"><svg><use href="#i-like"/></svg></button>' +
          '<a href="' + p.url + '"><img src="' + P + p.img + '" alt="' + esc(p.name) + '" loading="lazy"></a>' +
          '<button class="add" data-id="' + p.id + '">Adaugă în coș</button>' +
        '</div>' +
        '<div class="card-body">' +
          '<p class="card-cat">' + esc(p.cat) + '</p>' +
          '<h3 class="card-title"><a href="' + p.url + '">' + esc(p.name) + '</a></h3>' +
          '<p class="card-price">' + lei(p.price) + '</p>' +
        '</div>' +
      '</article>';
    }).join('');
  }
  $$('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      $$('.tab').forEach(function (x) { x.classList.toggle('is-active', x === t); x.setAttribute('aria-selected', x === t); });
      render(t.getAttribute('data-tab'));
    });
  });
  render('popular');

  grid.addEventListener('click', function (e) {
    var fav = e.target.closest('.fav');
    if (fav) { fav.classList.toggle('is-on'); return; }
    var add = e.target.closest('.add');
    if (add) {
      addToCart(add.getAttribute('data-id'));
      add.textContent = 'Adăugat ✓';
      add.classList.add('is-added');
      setTimeout(function () { add.textContent = 'Adaugă în coș'; add.classList.remove('is-added'); }, 1600);
    }
  });

  /* =========================================================
     Coș (demo, păstrat local în browser)
     ========================================================= */
  var cart = {};
  try { cart = JSON.parse(localStorage.getItem('bt-cart') || '{}') || {}; } catch (e) { cart = {}; }
  Object.keys(cart).forEach(function (id) { if (!byId[id]) delete cart[id]; });

  var countEl = $('#cartCount'), itemsEl = $('#cartItems'), totalEl = $('#cartTotal');

  function save() { try { localStorage.setItem('bt-cart', JSON.stringify(cart)); } catch (e) {} }
  function addToCart(id) {
    cart[id] = (cart[id] || 0) + 1;
    save(); drawCart();
    countEl.classList.remove('bump'); void countEl.offsetWidth; countEl.classList.add('bump');
    setTimeout(function () { openDrawer(cartDrawer); }, 350);
  }
  function drawCart() {
    var ids = Object.keys(cart), n = 0, total = 0;
    ids.forEach(function (id) { n += cart[id]; total += cart[id] * byId[id].price; });
    countEl.textContent = n;
    countEl.classList.toggle('has-items', n > 0);
    totalEl.textContent = lei(total);
    if (!ids.length) {
      itemsEl.innerHTML = '<div class="cart-empty"><svg><use href="#i-heart"/></svg><p>Coșul este gol</p><span>Alege ceva frumos pentru cineva drag.</span></div>';
      return;
    }
    itemsEl.innerHTML = ids.map(function (id) {
      var p = byId[id];
      return '<div class="cart-line">' +
        '<img src="' + P + p.img + '" alt="">' +
        '<div><h4>' + esc(p.name) + '</h4>' +
          '<div class="qty"><button data-q="-1" data-id="' + id + '" aria-label="Scade">−</button><span>' + cart[id] + '</span><button data-q="1" data-id="' + id + '" aria-label="Crește">+</button></div></div>' +
        '<div><div class="price">' + lei(p.price * cart[id]) + '</div><button class="rm" data-rm="' + id + '">Șterge</button></div>' +
      '</div>';
    }).join('');
  }
  itemsEl.addEventListener('click', function (e) {
    var q = e.target.closest('[data-q]'), rm = e.target.closest('[data-rm]');
    if (q) {
      var id = q.getAttribute('data-id');
      cart[id] += Number(q.getAttribute('data-q'));
      if (cart[id] <= 0) delete cart[id];
    } else if (rm) {
      delete cart[rm.getAttribute('data-rm')];
    } else return;
    save(); drawCart();
  });
  drawCart();

  /* =========================================================
     Drawers (meniu mobil + coș)
     ========================================================= */
  var scrim = $('#scrim'), menuDrawer = $('#menuDrawer'), cartDrawer = $('#cartDrawer');
  function openDrawer(d) {
    closeDrawers();
    d.classList.add('is-open'); d.setAttribute('aria-hidden', 'false');
    scrim.classList.add('is-on');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawers() {
    [menuDrawer, cartDrawer].forEach(function (d) { d.classList.remove('is-open'); d.setAttribute('aria-hidden', 'true'); });
    scrim.classList.remove('is-on');
    document.body.style.overflow = '';
  }
  $('#menuOpen').addEventListener('click', function () { openDrawer(menuDrawer); });
  $('#cartOpen').addEventListener('click', function () { openDrawer(cartDrawer); });
  scrim.addEventListener('click', closeDrawers);
  $$('[data-close]').forEach(function (b) { b.addEventListener('click', closeDrawers); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawers(); });

  /* =========================================================
     Reveal la scroll
     ========================================================= */
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { threshold: .15, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  var y = $('#year'); if (y) y.textContent = new Date().getFullYear();
})();
