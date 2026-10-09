(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  // împarte textul unui element în litere (span-uri), păstrând „i”-ul cu inimă întreg
  function splitLetters(el, cls, step) {
    var n = 0;
    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        var frag = document.createDocumentFragment();
        node.textContent.split('').forEach(function (ch) {
          var s = document.createElement('span');
          s.className = cls; s.textContent = ch;
          s.style.setProperty('--i', n);
          s.style.transitionDelay = (n++ * step) + 'ms';
          frag.appendChild(s);
        });
        el.replaceChild(frag, node);
      } else {
        node.classList.add(cls);
        node.style.setProperty('--i', n);
        node.style.transitionDelay = (n++ * step) + 'ms';
      }
    });
  }

  /* =========================================================
     INTRO: inima se desenează, bate, apoi zboară pe „i”
     (rulează la fiecare încărcare, inclusiv la refresh)
     ========================================================= */
  var intro = $('#intro');
  var ended = false;

  function endIntro() {
    if (ended || !intro) return;
    ended = true;
    intro.classList.add('landed', 'is-leaving');
    root.classList.remove('has-intro');
    root.classList.add('intro-done');
    setTimeout(function () { intro.remove(); }, 600);
    dropHeaderHeart(350);
    go(0); // carusel-ul pornește abia acum
  }

  function dropHeaderHeart(delay) {
    var h = $('.header .logo-heart');
    if (!h || typeof h.animate !== 'function') return;
    h.animate([
      { opacity: 0, transform: 'translateY(-1.5em) rotate(-30deg) scale(.6)' },
      { opacity: 1, offset: .4 },
      { transform: 'translateY(.04em) rotate(-5deg) scale(1.06,.94)', offset: .75 },
      { opacity: 1, transform: 'rotate(-8deg) scale(1)' }
    ], { duration: 900, delay: delay, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'backwards' });
  }

  if (root.classList.contains('has-intro') && intro) {
    var heart = $('#introHeart');
    var target = $('#introTarget');
    splitLetters($('#introWord'), 'ch', 30);

    var canAnimate = typeof heart.animate === 'function';

    setTimeout(function () {
      if (ended || !canAnimate) return;
      heart.animate([
        { transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(.96)' },
        { transform: 'scale(1.1)' }, { transform: 'scale(1)' }
      ], { duration: 500, easing: 'ease-in-out' });
    }, 500);

    setTimeout(function () { if (!ended) intro.classList.add('show-word'); }, 450);

    setTimeout(function () {
      if (ended) return;
      if (!canAnimate) { intro.classList.add('landed'); return; }
      var r = target.getBoundingClientRect();
      var size = parseFloat(getComputedStyle(target).width) || r.width;
      var hr = heart.getBoundingClientRect();
      var dx = (r.left + r.width / 2) - (hr.left + hr.width / 2);
      var dy = (r.top + r.height / 2) - (hr.top + hr.height / 2);
      var fly = heart.animate([
        { transform: 'translate(0,0) scale(1) rotate(0deg)' },
        { transform: 'translate(' + dx * .55 + 'px,' + (dy * .45 - 40) + 'px) scale(' + ((size / 120 + 1) / 2) + ') rotate(-24deg)', offset: .55 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + size / 120 + ') rotate(-8deg)' }
      ], { duration: 700, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
      fly.onfinish = function () {
        intro.classList.add('landed');
        if (target.animate) target.animate([
          { transform: 'rotate(-8deg) scale(1)' }, { transform: 'rotate(-8deg) scale(1.35, .8)' },
          { transform: 'rotate(-8deg) scale(.95, 1.08)' }, { transform: 'rotate(-8deg) scale(1)' }
        ], { duration: 450, easing: 'ease-out' });
        // imediat după ce inima s-a așezat, ecranul negru dispare
        setTimeout(endIntro, 250);
      };
    }, 1000);

    setTimeout(endIntro, 2200); // siguranță, în caz că animația nu rulează
    intro.addEventListener('click', endIntro);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') endIntro(); });
  }

  /* =========================================================
     LOGO: click → inimioara se ridică, apoi pagina se reîncarcă
     ========================================================= */
  var logo = $('.header .logo');
  logo.addEventListener('click', function (e) {
    e.preventDefault();
    if (logo.classList.contains('is-lifting')) return;
    logo.classList.add('is-lifting');
    var h = $('.logo-heart', logo);
    var reload = function () { window.scrollTo(0, 0); location.reload(); };
    if (typeof h.animate !== 'function') { reload(); return; }
    h.animate([
      { transform: 'rotate(-8deg) translateY(0) scale(1)', opacity: 1 },
      { transform: 'rotate(-8deg) translateY(.05em) scale(1.3, .8)', opacity: 1, offset: .15 },
      { transform: 'rotate(0deg) translateY(-1.2em) scale(1.25)', opacity: 1, offset: .5 },
      { transform: 'rotate(10deg) translateY(-3.2em) scale(.7)', opacity: 0 }
    ], { duration: 850, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' }).onfinish = reload;
  });

  /* =========================================================
     HEADER + CĂUTARE
     ========================================================= */
  var header = $('#header');
  var searchBar = $('#searchBar');
  function onScroll() {
    header.classList.toggle('is-solid', window.scrollY > 60 || searchBar.classList.contains('is-open'));
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  $('#searchOpen').addEventListener('click', function () {
    searchBar.classList.toggle('is-open');
    onScroll();
    if (searchBar.classList.contains('is-open')) setTimeout(function () { $('input', searchBar).focus(); }, 300);
  });
  $('#searchClose').addEventListener('click', function () { searchBar.classList.remove('is-open'); onScroll(); });

  /* =========================================================
     HERO: diptic cu tab-uri
     ========================================================= */
  var hero = $('#hero');
  var slides = $$('.slide', hero);
  var nav = $('#heroNav');
  var DURATION = 7000;
  var cur = 0, timer = null, leaveTimer = null;

  slides.forEach(function (s, k) {
    var b = document.createElement('button');
    b.className = 'hn-tab';
    b.setAttribute('role', 'tab');
    b.innerHTML = '<i></i><span class="hn-num">' + ('0' + (k + 1)).slice(-2) + '</span><span class="hn-label">' + s.getAttribute('data-label') + '</span>';
    b.addEventListener('click', function () { go(k); });
    nav.appendChild(b);
  });
  var tabs = $$('.hn-tab', nav);

  function go(n) {
    n = (n + slides.length) % slides.length;
    if (n !== cur) {
      var prev = slides[cur];
      slides.forEach(function (s) { s.classList.remove('is-leaving'); });
      prev.classList.remove('is-active');
      prev.classList.add('is-leaving');
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(function () { prev.classList.remove('is-leaving'); }, 1450);
    }
    cur = n;
    slides[cur].classList.add('is-active');
    slides.forEach(function (s, k) { s.setAttribute('aria-hidden', k === cur ? 'false' : 'true'); });
    tabs.forEach(function (t, k) {
      t.classList.remove('run');
      t.classList.toggle('done', k < cur);
      t.classList.toggle('is-active', k === cur);
      t.setAttribute('aria-selected', k === cur);
    });
    clearTimeout(timer);
    if (root.classList.contains('has-intro')) return;
    void nav.offsetWidth;
    tabs[cur].querySelector('i').style.animationDuration = DURATION + 'ms';
    tabs[cur].classList.add('run');
    timer = setTimeout(function () { go(cur + 1); }, DURATION);
  }
  var tx = null;
  hero.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
  hero.addEventListener('touchend', function (e) {
    if (tx === null) return;
    var d = e.changedTouches[0].clientX - tx;
    if (Math.abs(d) > 45) go(cur + (d < 0 ? 1 : -1));
    tx = null;
  });
  go(0);
  if (!root.classList.contains('has-intro')) dropHeaderHeart(300);

  /* =========================================================
     FOOTER: literele se ridică, inimioara urcă și coboară
     ========================================================= */
  var mark = $('.footer-mark');
  var markWord = mark && $('.logo-word', mark);
  if (markWord) {
    splitLetters(markWord, 'fl', 70);
    var live = function () {
      mark.classList.add('is-live');
      setTimeout(function () {
        $$('.fl', mark).forEach(function (l) { l.style.transitionDelay = '0ms'; });
        mark.classList.add('is-wave');
      }, 2200);
    };
    if ('IntersectionObserver' in window) {
      var mo = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { live(); mo.disconnect(); }
      }, { threshold: .3 });
      mo.observe(mark);
    } else live();
  }

  /* =========================================================
     PRODUSE
     ========================================================= */
  var P = 'img/products/', B = 'https://buchetino.ro/';
  var products = [
    { id: 224, name: 'Inimă trandafiri criogenați gigant', cat: 'Trandafiri criogenați', price: 4500, img: 'inima-gigant-1.jpg', url: B + 'trandafiri-criogenati/224-inima-mare-trandafiri-criogenati.html', tag: 'Bestseller' },
    { id: 88, name: 'Trandafiri criogenați cutii Luxury', cat: 'Cutii Luxury', price: 5000, img: 'luxury-1.jpg', url: B + 'trandafiri-criogenati/88-trandafiri-criogenati-cutii-luxury.html' },
    { id: 'b101', name: 'Buchet 101 trandafiri roșii', cat: 'Buchete flori', price: 1500, img: 'buchet-101.jpg', url: B + '40-buchete-trandafiri-imperiali' },
    { id: 331, name: 'Trandafir criogenat mov deschis', cat: 'În cupolă de sticlă', price: 500, img: 'cupola-mov.jpg', url: B + 'acasa/331-trandafir-criogenat-cupola.html' },
    { id: 'bimp', name: 'Buchet imens bujori imperiali', cat: 'Buchete de bujori', price: 4500, img: 'bujori-imperiali.jpg', url: B + '78-buchete-imense-de-bujori', tag: 'Sezon' },
    { id: 432, name: 'Inimă trandafiri criogenați mare', cat: 'Trandafiri criogenați', price: 1700, img: 'inima-mare.jpg', url: B + 'acasa/432-inima-tradafiri-criogenati-mare.html' },
    { id: 487, name: 'Trandafiri criogenați cutie mare', cat: 'Cutie mare', price: 4500, img: 'cutie-mare-1.jpg', url: B + 'acasa/487-trandafiri-criogenati-cutie-mare.html' },
    { id: 'armand', name: 'Armand de Brignac Gold Brut', cat: 'Șampanie', price: 3000, img: 'armand-gold.jpg', url: B + '71-sampanie' },
    { id: 85, name: 'Trandafiri criogenați cutii Luxury', cat: 'Cutii Luxury', price: 5000, img: 'luxury-2.jpg', url: B + 'trandafiri-criogenati/85-trandafiri-criogenati-cutii-luxury.html' },
    { id: 'b51', name: 'Buchet 51 de bujori', cat: 'Buchete de bujori', price: 2800, img: 'bujori-51.jpg', url: B + '78-buchete-imense-de-bujori' },
    { id: 462, name: 'Trandafiri criogenați cutie medie', cat: 'Cutie medie', price: 1000, img: 'cutie-medie-1.jpg', url: B + 'acasa/462-trandafiri-criogenati-cutie-medie.html' },
    { id: 'dolce', name: 'Cutie Buchetino Dolce', cat: 'Buchetino Dolce', price: 900, img: 'dolce.jpg', url: B + '62-buchetino-dolce' },
    { id: 223, name: 'Trandafiri criogenați cutie mare', cat: 'Cutie mare', price: 4500, img: 'cutie-mare-2.jpg', url: B + 'trandafiri-criogenati-cutie-mare/223-trandafiri-criogenati-cutie-mare.html' },
    { id: 'nmare', name: 'Trandafiri naturali cutie mare', cat: 'Florărie non stop', price: 800, img: 'naturali-mare.jpg', url: B + '24-trandafiri-naturali-cutie-mare' }
  ];
  var byId = {};
  products.forEach(function (p) { byId[p.id] = p; });
  function lei(n) { return n.toLocaleString('ro-RO').replace(/\s/g, '.') + ' lei'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var rail = $('#rail');
  rail.innerHTML = products.map(function (p) {
    return '<article class="p-card">' +
      '<div class="p-media">' +
        (p.tag ? '<span class="p-tag">' + esc(p.tag) + '</span>' : '') +
        '<a href="' + p.url + '" draggable="false"><img src="' + P + p.img + '" alt="' + esc(p.name) + '" loading="lazy" draggable="false"></a>' +
        '<button class="p-add" data-id="' + p.id + '" aria-label="Adaugă în coș"><svg><use href="#i-plus"/></svg><span>Adaugă</span></button>' +
      '</div>' +
      '<div class="p-body"><div><h3 class="p-name"><a href="' + p.url + '">' + esc(p.name) + '</a></h3><span class="p-cat">' + esc(p.cat) + '</span></div>' +
      '<span class="p-price">' + lei(p.price) + '</span></div>' +
    '</article>';
  }).join('');

  var railBar = $('#railBar');
  function railProgress() {
    var ratio = rail.clientWidth / rail.scrollWidth;
    var max = rail.scrollWidth - rail.clientWidth;
    railBar.style.width = (ratio * 100) + '%';
    railBar.style.transform = 'translateX(' + (max > 0 ? (rail.scrollLeft / max) * ((1 / ratio) - 1) * 100 : 0) + '%)';
  }
  rail.addEventListener('scroll', railProgress, { passive: true });
  window.addEventListener('resize', railProgress);
  railProgress();

  $$('[data-rail]').forEach(function (b) {
    b.addEventListener('click', function () {
      var card = $('.p-card', rail);
      var step = card ? card.getBoundingClientRect().width + 24 : 320;
      rail.scrollBy({ left: Number(b.getAttribute('data-rail')) * step * 2, behavior: 'smooth' });
    });
  });

  // drag cu mouse-ul
  var down = false, sx = 0, sl = 0, moved = false;
  rail.addEventListener('mousedown', function (e) { down = true; moved = false; sx = e.pageX; sl = rail.scrollLeft; });
  window.addEventListener('mousemove', function (e) {
    if (!down) return;
    var d = e.pageX - sx;
    if (Math.abs(d) > 5) { moved = true; rail.classList.add('is-drag'); }
    rail.scrollLeft = sl - d;
  });
  window.addEventListener('mouseup', function () {
    if (!down) return;
    down = false;
    setTimeout(function () { rail.classList.remove('is-drag'); }, 0);
  });

  rail.addEventListener('click', function (e) {
    if (moved) { e.preventDefault(); moved = false; return; }
    var add = e.target.closest('.p-add');
    if (!add) return;
    e.preventDefault();
    addToCart(add.getAttribute('data-id'));
    add.classList.add('is-added');
    setTimeout(function () { add.classList.remove('is-added'); }, 1400);
  });

  /* =========================================================
     COȘ (demo, păstrat local în browser)
     ========================================================= */
  var cart = {};
  try { cart = JSON.parse(localStorage.getItem('bt2-cart') || '{}') || {}; } catch (e) { cart = {}; }
  Object.keys(cart).forEach(function (id) { if (!byId[id]) delete cart[id]; });
  var countEl = $('#cartCount'), itemsEl = $('#cartItems'), totalEl = $('#cartTotal');

  function save() { try { localStorage.setItem('bt2-cart', JSON.stringify(cart)); } catch (e) {} }
  function addToCart(id) {
    cart[id] = (cart[id] || 0) + 1;
    save(); drawCart();
    countEl.classList.remove('bump'); void countEl.offsetWidth; countEl.classList.add('bump');
    setTimeout(function () { openDrawer(cartDrawer); }, 300);
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
      return '<div class="cart-line"><img src="' + P + p.img + '" alt="">' +
        '<div><h4>' + esc(p.name) + '</h4><div class="qty"><button data-q="-1" data-id="' + id + '" aria-label="Scade">−</button><span>' + cart[id] + '</span><button data-q="1" data-id="' + id + '" aria-label="Crește">+</button></div></div>' +
        '<div><div class="price">' + lei(p.price * cart[id]) + '</div><button class="rm" data-rm="' + id + '">Șterge</button></div></div>';
    }).join('');
  }
  itemsEl.addEventListener('click', function (e) {
    var q = e.target.closest('[data-q]'), rm = e.target.closest('[data-rm]');
    if (q) {
      var id = q.getAttribute('data-id');
      cart[id] += Number(q.getAttribute('data-q'));
      if (cart[id] <= 0) delete cart[id];
    } else if (rm) delete cart[rm.getAttribute('data-rm')];
    else return;
    save(); drawCart();
  });
  drawCart();

  /* =========================================================
     DRAWERS
     ========================================================= */
  var scrim = $('#scrim'), menuDrawer = $('#menuDrawer'), cartDrawer = $('#cartDrawer');
  function openDrawer(d) {
    closeDrawers();
    d.classList.add('is-open'); d.setAttribute('aria-hidden', 'false');
    scrim.classList.add('is-on'); document.body.style.overflow = 'hidden';
  }
  function closeDrawers() {
    [menuDrawer, cartDrawer].forEach(function (d) { d.classList.remove('is-open'); d.setAttribute('aria-hidden', 'true'); });
    scrim.classList.remove('is-on'); document.body.style.overflow = '';
  }
  $('#menuOpen').addEventListener('click', function () { openDrawer(menuDrawer); });
  $('#cartOpen').addEventListener('click', function () { openDrawer(cartDrawer); });
  scrim.addEventListener('click', closeDrawers);
  $$('[data-close]').forEach(function (b) { b.addEventListener('click', closeDrawers); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeDrawers(); searchBar.classList.remove('is-open'); onScroll(); }
  });

  /* =========================================================
     REVEAL
     ========================================================= */
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('is-in'); io.unobserve(x.target); } });
    }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else reveals.forEach(function (el) { el.classList.add('is-in'); });

  var y = $('#year'); if (y) y.textContent = new Date().getFullYear();
})();
