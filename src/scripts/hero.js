/**
 * The home page hero: a scroll-driven flight past a black hole.
 *
 * Why raw WebGL and not Three.js
 * ------------------------------
 * The whole scene is one full-screen fragment shader — stars, lensing, the
 * accretion disk and the grain are all computed per pixel. There is no
 * geometry, no textures and no scene graph, so a 3D library would have been
 * ~170KB of download doing nothing. What's left is: compile a shader, set a
 * handful of uniforms, draw one triangle.
 *
 * How it fits together
 * --------------------
 *   KEYS          the choreography — where the black hole is and how big it
 *                 looks at each point in the scroll. Tune the animation here,
 *                 not in the shader.
 *   FRAGMENT      the drawing. Reads the uniforms KEYS produces.
 *   frame()       per animation frame: read scroll → damp it → set uniforms →
 *                 draw → fade the text panels.
 *
 * Nothing in this file runs under prefers-reduced-motion, or if WebGL is
 * missing, or if the shader fails to compile. The static hero in Hero.astro is
 * always in the markup and is what those visitors see.
 */

const heroEl = document.querySelector('[data-hero]');
const canvas = document.querySelector('[data-hero-canvas]');
const panelOpen = document.querySelector('[data-hero-panel="open"]');
const panelClose = document.querySelector('[data-hero-panel="close"]');
const hint = document.querySelector('[data-hero-hint]');

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = window.matchMedia('(max-width: 820px)').matches;

/**
 * Choreography. Each key is a moment in the scroll:
 *
 *   at    progress through the hero, 0 → 1
 *   bh    where the black hole sits on screen. (0,0) is the middle; y is in
 *         [-0.5, 0.5] and x is the same scale, so on a wide screen x runs
 *         past ±0.5 at the edges.
 *   rs    apparent radius of the event horizon, in the same units. This is
 *         what sells "getting closer" — everything else scales off it.
 *   lens  how hard space bends. Peaks on the close approach and releases at
 *         the end as we slingshot away.
 *   disk  brightness of the accretion disk.
 *   par   how far the star layers have drifted. Near layers move more than
 *         far ones, which is what gives the field depth.
 *
 * The one rule when retuning: no stretch of the scroll should be visually
 * empty. There should always be either the disk or a dense star field
 * carrying the frame.
 */
const KEYS = [
  { at: 0.0,  bh: [0.40, 0.10],   rs: 0.034, lens: 0.85, disk: 0.80, par: 0.0 },
  { at: 0.20, bh: [0.34, 0.08],   rs: 0.052, lens: 1.0,  disk: 0.95, par: 0.05 },
  { at: 0.42, bh: [0.18, 0.03],   rs: 0.088, lens: 1.25, disk: 1.12, par: 0.15 },
  { at: 0.64, bh: [0.0, -0.01],   rs: 0.120, lens: 1.55, disk: 1.10, par: 0.30 },
  { at: 0.82, bh: [-0.30, -0.10], rs: 0.145, lens: 1.30, disk: 1.00, par: 0.50 },
  { at: 1.0,  bh: [-0.88, -0.38], rs: 0.100, lens: 0.30, disk: 0.45, par: 0.76 },
];

/** Fade windows for the two text beats, in progress units. */
const OPEN_FADE = [0.15, 0.27];
const CLOSE_FADE = [0.82, 0.92];
const HINT_FADE = [0.02, 0.09];

// ── maths helpers ──────────────────────────────────────────────────────────

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const range = (v, a, b) => clamp01((v - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);

/** Interpolate KEYS at progress p. */
function sample(p) {
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1].at) i++;

  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = smooth(range(p, a.at, b.at));

  return {
    bx: lerp(a.bh[0], b.bh[0], t),
    by: lerp(a.bh[1], b.bh[1], t),
    rs: lerp(a.rs, b.rs, t),
    lens: lerp(a.lens, b.lens, t),
    disk: lerp(a.disk, b.disk, t),
    par: lerp(a.par, b.par, t),
  };
}

/** How far through the hero's scroll distance we are, 0 → 1. */
function readProgress() {
  const rect = heroEl.getBoundingClientRect();
  const scrollable = rect.height - window.innerHeight;
  if (scrollable <= 0) return 0;
  return clamp01(-rect.top / scrollable);
}

// ── shaders ────────────────────────────────────────────────────────────────

const VERTEX = `#version 300 es
// One triangle big enough to cover the screen. Cheaper than a quad and needs
// no vertex buffer — gl_VertexID does the work.
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uBh;     // black hole centre, screen units
uniform float uRs;     // event horizon radius
uniform float uLens;   // lensing strength
uniform float uDisk;   // disk brightness
uniform float uPar;    // parallax drift

// Palette. These are the only colours in the scene — the site's gold, white
// and silver. Nothing else is allowed in here.
const vec3 GOLD   = vec3(0.961, 0.761, 0.294);  // #F5C24B
const vec3 SILVER = vec3(0.663, 0.678, 0.714);  // #A9ADB6
const vec3 WHITE  = vec3(1.0);

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

/**
 * One depth layer of stars.
 *
 * The field is a hashed grid: each cell either holds a star or doesn't, and
 * the hash also decides its offset within the cell, its size, its brightness
 * and whether it's one of the rare gold ones.
 */
vec3 starLayer(vec2 uv, float scale, float bright, float twinkle) {
  vec2 gv = uv * scale;
  vec2 id = floor(gv);
  vec2 f = fract(gv) - 0.5;

  float h = hash21(id);
  float on = step(0.70, h);                       // ~30% of cells hold a star

  vec2 off = vec2(hash21(id + 1.3), hash21(id + 7.7)) - 0.5;
  float d = length(f - off * 0.72);

  float size = mix(0.010, 0.032, hash21(id + 3.1));
  float s = smoothstep(size, 0.0, d);

  // A tight halo so the brighter stars read as light rather than as dots.
  // Keep it small — overdo this and the whole field turns to fuzz.
  s += smoothstep(size * 3.2, 0.0, d) * 0.10;

  float gold = step(0.93, hash21(id + 9.4));
  vec3 tint = mix(mix(SILVER, WHITE, hash21(id + 5.2)), GOLD, gold);

  float tw = 1.0 - twinkle * 0.35 * (0.5 + 0.5 * sin(uTime * 1.7 + h * 42.0));

  return tint * s * bright * tw * on;
}

void main() {
  // Screen coords, aspect-corrected: y runs -0.5 → 0.5 top to bottom.
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;

  vec2 d = p - uBh;
  float r = max(length(d), 1e-4);
  vec2 dir = d / r;

  // ── Gravitational lensing ────────────────────────────────────────────
  // Light from behind the hole is bent toward us, so the background appears
  // dragged outward from the horizon. Sampling the star field at a point
  // pushed away from the centre reproduces that: near the horizon we end up
  // reading stars from far away, which compresses them into a bright ring.
  // Falls off as 1/r² so it's violent up close and invisible further out.
  float defl = uLens * uRs * uRs / (r * r);
  defl = min(defl, 2.5);                          // keep it from exploding
  vec2 bent = p + dir * defl;

  // ── Star field ───────────────────────────────────────────────────────
  // Three depth layers. The near layer drifts most, the far layer barely
  // moves — that difference is the whole illusion of depth.
  vec2 drift = vec2(uPar, uPar * 0.22) + vec2(uTime * 0.004, 0.0);

  vec3 col = vec3(0.0);
  col += starLayer(bent + drift * 1.00, 7.5,  0.85, 1.0);   // near
  col += starLayer(bent + drift * 0.52, 14.0, 0.55, 0.7);   // mid
#if LAYERS > 2
  col += starLayer(bent + drift * 0.24, 26.0, 0.34, 0.4);   // far
#endif

  // ── Accretion disk ───────────────────────────────────────────────────
  // A tilted ring: squashing y before measuring the radius turns the circle
  // into the ellipse you'd see from just above the disk plane.
  const float TILT = 0.30;
  float e = length(vec2(d.x, d.y / TILT));

  // Keep the annulus THIN. A thick band reads as a flat ochre donut; a thin,
  // hot one reads as a disk of matter seen nearly edge-on.
  float rIn = uRs * 2.3;
  float rOut = uRs * 3.15;

  float band = smoothstep(rIn, rIn * 1.07, e) * (1.0 - smoothstep(rOut * 0.86, rOut, e));

  // Structure in the disk. Without this it's a smooth gradient and reads as
  // an airbrushed donut; with it, it reads as matter actually moving.
  float ang = atan(d.y / TILT, d.x);
  band *= 0.72 + 0.28 * sin(ang * 7.0 + e / max(uRs * 0.30, 1e-4) - uTime * 0.85);

  // Doppler beaming: the side rotating toward us is brighter and hotter.
  float dop = 0.4 + 0.9 * smoothstep(0.4, -0.4, dir.x);

  // The inner edge is hottest, so it washes toward white.
  float hot = smoothstep(rIn * 1.7, rIn, e);
  vec3 diskCol = mix(GOLD, mix(GOLD, WHITE, 0.85), hot * 0.85);

  col += diskCol * band * dop * uDisk * 1.9;

  // The far side of the disk, lensed up and over the horizon.
  //
  // Two details make this read correctly instead of looking like a second,
  // separate ring: it has to hug the shadow closely, and it has to be
  // strongest directly above and below it — fading out to the left and right
  // where the direct band already crosses. That's what produces the
  // arcs-over-the-top silhouette rather than a planet with rings.
  float halo = smoothstep(uRs * 1.18, uRs * 1.30, r) * (1.0 - smoothstep(uRs * 1.46, uRs * 1.70, r));
  halo *= 0.25 + 0.95 * smoothstep(0.12, 0.72, abs(dir.y));
  col += mix(GOLD, WHITE, 0.3) * halo * uDisk * 1.5;

  // ── Photon ring ──────────────────────────────────────────────────────
  // The thin, very bright circle right at the edge of the shadow. Its width
  // is held in absolute screen units rather than scaled off uRs, so it stays
  // a crisp line as the hole grows instead of thickening into a band.
  float ringR = uRs * 1.09;
  float ringW = clamp(uRs * 0.03, 0.0011, 0.0030);
  float ring = smoothstep(ringW * 2.4, ringW * 0.5, abs(r - ringR));
  col += mix(GOLD, WHITE, 0.35) * ring * (0.7 + uDisk * 0.8);

  // ── Bloom ────────────────────────────────────────────────────────────
  // Two additive lobes — one tight around the ring, one wide and soft —
  // instead of a second render pass.
  //
  // The radii are CLAMPED rather than scaled straight off uRs. That matters:
  // glow area grows with the square of its radius, so an unclamped version
  // floods the entire frame with gold on the close approach and drowns both
  // the lensed stars and the headline.
  float gTight = min(uRs * 1.8, 0.15);
  float gWide = min(uRs * 3.6, 0.30);
  float tight = 0.34 / (1.0 + pow(r / gTight, 3.0));
  float wide = 0.20 / (1.0 + pow(e / gWide, 2.2));
  col += GOLD * uDisk * (tight * 0.42 + wide * 0.22);

  // ── Event horizon ────────────────────────────────────────────────────
  // Nothing comes out. Everything drawn so far gets cut away inside it.
  col *= smoothstep(uRs * 0.94, uRs * 1.06, r);

  // ── Grade ────────────────────────────────────────────────────────────
  // Soft shoulder so the hot core rolls off instead of clipping to a flat blob.
  col = col / (1.0 + col * 0.45);

  // Vignette: keeps the eye centred and helps the headline read.
  col *= 1.0 - 0.36 * smoothstep(0.36, 1.05, length(p));

  // Film grain. Small, but it's the difference between "render" and "shot".
  float g = hash21(gl_FragCoord.xy + fract(uTime * 0.35) * 431.0);
  col += (g - 0.5) * 0.028;

  fragColor = vec4(max(col, 0.0), 1.0);
}`;

// ── boot ───────────────────────────────────────────────────────────────────

function compile(gl, type, source) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('[hero] shader failed to compile:', gl.getShaderInfoLog(sh));
    return null;
  }
  return sh;
}

function start() {
  if (!heroEl || !canvas || prefersReduced) return;

  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false, // we're drawing one triangle; there are no edges to alias
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
  });

  // No WebGL2? Leave the static hero in place. It's already on screen.
  if (!gl) return;

  // Mobile drops the far star layer — it's the least visible and the most
  // per-pixel work.
  const source = FRAGMENT.replace('#version 300 es', `#version 300 es\n#define LAYERS ${isSmall ? 2 : 3}`);

  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl, gl.FRAGMENT_SHADER, source);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[hero] program failed to link:', gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  const u = {
    res: gl.getUniformLocation(prog, 'uRes'),
    time: gl.getUniformLocation(prog, 'uTime'),
    bh: gl.getUniformLocation(prog, 'uBh'),
    rs: gl.getUniformLocation(prog, 'uRs'),
    lens: gl.getUniformLocation(prog, 'uLens'),
    disk: gl.getUniformLocation(prog, 'uDisk'),
    par: gl.getUniformLocation(prog, 'uPar'),
  };

  // A full-screen fragment shader is fill-rate bound, so pixel count is the
  // whole performance story. Capping the ratio below the device's native one
  // is invisible on a soft, glowing scene and roughly halves the work.
  const DPR_CAP = isSmall ? 1.5 : 1.75;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    const w = Math.floor(canvas.clientWidth * ratio);
    const h = Math.floor(canvas.clientHeight * ratio);
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(u.res, w, h);
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  // Damped progress. The shader follows this rather than the raw scroll
  // position, so the camera carries a little weight instead of snapping to
  // the scrollbar.
  let shown = readProgress();
  let running = true;
  let drawn = false;
  const t0 = performance.now();

  // Don't burn a WebGL loop once the hero has scrolled away.
  const io = new IntersectionObserver(
    ([entry]) => {
      running = entry.isIntersecting;
      if (running) requestAnimationFrame(frame);
    },
    { threshold: 0 }
  );
  io.observe(heroEl);

  function setPanels(p) {
    panelOpen.style.opacity = String(1 - range(p, OPEN_FADE[0], OPEN_FADE[1]));
    panelClose.style.opacity = String(range(p, CLOSE_FADE[0], CLOSE_FADE[1]));
    if (hint) hint.style.opacity = String(1 - range(p, HINT_FADE[0], HINT_FADE[1]));

    // Keep faded-out panels out of the tab order and off the a11y tree.
    const openHidden = p > OPEN_FADE[1];
    const closeHidden = p < CLOSE_FADE[0];
    panelOpen.inert = openHidden;
    panelOpen.setAttribute('aria-hidden', String(openHidden));
    panelClose.inert = closeHidden;
    panelClose.setAttribute('aria-hidden', String(closeHidden));
  }

  function frame(now) {
    if (!running) return;

    resize();

    const target = readProgress();
    // Critically damped enough to feel weighty without feeling laggy.
    shown += (target - shown) * 0.11;
    if (Math.abs(target - shown) < 0.0002) shown = target;

    const s = sample(shown);

    // KEYS are authored for a wide screen. Screen units are scaled by HEIGHT,
    // so a phone in portrait only has about ±0.23 of horizontal room where a
    // laptop has ±0.8 — without this the black hole sits half off the right
    // edge on mobile. Squeeze x toward the centre as the viewport narrows.
    const aspect = canvas.width / Math.max(canvas.height, 1);
    const xScale = Math.min(1, aspect / 1.55);

    gl.uniform1f(u.time, (now - t0) / 1000);
    // Lift it clear of the headline on tall screens, where text fills the
    // middle of the frame. (+y is up.)
    const yLift = (1 - xScale) * 0.18;

    gl.uniform2f(u.bh, s.bx * xScale, s.by + yLift);
    gl.uniform1f(u.rs, s.rs);
    gl.uniform1f(u.lens, s.lens);
    gl.uniform1f(u.disk, s.disk);
    gl.uniform1f(u.par, s.par);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Panels follow the raw scroll, not the damped value — text lagging
    // behind your thumb feels broken in a way a camera doesn't.
    setPanels(target);

    if (!drawn) {
      drawn = true;
      heroEl.classList.add('is-live');
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

start();
