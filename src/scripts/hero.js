/**
 * The home page hero: a website assembles itself out of drifting fragments,
 * then launches.
 *
 * The animation is the pitch — we design it, we build it, we launch it — so
 * every frame should be saying something about getting a website made, not
 * just looking like space.
 *
 * Why Canvas 2D
 * -------------
 * The scene is flat UI parts — bars, slabs, pills, wireframe blocks — moving
 * in a shallow depth field. Depth is faked with scale, opacity and parallax
 * rate, which reads convincingly and costs nothing. A 3D library would be
 * ~170KB to draw rectangles, and a shader can't do rounded corners and crisp
 * edges nearly as easily. This keeps the whole site's JS under 25KB.
 *
 * How it fits together
 * --------------------
 *   LAYOUT     where each piece of the assembled site sits. Edit this to
 *              change what gets built.
 *   BEATS      the scroll windows for each stage.
 *   scatter()  where each piece starts, out in the debris field.
 *   frame()    per animation frame: read scroll → damp it → place every piece
 *              → draw → fade the copy.
 *
 * Two rules this scene must never break, both from design review:
 *   1. Nothing may sit behind or cross the copy. The opening beat scatters
 *      fragments into a ring *around* the headline; the middle beats put the
 *      copy at the bottom with the site above it; and by the closing beat
 *      every object has physically left the frame, so the finale is on clean
 *      black with nothing to occlude it.
 *   2. Every scroll position has several things moving. There is no stretch
 *      where a single object drifts in an empty frame.
 *
 * Nothing here runs under prefers-reduced-motion, or without canvas. The
 * static hero in Hero.astro is always in the markup and is what those
 * visitors see.
 */

const heroEl = document.querySelector('[data-hero]');
const canvas = document.querySelector('[data-hero-canvas]');
const hint = document.querySelector('[data-hero-hint]');

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = window.matchMedia('(max-width: 820px)').matches;
const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// ── Palette ────────────────────────────────────────────────────────────────
// The only colours in the scene. Anything else is a bug.
const GOLD = '245, 194, 75';
const SILVER = '169, 173, 182';
const WHITE = '255, 255, 255';

// ── Timing ─────────────────────────────────────────────────────────────────
//
// Everything below is measured in **vh of scroll from the top of the hero**,
// not in fractions of it, and converted to progress at runtime against the
// hero's real height.
//
// That indirection matters. Progress is normalised to the hero's scroll
// distance, so if these were fractions, changing the hero's height in
// Hero.astro would silently retime the whole sequence — shortening the tail
// would also speed up the assembly. In vh they're absolute: change the height
// and only the amount of tail after the last beat moves.
//
// [fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd]; null means "already
// there" / "stays". These windows are what guarantee only one beat is ever
// on screen at a time.
const BEATS_VH = {
  open: [null, null, 62, 74],
  build: [86, 98, 160, 172],
  launch: [184, 196, 256, 268],
  close: [278, 290, null, null],
};

const HINT_FADE_VH = [8, 30];

// The assembly runs between these two points in the scroll.
const BUILD_FROM_VH = 74;
const BUILD_TO_VH = 200;
// …and the launch between these.
const LAUNCH_FROM_VH = 200;
const LAUNCH_TO_VH = 272;

/**
 * The floor on how fast the sequence can play, in seconds for the whole thing.
 *
 * Scroll-linked opacity alone can't keep copy readable: flick through the hero
 * in a couple of seconds and every line is gone before you've read it, no
 * matter how wide the windows are. So the timeline is rate-limited. Scroll
 * slower than this and it's scrubbed exactly as before, frame for frame;
 * scroll faster and it plays at this pace instead of skipping.
 *
 * Sized against the hold windows above: each of the first three beats holds
 * ~60vh of the 300vh sequence, which at 4s is ~0.8s of full-opacity reading
 * time even for someone who flicks the whole hero in one go.
 *
 * Scrolling back up isn't reading, so reverse gets to move faster.
 */
const MIN_PLAY_S = 4;
const REVERSE_FACTOR = 3;

/**
 * The assembled website, in normalised site coordinates: x and y both run
 * -0.5 → 0.5 across the mockup, so the whole layout scales with the viewport.
 *
 * `g` is the assembly group — pieces with a lower group number fly in first,
 * which is what makes the build legible: frame, then chrome, then nav, then
 * the hero block, then the words, then the buttons.
 */
const LAYOUT = [
  // group 0 — the browser frame itself
  { k: 'frame', x: 0, y: 0, w: 1, h: 1, g: 0 },

  // group 1 — window chrome
  { k: 'fill', x: 0, y: -0.45, w: 1, h: 0.1, g: 1, c: SILVER, a: 0.07 },
  { k: 'dot', x: -0.44, y: -0.45, w: 0.018, h: 0.018, g: 1, c: SILVER, a: 0.5 },
  { k: 'dot', x: -0.4, y: -0.45, w: 0.018, h: 0.018, g: 1, c: SILVER, a: 0.5 },
  { k: 'dot', x: -0.36, y: -0.45, w: 0.018, h: 0.018, g: 1, c: SILVER, a: 0.5 },

  // group 2 — the gold nav bar
  { k: 'nav', x: 0, y: -0.335, w: 0.92, h: 0.075, g: 2 },
  { k: 'pill', x: -0.38, y: -0.335, w: 0.1, h: 0.032, g: 2, c: GOLD, a: 0.95, glow: 1 },
  { k: 'pill', x: 0.14, y: -0.335, w: 0.07, h: 0.018, g: 2, c: SILVER, a: 0.55 },
  { k: 'pill', x: 0.25, y: -0.335, w: 0.07, h: 0.018, g: 2, c: SILVER, a: 0.55 },
  { k: 'pill', x: 0.36, y: -0.335, w: 0.07, h: 0.018, g: 2, c: SILVER, a: 0.55 },

  // group 3 — the hero image block
  { k: 'image', x: 0, y: -0.145, w: 0.92, h: 0.26, g: 3 },

  // group 4 — headline slabs
  { k: 'fill', x: -0.2, y: 0.045, w: 0.52, h: 0.04, g: 4, c: WHITE, a: 0.82, r: 0.5 },
  { k: 'fill', x: -0.28, y: 0.105, w: 0.36, h: 0.04, g: 4, c: WHITE, a: 0.82, r: 0.5 },

  // group 5 — body copy slabs
  { k: 'fill', x: -0.16, y: 0.168, w: 0.6, h: 0.019, g: 5, c: SILVER, a: 0.5, r: 0.5 },
  { k: 'fill', x: -0.19, y: 0.205, w: 0.54, h: 0.019, g: 5, c: SILVER, a: 0.5, r: 0.5 },

  // group 6 — buttons
  { k: 'pill', x: -0.32, y: 0.29, w: 0.2, h: 0.055, g: 6, c: GOLD, a: 0.95, glow: 1.4 },
  { k: 'ghost', x: -0.075, y: 0.29, w: 0.17, h: 0.055, g: 6 },

  // group 7 — the card row
  { k: 'card', x: -0.31, y: 0.415, w: 0.28, h: 0.11, g: 7 },
  { k: 'card', x: 0, y: 0.415, w: 0.28, h: 0.11, g: 7 },
  { k: 'card', x: 0.31, y: 0.415, w: 0.28, h: 0.11, g: 7 },
];

const GROUPS = 8;

// ── maths ──────────────────────────────────────────────────────────────────

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const range = (v, a, b) => clamp01((v - a) / (b - a));

const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeInCubic = (t) => t * t * t;
const easeInOut = (t) => t * t * (3 - 2 * t);

/** Deterministic pseudo-random, so the scene is identical on every load. */
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** How far through the hero's scroll distance we are, 0 → 1. */
function readProgress() {
  const rect = heroEl.getBoundingClientRect();
  const scrollable = rect.height - window.innerHeight;
  if (scrollable <= 0) return 0;
  return clamp01(-rect.top / scrollable);
}

/**
 * Opacity for a beat window at progress p.
 * `s` is the hero's scroll distance in vh, which converts the window's
 * absolute vh positions into the same 0–1 space as p.
 */
function beatAlpha([inA, inB, outA, outB], p, s) {
  const fadeIn = inA === null ? 1 : range(p, inA / s, inB / s);
  const fadeOut = outA === null ? 0 : range(p, outA / s, outB / s);
  return fadeIn * (1 - fadeOut);
}

// ── boot ───────────────────────────────────────────────────────────────────

function start() {
  if (!heroEl || !canvas || prefersReduced) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  const panels = {
    open: heroEl.querySelector('[data-beat="open"]'),
    build: heroEl.querySelector('[data-beat="build"]'),
    launch: heroEl.querySelector('[data-beat="launch"]'),
    close: heroEl.querySelector('[data-beat="close"]'),
  };

  // -- reusable sprites ----------------------------------------------------
  // A radial-gradient blob, pre-rendered once and then stretched to whatever
  // needs a glow. Far cheaper than shadowBlur, and softer-looking.
  function makeGlow(rgb) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, `rgba(${rgb},0.85)`);
    grad.addColorStop(0.4, `rgba(${rgb},0.28)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return c;
  }

  const glowGold = makeGlow(GOLD);
  const glowWhite = makeGlow(WHITE);

  // Film grain, as one tile drawn at a random offset each frame.
  const grain = document.createElement('canvas');
  grain.width = grain.height = 256;
  {
    const g = grain.getContext('2d');
    const img = g.createImageData(256, 256);
    const r = rng(99);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = r() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }

  // -- the scene -----------------------------------------------------------

  const rand = rng(20260727);

  /**
   * Where a piece waits before the build starts: out in a ring, and further
   * away than the site plane.
   *
   * `z` is always > 1. That matters — a piece at z < 1 would draw LARGER
   * scattered than assembled, which reads as debris flying at the camera
   * instead of parts gathering from a distance, and swamps the frame.
   */
  function scatter(i, n) {
    const angle = (i / n) * Math.PI * 2 + rand() * 0.8;
    return {
      ax: Math.cos(angle) * (0.72 + rand() * 0.5),
      ay: Math.sin(angle) * (0.66 + rand() * 0.5),
      rot: (rand() - 0.5) * 1.5,
      spin: (rand() - 0.5) * 0.5,
      z: 1.55 + rand() * 1.85,
      bob: rand() * Math.PI * 2,
    };
  }

  const pieces = LAYOUT.map((p, i) => ({ ...p, ...scatter(i, LAYOUT.length) }));

  /**
   * Debris that never joins the build. Its whole job is to make sure no
   * frame is ever just one object in empty space.
   */
  const DEBRIS = Array.from({ length: 16 }, (_, i) => {
    const kinds = ['pill', 'bar', 'sq', 'line'];
    const angle = (i / 16) * Math.PI * 2 + rand() * 0.7;
    return {
      k: kinds[Math.floor(rand() * kinds.length)],
      ax: Math.cos(angle) * (0.78 + rand() * 0.55),
      ay: Math.sin(angle) * (0.7 + rand() * 0.5),
      w: 0.05 + rand() * 0.13,
      h: 0.01 + rand() * 0.032,
      rot: (rand() - 0.5) * 2.2,
      spin: (rand() - 0.5) * 0.35,
      z: 1.25 + rand() * 1.75,
      bob: rand() * Math.PI * 2,
      gold: rand() > 0.66,
      drift: 0.4 + rand() * 0.9,
    };
  });

  /** Three parallax star layers — near stars move most. */
  const STARS = [
    { n: isSmall ? 34 : 60, z: 0.55, size: 1.7, a: 0.85 },
    { n: isSmall ? 44 : 80, z: 1.0, size: 1.2, a: 0.6 },
    { n: isSmall ? 50 : 96, z: 1.9, size: 0.9, a: 0.4 },
  ].map((layer) => ({
    ...layer,
    pts: Array.from({ length: layer.n }, () => ({
      x: rand() * 2 - 1,
      y: rand() * 2 - 1,
      gold: rand() > 0.9,
      tw: rand() * Math.PI * 2,
    })),
  }));

  // -- sizing --------------------------------------------------------------

  let W = 0;
  let H = 0;
  let SW = 0;
  let SH = 0;
  let siteCX = 0;
  let siteCY = 0;
  const DPR_CAP = 1.75;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const w = Math.floor(cw * ratio);
    const h = Math.floor(ch * ratio);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    W = cw;
    H = ch;

    // The mockup sits above the middle, leaving the lower third clear for the
    // copy beats that run during the build and the launch.
    SW = Math.min(W * (isSmall ? 0.86 : 0.52), isSmall ? 430 : 720);
    SH = Math.min(SW * (isSmall ? 0.8 : 0.62), H * 0.5);
    siteCX = W / 2;
    siteCY = H * (isSmall ? 0.37 : 0.4);
  }

  /**
   * The rectangle the opening copy occupies, in units of half the stage —
   * so 1.0 means "reaches the edge". Measured from the DOM rather than
   * guessed, so it stays correct when the type scale or the wording changes.
   */
  const keep = { x: 0.8, y: 0.45 };

  function measureKeepOut() {
    const block = panels.open?.querySelector('.shell');
    if (!block || !W || !H) return;
    const r = block.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    const cx = c.left + W / 2;
    const cy = c.top + H / 2;
    keep.x = Math.max(Math.abs(r.left - cx), Math.abs(r.right - cx)) / (W / 2);
    keep.y = Math.max(Math.abs(r.top - cy), Math.abs(r.bottom - cy)) / (H / 2);
  }

  resize();
  measureKeepOut();
  window.addEventListener('resize', () => {
    resize();
    measureKeepOut();
  }, { passive: true });

  /**
   * Push a scattered position radially outward until its bounding box clears
   * the copy. This is what actually guarantees the rule rather than hoping
   * the authored positions happen to miss — it accounts for each piece's own
   * size, and it only ever moves things further out, so the ring holds.
   *
   * Returns a multiplier for the scatter position.
   */
  function clearOfCopy(nx, ny, halfWn, halfHn) {
    const mx2 = keep.x + halfWn + 0.05;
    const my2 = keep.y + halfHn + 0.05;
    const k = Math.max(Math.abs(nx) / mx2, Math.abs(ny) / my2);
    return k > 0 && k < 1 ? 1 / k : 1;
  }

  // -- mouse parallax ------------------------------------------------------
  // Desktop only. Enough to make the scene feel alive when you're not
  // scrolling, small enough that it never reads as drift.
  let mx = 0;
  let my = 0;
  let mtx = 0;
  let mty = 0;

  if (canHover) {
    window.addEventListener(
      'pointermove',
      (e) => {
        mtx = (e.clientX / window.innerWidth) * 2 - 1;
        mty = (e.clientY / window.innerHeight) * 2 - 1;
      },
      { passive: true }
    );
  }

  // -- drawing helpers -----------------------------------------------------

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function glow(sprite, cx, cy, w, h, alpha) {
    if (alpha <= 0.01) return;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, cx - w / 2, cy - h / 2, w, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  /** Draw one assembled-site piece in its own local space. */
  function drawPiece(p, w, h, alpha, scale) {
    const x = -w / 2;
    const y = -h / 2;
    const a = alpha;

    switch (p.k) {
      case 'frame':
        ctx.fillStyle = `rgba(${WHITE},${0.022 * a})`;
        roundRect(x, y, w, h, 12 * scale);
        ctx.fill();
        ctx.strokeStyle = `rgba(${SILVER},${0.5 * a})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        break;

      case 'nav':
        ctx.fillStyle = `rgba(${GOLD},${0.1 * a})`;
        roundRect(x, y, w, h, 6 * scale);
        ctx.fill();
        ctx.strokeStyle = `rgba(${GOLD},${0.45 * a})`;
        ctx.lineWidth = 1.1;
        ctx.stroke();
        break;

      case 'image':
        ctx.fillStyle = `rgba(${WHITE},${0.03 * a})`;
        roundRect(x, y, w, h, 7 * scale);
        ctx.fill();
        ctx.strokeStyle = `rgba(${SILVER},${0.4 * a})`;
        ctx.lineWidth = 1.1;
        ctx.stroke();
        // the classic "image goes here" cross
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h);
        ctx.moveTo(x + w, y);
        ctx.lineTo(x, y + h);
        ctx.strokeStyle = `rgba(${SILVER},${0.16 * a})`;
        ctx.stroke();
        break;

      case 'card':
        ctx.fillStyle = `rgba(${WHITE},${0.025 * a})`;
        roundRect(x, y, w, h, 6 * scale);
        ctx.fill();
        ctx.strokeStyle = `rgba(${SILVER},${0.32 * a})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        break;

      case 'ghost':
        ctx.strokeStyle = `rgba(${SILVER},${0.62 * a})`;
        ctx.lineWidth = 1.2;
        roundRect(x, y, w, h, h / 2);
        ctx.stroke();
        break;

      case 'dot':
        ctx.fillStyle = `rgba(${p.c},${p.a * a})`;
        ctx.beginPath();
        ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'pill':
        ctx.fillStyle = `rgba(${p.c},${p.a * a})`;
        roundRect(x, y, w, h, h / 2);
        ctx.fill();
        break;

      default: // 'fill'
        ctx.fillStyle = `rgba(${p.c},${p.a * a})`;
        roundRect(x, y, w, h, (p.r ?? 0.3) * h);
        ctx.fill();
    }
  }

  // -- the loop ------------------------------------------------------------

  let shown = readProgress();
  let running = false;
  let drawn = false;
  const t0 = performance.now();
  let last = t0;

  function ensureRunning() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  // Pause the loop once the hero has scrolled away — but never in a way that
  // can strand a half-finished frame on screen.
  //
  // Two things matter here. Take the LAST entry, not the first: an
  // IntersectionObserver callback can be handed several queued entries, and
  // destructuring `[entry]` reads the oldest one, so a stale "not visible"
  // could stop the loop while the hero was in full view. And listen to scroll
  // as a safety net, so even if the observer misses an edge the scene can
  // always restart rather than freezing mid-launch.
  const io = new IntersectionObserver(
    (entries) => {
      const visible = entries[entries.length - 1].isIntersecting;
      if (visible) ensureRunning();
      else running = false;
    },
    { threshold: 0 }
  );
  io.observe(heroEl);

  window.addEventListener(
    'scroll',
    () => {
      const r = heroEl.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) ensureRunning();
    },
    { passive: true }
  );

  function setBeats(p, scrollVH) {
    for (const [name, win] of Object.entries(BEATS_VH)) {
      const el = panels[name];
      if (!el) continue;
      const a = beatAlpha(win, p, scrollVH);
      el.style.opacity = String(a);
      const off = a < 0.02;
      el.inert = off;
      el.setAttribute('aria-hidden', String(off));
    }
    if (hint)
      hint.style.opacity = String(
        1 - range(p, HINT_FADE_VH[0] / scrollVH, HINT_FADE_VH[1] / scrollVH)
      );
  }

  function frame(now) {
    if (!running) return;

    resize();
    const time = (now - t0) / 1000;

    // Frame-rate independent smoothing. A plain `x += (target - x) * 0.1`
    // settles twice as slowly at 30fps as at 60fps, so the scene would lag
    // noticeably on a weaker device — the exact machines that can least
    // afford it. Deriving the factor from elapsed time keeps the feel
    // identical everywhere.
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const smoothing = (rate) => 1 - Math.pow(1 - rate, dt * 60);

    const target = readProgress();

    // Scroll inertia, then a speed limit on top of it.
    //
    // The easing gives the scene weight at any speed. The clamp is what makes
    // the copy readable: it caps how much of the sequence a single frame can
    // consume, so a fast flick plays the hero through rather than smearing it.
    // Below the limit the clamp never binds and this is a pure scrub.
    const eased = shown + (target - shown) * smoothing(0.12);
    const maxForward = dt / MIN_PLAY_S;
    const maxBack = maxForward * REVERSE_FACTOR;
    shown = Math.max(shown - maxBack, Math.min(shown + maxForward, eased));
    if (Math.abs(target - shown) < 0.0002) shown = target;
    const p = shown;

    const mSmooth = smoothing(0.07);
    mx += (mtx - mx) * mSmooth;
    my += (mty - my) * mSmooth;

    // Background
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, W, H);

    // ── Stars ───────────────────────────────────────────────────────────
    // They drift slowly through the whole scroll, and faster during the
    // launch, so the finale still has motion in it.
    const starDrift = p * 130 + time * 2.5;
    for (const layer of STARS) {
      const par = 1 / layer.z;
      for (const s of layer.pts) {
        const px = ((((s.x * 0.5 + 0.5) * W + mx * 26 * par) % W) + W) % W;
        const py =
          (((((s.y * 0.5 + 0.5) * H - starDrift * par + my * 20 * par) % H) + H) % H);
        const tw = 0.75 + 0.25 * Math.sin(time * 1.4 + s.tw);
        ctx.fillStyle = `rgba(${s.gold ? GOLD : WHITE},${layer.a * tw})`;
        ctx.beginPath();
        ctx.arc(px, py, layer.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Assembly / launch state ─────────────────────────────────────────
    // The hero's scroll distance, in vh — what converts the absolute beat
    // positions above into this frame's progress space.
    // …in vh, so 238 means "two and a bit screens of scrolling". The ×100 is
    // the whole point: the beats above are written in vh, not in screens.
    const scrollVH = Math.max(
      ((heroEl.getBoundingClientRect().height - window.innerHeight) / window.innerHeight) * 100,
      1
    );
    const BUILD_FROM = BUILD_FROM_VH / scrollVH;
    const BUILD_TO = BUILD_TO_VH / scrollVH;
    const LAUNCH_FROM = LAUNCH_FROM_VH / scrollVH;
    const LAUNCH_TO = LAUNCH_TO_VH / scrollVH;

    const build = range(p, BUILD_FROM, BUILD_TO);
    const launch = range(p, LAUNCH_FROM, LAUNCH_TO);
    const launchE = easeInCubic(launch);

    // How far the whole mockup has risen, and how much it's stretched by
    // the speed. By launch = 1 it is comfortably off the top of the frame.
    // Tuned so the mockup is still half in frame at ~80% of the launch — you
    // want to watch it go, not find it already gone — and fully clear by the
    // end of the window, well before the closing copy arrives.
    const riseY = -launchE * (H + SH) * 0.62;
    const stretch = 1 + launchE * 2.6;
    const siteFade = 1 - range(launch, 0.72, 1);

    // Ignition: a glow gathers under the mockup just before it goes.
    const ignite = range(p, LAUNCH_FROM - 0.05, LAUNCH_FROM + 0.04) * (1 - range(launch, 0.5, 0.9));

    // ── Debris ──────────────────────────────────────────────────────────
    // Always drifting; swept upward and out during the launch.
    for (const d of DEBRIS) {
      const par = 1 / d.z;
      const sweep = easeInCubic(range(p, LAUNCH_FROM + 0.02, LAUNCH_TO + 0.04)) * d.drift;
      // Debris hangs around a little past the mockup, so the launch stretch
      // still has movement in it rather than emptying out early.
      const alpha = (1 - range(p, LAUNCH_FROM + 0.11, LAUNCH_TO + 0.02)) * (0.5 / d.z);
      if (alpha <= 0.01) continue;

      const bob = Math.sin(time * 0.5 + d.bob) * 10;
      const w = d.w * SW * par;
      const h = d.h * SW * par;

      const push = clearOfCopy(d.ax, d.ay, w / W, h / H);
      const x = W / 2 + d.ax * push * (W / 2) + mx * 30 * par;
      const y =
        H / 2 + d.ay * push * (H / 2) + bob + my * 24 * par - sweep * (H + 200) * 1.2;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(d.rot + time * d.spin * 0.12);
      const col = d.gold ? GOLD : SILVER;

      if (d.k === 'line') {
        ctx.strokeStyle = `rgba(${col},${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-w / 2, 0);
        ctx.lineTo(w / 2, 0);
        ctx.stroke();
      } else if (d.k === 'sq') {
        ctx.strokeStyle = `rgba(${col},${alpha * 0.9})`;
        ctx.lineWidth = 1;
        roundRect(-w / 2, -w / 2, w, w, 3);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(${col},${alpha})`;
        roundRect(-w / 2, -h / 2, w, h, d.k === 'pill' ? h / 2 : 2);
        ctx.fill();
      }
      ctx.restore();

      if (d.gold) glow(glowGold, x, y, w * 5, h * 9, alpha * 0.35);
    }

    // ── The launch trail ────────────────────────────────────────────────
    // Drawn before the mockup so the mockup rides on top of it.
    if (launch > 0 && siteFade > 0) {
      const tipY = siteCY + riseY + SH * 0.35;
      const len = launchE * H * 1.9;

      // The plume is a stack of soft sprites that taper as they fall behind,
      // rather than a filled rectangle — a rect gives the trail hard vertical
      // edges, which instantly reads as a shape instead of light.
      const steps = 7;
      for (let i = 0; i < steps; i++) {
        const f = i / (steps - 1);
        glow(
          glowGold,
          siteCX,
          tipY + len * f * 0.92,
          SW * (0.62 - 0.34 * f),
          len * 0.5,
          0.2 * siteFade * (1 - f * 0.75)
        );
      }

      // A bright core just behind the mockup. Without it the trail reads as a
      // vague haze rather than something moving fast.
      glow(glowWhite, siteCX, tipY + len * 0.06, SW * 0.16, len * 0.34, 0.5 * siteFade);
      glow(glowGold, siteCX, tipY + len * 0.2, SW * 0.24, len * 0.7, 0.45 * siteFade);
    }

    if (ignite > 0.01) {
      glow(glowGold, siteCX, siteCY + SH * 0.42, SW * 1.6, SH * 1.1, ignite * 0.55);
    }

    // ── The mockup ──────────────────────────────────────────────────────
    // Far pieces first so nearer ones land on top while they're still flying.
    const ordered = pieces
      .map((p2, i) => ({ p2, i }))
      .sort((a, b) => b.p2.z - a.p2.z);

    for (const { p2, i } of ordered) {
      // Per-piece stagger: group 0 starts immediately, group 7 last, and all
      // of them finish together at build = 1.
      const off = (p2.g / GROUPS) * 0.55;
      const t = easeOutExpo(clamp01((build - off) / (1 - off)));
      if (siteFade <= 0.01) continue;

      const par = 1 / lerp(p2.z, 1, t); // depth resolves to the site plane
      const bob = Math.sin(time * 0.6 + p2.bob) * 9 * (1 - t);

      // Scattered position → assembled position. Note the scatter position is
      // NOT scaled by depth: depth shows through size, opacity and parallax
      // rate, and keeping the spread in screen space is what lets the
      // keep-out below be exact.
      const push = clearOfCopy(
        p2.ax,
        p2.ay,
        (p2.w * SW * par) / W,
        (p2.h * (p2.k === 'dot' ? SW : SH) * par) / H
      );
      const sx = W / 2 + p2.ax * push * (W / 2);
      const sy = H / 2 + p2.ay * push * (H / 2) + bob;
      const tx = siteCX + p2.x * SW;
      const ty = siteCY + p2.y * SH;

      const x = lerp(sx, tx, t) + mx * lerp(34, 14, t) * par;
      const y = lerp(sy, ty, t) + my * lerp(26, 11, t) * par + riseY;

      const rot = p2.rot * (1 - t) + time * p2.spin * 0.1 * (1 - t);
      // A whisper of overshoot as each piece lands — the magnetic snap.
      const snap = 1 + Math.sin(clamp01(t) * Math.PI) * 0.05 * (1 - t);
      const scale = lerp(par, 1, t) * snap;

      const w = p2.w * SW * scale;
      const h = p2.h * (p2.k === 'dot' ? SW : SH) * scale;
      const alpha = lerp(0.3 + 0.34 / p2.z, 1, t) * siteFade;

      ctx.save();
      ctx.translate(x, y);
      if (rot) ctx.rotate(rot);
      if (stretch !== 1) ctx.scale(1, stretch);
      drawPiece(p2, w, h, alpha, scale);
      ctx.restore();

      if (p2.glow) {
        glow(glowGold, x, y, w * 3.2, h * 5 * stretch, 0.4 * p2.glow * alpha);
      }
    }

    // ── Grain ───────────────────────────────────────────────────────────
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.028;
    const gx = -Math.floor(rand() * 256);
    const gy = -Math.floor(rand() * 256);
    for (let x = gx; x < W; x += 256) {
      for (let y = gy; y < H; y += 256) ctx.drawImage(grain, x, y);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // ── Vignette ────────────────────────────────────────────────────────
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.72);
    vg.addColorStop(0, 'rgba(10,10,12,0)');
    vg.addColorStop(1, 'rgba(10,10,12,0.72)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // Copy rides the same rate-limited timeline as the scene. It used to
    // follow the raw scroll so it couldn't lag your thumb, but that was
    // before there was a speed limit — with one, the two must share a clock
    // or the narration and the picture describe different moments.
    setBeats(p, scrollVH);

    if (!drawn) {
      drawn = true;
      heroEl.classList.add('is-live');
    }

    requestAnimationFrame(frame);
  }

  ensureRunning();
}

start();
