// ============ HERO LIQUID (three.js) ============
// Same technique as the reference design: the hero is one full-screen quad whose
// fragment shader ray-marches a field of spheres that melt into each other.
//   - one large sphere stays put
//   - a chain of spheres, from large to tiny, trails behind the cursor. While the
//     cursor rests they sit on top of each other and add up to one big round drop;
//     when it moves they string out into a tapering tail
//   - wherever the drop touches the large sphere, the two become one body
// There is no lighting. The colour comes from noise looked up along the mirror
// direction of the surface, pushed to a hard contrast: green that flows over black.
// If three.js or WebGL is unavailable, the CSS blobs in styles.css stay visible.
(function () {
  const hero = document.getElementById('home');
  if (!hero) return;
  // no three.js or no WebGL: show the CSS blobs instead
  const fallback = () => hero.classList.add('no-webgl');
  if (typeof THREE === 'undefined') return fallback();

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- settings ----------
  // Sizes are in "units": half of the hero's shorter side.
  const TRAIL_LENGTH = 15;      // spheres in the chain behind the cursor
  const BIG_RADIUS = 0.55;      // the sphere that stays put
  const HEAD_RADIUS = 0.12;     // first sphere of the chain
  const TAPER = 0.008;          // each next sphere is this much smaller
  const STICKINESS = 7;         // lower = bodies reach for each other from further away

  const HEAD_FOLLOW = 0.16;     // how quickly the drop goes after the cursor (0..1 per frame)
  const TAIL_FOLLOW = 0.42;     // how quickly each sphere catches up with the one before it
  const COLOR_SPEED = 2;        // how fast the colour flows
  const COLOR_SCALE = 2;        // lower = larger patches of colour

  // Touch screens have no cursor to follow, so there the 15 spheres become three
  // satellites with short liquid tails, circling the large sphere on tilted ellipses.
  // Where an orbit passes close they melt into it, then tear away again. A tap pushes
  // them away from the finger and they drift back. Scrolling and the menu never move them.
  const touchMode = !window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const SAT_SPHERES = TRAIL_LENGTH / 3;  // head + tail of each satellite
  const SATELLITES = [
    // size: head radius; a/b: orbit half-axes; tilt: orbit rotation; speed: rad/s (negative = other way)
    { size: 0.2, a: 1.35, b: 0.72, tilt: 0.3, speed: 0.5, phase: 0 },
    { size: 0.15, a: 1.25, b: 0.78, tilt: -0.35, speed: -0.38, phase: 2.1 },
    { size: 0.11, a: 1.4, b: 0.7, tilt: 0.6, speed: 0.65, phase: 4.2 },
  ];
  const SCATTER = 0.9;          // how far a tap pushes the satellites (units)
  const SCATTER_FADE = 2.2;     // how quickly they return to their orbits

  // Where things sit, measured from the centre of the hero (x right, y up).
  const layout = (w, h) => {
    if (touchMode) {
      const unit = Math.min(w * 0.24, h * 0.3);
      return { unit, big: [w * 0.14, -h * 0.06], rest: [0, 0] };
    }
    if (w < 900) {
      const unit = w * 0.36;
      return { unit, big: [w * 0.3, h * 0.2], rest: [-w * 0.14, h * 0.02] };
    }
    const unit = Math.min(w, h) / 2;
    return { unit, big: [unit, -unit * 0.25], rest: [0, 0] };
  };

  // ---------- renderer ----------
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  } catch (err) {
    return fallback();
  }
  // ray-marching cost grows with pixel count, so the resolution is capped
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);
  const canvas = renderer.domElement;
  canvas.className = 'hero__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  hero.prepend(canvas);

  // ---------- shaders ----------
  // All lengths are CSS pixels; the origin is the centre of the hero, y points up.
  const VERTEX = `
    void main(){
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `;

  const FRAGMENT = `
    const int TRAIL = ${TRAIL_LENGTH};
    const int MARCH_STEPS = 28;

    uniform vec2 uSize;          // hero size in CSS px
    uniform float uDpr;
    uniform float uTime;
    uniform float uUnit;         // px per unit
    uniform vec2 uBig;           // centre of the sphere that stays put
    uniform vec2 uTrail[TRAIL];  // the chain behind the cursor, head first
    uniform float uRadius[TRAIL]; // radius of each of those spheres, in units

    // value noise: random values on a grid, smoothly blended in between
    float hash(vec3 p){
      return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453123);
    }
    float noise(vec3 p){
      vec3 i = floor(p);
      vec3 f = fract(p);
      vec3 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), u.x),
            mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
        mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), u.x),
            mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), u.x), u.y),
        u.z);
    }

    // Distance to the liquid: every sphere, melted together with an exponential
    // smooth minimum. Spheres that overlap reinforce each other, which is why the
    // chain is one fat drop at rest and a thin tail when it is strung out.
    float map(vec3 p){
      float k = ${STICKINESS.toFixed(3)} / uUnit;
      float sum = exp(-k * (length(p - vec3(uBig, 0.0)) - ${BIG_RADIUS.toFixed(4)} * uUnit));
      for (int i = 0; i < TRAIL; i++) {
        float radius = uRadius[i] * uUnit;
        sum += exp(-k * (length(p - vec3(uTrail[i], 0.0)) - radius));
      }
      return -log(max(sum, 1e-30)) / k;
    }

    // Colour of the surface where its normal is n. Two noise fields slide past each
    // other in opposite directions along the mirror direction; the steep power
    // curve turns their soft gradients into green pools on black.
    vec3 liquid(vec3 n){
      vec3 r = reflect(vec3(0.0, 0.0, -1.0), n) * ${COLOR_SCALE.toFixed(3)};
      float flowA = noise(r + uTime);
      float flowB = noise(r - uTime);
      vec3 c = (vec3(0.0, 1.0, 0.45) * flowA + vec3(0.1) * flowB) * 1.5;
      return pow(c, vec3(7.0));
    }

    void main(){
      vec2 xy = gl_FragCoord.xy / uDpr - 0.5 * uSize;
      vec3 bg = vec3(0.0863);   // the page colour, #161616

      // Every centre lies in the screen plane and we look straight at it, so a
      // pixel shows liquid exactly when the field is negative in that plane.
      float d0 = map(vec3(xy, 0.0));
      if (d0 > 0.0) {
        // soften the outline; along it the surface faces sideways
        float cover = 1.0 - smoothstep(0.0, 1.5, d0);
        gl_FragColor = vec4(mix(bg, liquid(vec3(normalize(xy - uBig), 0.0)), cover), 1.0);
        return;
      }

      // walk in from the front until the surface is reached
      vec3 pos = vec3(xy, uUnit);
      for (int i = 0; i < MARCH_STEPS; i++) {
        float d = map(pos);
        if (d < 0.25) break;
        pos.z -= d;
      }

      vec2 e = vec2(1.0, -1.0);
      vec3 n = normalize(
          e.xyy * map(pos + e.xyy) + e.yyx * map(pos + e.yyx)
        + e.yxy * map(pos + e.yxy) + e.xxx * map(pos + e.xxx));

      gl_FragColor = vec4(liquid(n), 1.0);
    }
  `;

  // ---------- scene: one full-screen quad ----------
  const trail = [];
  for (let i = 0; i < TRAIL_LENGTH; i++) trail.push(new THREE.Vector2());
  // desktop: one chain from large to tiny; touch: each satellite tapers on its own
  const radii = trail.map((_, i) => {
    if (!touchMode) return HEAD_RADIUS - TAPER * i;
    const sat = SATELLITES[Math.floor(i / SAT_SPHERES)];
    return sat.size * (1 - 0.16 * (i % SAT_SPHERES));
  });

  const uniforms = {
    uSize: { value: new THREE.Vector2(1, 1) },
    uDpr: { value: dpr },
    uTime: { value: 0 },
    uUnit: { value: 100 },
    uBig: { value: new THREE.Vector2() },
    uTrail: { value: trail },
    uRadius: { value: radii },
  };
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms, depthTest: false })
  );
  quad.frustumCulled = false;
  scene.add(quad);

  // ---------- sizing ----------
  let width = 1;
  let height = 1;
  const rest = new THREE.Vector2(); // where the drop waits while no cursor is over the page
  let placed = false;

  function resize() {
    width = canvas.clientWidth || 1;
    height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    uniforms.uSize.value.set(width, height);

    const l = layout(width, height);
    uniforms.uUnit.value = l.unit;
    uniforms.uBig.value.set(l.big[0], l.big[1]);
    rest.set(l.rest[0], l.rest[1]);
    if (!placed) {
      if (touchMode) SATELLITES.forEach((sat, s) => trail.slice(s * SAT_SPHERES, (s + 1) * SAT_SPHERES).forEach((p) => p.copy(orbit(sat, s))));
      else trail.forEach((p) => p.copy(rest));
      placed = true;
    }
  }

  // ---------- pointer ----------
  const pointer = new THREE.Vector2();
  let pointerActive = false;

  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      THREE.MathUtils.clamp(e.clientX - rect.left, 0, width) - width / 2,
      height / 2 - THREE.MathUtils.clamp(e.clientY - rect.top, 0, height)
    );
    pointerActive = true;
  }

  // ---------- touch: satellites ----------
  let clock = 0;
  const scatter = SATELLITES.map(() => new THREE.Vector2());
  const orbitPos = SATELLITES.map(() => new THREE.Vector2());

  // where satellite s is on its tilted ellipse right now
  function orbit(sat, s) {
    const big = uniforms.uBig.value;
    const unit = uniforms.uUnit.value;
    const angle = sat.phase + clock * sat.speed;
    const x = Math.cos(angle) * sat.a * unit;
    const y = Math.sin(angle) * sat.b * unit;
    const c = Math.cos(sat.tilt);
    const n = Math.sin(sat.tilt);
    return orbitPos[s].set(big.x + x * c - y * n, big.y + x * n + y * c);
  }

  // `click` only fires for a real tap, never at the end of a scroll or swipe
  function onTap(e) {
    if (document.getElementById('nav')?.classList.contains('is-open')) return;
    onPointerMove(e);
    const unit = uniforms.uUnit.value;
    SATELLITES.forEach((_, s) => {
      const away = trail[s * SAT_SPHERES].clone().sub(pointer);
      // the closer the finger, the harder the push
      const push = SCATTER * unit * Math.max(0.4, 1 - away.length() / (3 * unit));
      scatter[s].add(away.normalize().multiplyScalar(push));
    });
  }

  // ---------- frame ----------
  let last = performance.now();
  let raf = 0;

  function update(dt) {
    const k = dt * 60; // 1 at 60fps
    uniforms.uTime.value += dt * COLOR_SPEED;
    clock += dt;

    const head = 1 - Math.pow(1 - HEAD_FOLLOW, k);
    const link = 1 - Math.pow(1 - TAIL_FOLLOW, k);

    if (touchMode) {
      // each satellite's head chases its orbit (plus any push from a tap), its tail chases the head
      const fade = Math.exp(-SCATTER_FADE * dt);
      SATELLITES.forEach((sat, s) => {
        const first = s * SAT_SPHERES;
        scatter[s].multiplyScalar(fade);
        trail[first].lerp(orbit(sat, s).add(scatter[s]), head);
        for (let i = first + SAT_SPHERES - 1; i > first; i--) trail[i].lerp(trail[i - 1], link);
      });
      return;
    }

    // the head goes after the cursor, every other sphere after the one before it
    trail[0].lerp(pointerActive ? pointer : rest, head);
    for (let i = TRAIL_LENGTH - 1; i > 0; i--) trail[i].lerp(trail[i - 1], link);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    renderer.render(scene, camera);
  }

  function start() {
    if (raf || reduceMotion) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  resize();
  update(0);
  renderer.render(scene, camera);

  window.addEventListener('resize', () => {
    resize();
    if (!raf) renderer.render(scene, camera);
  });

  if (!reduceMotion) {
    if (touchMode) {
      hero.addEventListener('click', onTap);
    } else {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      // cursor left the page: let the drop float back to its waiting place
      document.documentElement.addEventListener('pointerleave', () => { pointerActive = false; });
    }
    // only animate while the hero is on screen
    new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop())).observe(hero);
  }
})();
