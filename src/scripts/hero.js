/**
 * The home page hero scene — Earth, Moon and a star field, scrubbed to the
 * scroll position of the .hero section.
 *
 * Reading order:
 *   1. WAYPOINTS      where the camera is at each point in the scroll
 *   2. buildScene()   everything that gets created once
 *   3. frame()        runs per animation frame: read scroll → move camera → draw
 *
 * Things worth knowing before you change it:
 *   - Nothing here runs under prefers-reduced-motion, or if WebGL is missing.
 *     The static CSS hero in Hero.astro is the fallback and is always present.
 *   - Textures are only fetched after we've decided to run, so a reduced-motion
 *     visitor never downloads them.
 *   - Mobile uses smaller textures, fewer stars and no cloud layer.
 */

const heroEl = document.querySelector('[data-hero]');
const canvas = document.querySelector('[data-hero-canvas]');
const panelOpen = document.querySelector('[data-hero-panel="open"]');
const panelClose = document.querySelector('[data-hero-panel="close"]');
const hint = document.querySelector('[data-hero-hint]');

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Phones and small tablets get the lighter build.
const isSmall = window.matchMedia('(max-width: 820px)').matches;

/**
 * Camera choreography. `at` is progress through the hero scroll (0 → 1),
 * `pos` is where the camera sits and `look` is what it points at.
 *
 * Earth is at the origin with radius 1. The Moon is at MOON_AT below, radius
 * 0.45. The flight goes: close on Earth → back off until Earth and the Moon
 * share the frame → in toward the Moon → around its side → out into open space.
 *
 * If you retime this, the one rule is that no stretch should be empty: there
 * should always be something to look at.
 */
const MOON_AT = [7.5, 0.6, -4.5];

const WAYPOINTS = [
  // The raised `look` in the first two frames aims above Earth's centre, which
  // pushes the planet into the bottom of the shot and leaves clean black sky
  // for the headline — the classic "Earthrise" framing.
  { at: 0.0,  pos: [0.0, -0.1, 2.86],  look: [0, 1.22, 0] },        // close on Earth
  { at: 0.20, pos: [0.35, 0.2, 3.8],   look: [0, 0.7, 0] },         // easing back
  { at: 0.36, pos: [0.2, 0.5, 5.7],    look: [0.4, 0.2, 0.2] },     // Earth whole, small
  { at: 0.50, pos: [-0.6, 0.7, 6.4],   look: [3.5, 0.35, -2.0] },   // Earth left, Moon right
  { at: 0.64, pos: [2.6, 0.8, 3.1],    look: [7.5, 0.6, -4.5] },    // heading for the Moon
  { at: 0.78, pos: [6.0, 0.9, -2.6],   look: [7.5, 0.6, -4.5] },    // close approach
  { at: 0.88, pos: [8.7, 1.05, -3.1],  look: [7.5, 0.6, -4.5] },    // sweeping around it
  { at: 1.0,  pos: [10.8, 1.3, -8.6],  look: [14.5, 1.7, -14.5] },  // deep space
];

/** Fade windows for the two text panels, in progress units. */
const OPEN_FADE = [0.14, 0.26];   // stage 1 text fades out across here
const CLOSE_FADE = [0.80, 0.90];  // stage 3 text fades in across here
const HINT_FADE = [0.02, 0.09];

// --- small maths helpers ---------------------------------------------------

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;

/** Maps v from the range [a, b] onto 0 → 1, clamped at both ends. */
const range = (v, a, b) => clamp01((v - a) / (b - a));

/** Ease in and out — used between waypoints so the camera never snaps. */
const smooth = (t) => t * t * (3 - 2 * t);

/** Interpolate the WAYPOINTS list at progress p. Returns {pos, look}. */
function sampleWaypoints(p) {
  let i = 0;
  while (i < WAYPOINTS.length - 2 && p > WAYPOINTS[i + 1].at) i++;

  const a = WAYPOINTS[i];
  const b = WAYPOINTS[i + 1];
  const t = smooth(range(p, a.at, b.at));

  return {
    pos: [lerp(a.pos[0], b.pos[0], t), lerp(a.pos[1], b.pos[1], t), lerp(a.pos[2], b.pos[2], t)],
    look: [
      lerp(a.look[0], b.look[0], t),
      lerp(a.look[1], b.look[1], t),
      lerp(a.look[2], b.look[2], t),
    ],
  };
}

/** How far we are through the hero's scroll distance, 0 → 1. */
function readProgress() {
  const rect = heroEl.getBoundingClientRect();
  const scrollable = rect.height - window.innerHeight;
  if (scrollable <= 0) return 0;
  return clamp01(-rect.top / scrollable);
}

// --- the scene -------------------------------------------------------------

async function start() {
  if (!heroEl || !canvas || prefersReduced) return;

  // Bail out quietly on machines without WebGL — the CSS hero already looks fine.
  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2') && !probe.getContext('webgl')) return;

  // Dynamic import: Three.js only downloads once we know we're going to use it.
  const THREE = await import('three');

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isSmall,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x0a0a0c, 1);
  // Cap the pixel ratio: a 3x phone screen would otherwise render 9x the pixels.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.75 : 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 400);

  const loader = new THREE.TextureLoader();
  const BASE = document.documentElement.dataset.base || '/';
  const tex = (file) => {
    const t = loader.load(`${BASE}textures/${file}`.replace(/\/{2,}/g, '/'));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = isSmall ? 2 : 4;
    return t;
  };

  // Lighting: one "sun" roughly behind the camera so the day side faces us,
  // plus a dim blue fill so the night side reads as shadow rather than a hole.
  const sun = new THREE.DirectionalLight(0xfff6e8, 3.4);
  sun.position.set(-2.4, 1.6, 5.2);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x4a5570, 0.55));

  // -- Earth ---------------------------------------------------------------
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, isSmall ? 48 : 72, isSmall ? 48 : 72),
    new THREE.MeshStandardMaterial({
      map: tex(isSmall ? 'earth-1k.webp' : 'earth-2k.webp'),
      roughness: 0.92,
      metalness: 0,
    })
  );
  earth.rotation.y = -1.1;
  scene.add(earth);

  // -- Clouds (desktop only — they cost a texture for a subtle gain) --------
  let clouds = null;
  if (!isSmall) {
    clouds = new THREE.Mesh(
      new THREE.SphereGeometry(1.012, 64, 64),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        alphaMap: loader.load(`${BASE}textures/clouds-1k.webp`.replace(/\/{2,}/g, '/')),
        transparent: true,
        opacity: 0.62,
        roughness: 1,
        metalness: 0,
        depthWrite: false,
      })
    );
    scene.add(clouds);
  }

  // -- Atmosphere ----------------------------------------------------------
  // A slightly bigger sphere rendered from the inside. The fresnel term makes
  // it transparent head-on and bright at the edges, which reads as a glow.
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 64, 64),
    new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(0x6ea8ff) } },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vNormal;
        void main() {
          // Fresnel: transparent looking straight at the sphere, bright at the
          // edges. That bright edge is the atmosphere. The high exponent keeps
          // the glow hugging the limb instead of reading as a drawn-on ring.
          float rim = pow(clamp(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 2.6);
          gl_FragColor = vec4(uColor, 1.0) * rim * 1.35;
        }
      `,
    })
  );
  scene.add(atmosphere);

  // -- Moon ----------------------------------------------------------------
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, isSmall ? 36 : 56, isSmall ? 36 : 56),
    new THREE.MeshStandardMaterial({
      map: tex(isSmall ? 'moon-512.webp' : 'moon-1k.webp'),
      roughness: 1,
      metalness: 0,
    })
  );
  moon.position.set(MOON_AT[0], MOON_AT[1], MOON_AT[2]);
  scene.add(moon);

  // -- Stars ---------------------------------------------------------------
  // Points scattered on a big spherical shell around the whole flight path.
  // A tenth of them are gold, which ties the sky to the brand without being
  // obvious about it.
  const STAR_COUNT = isSmall ? 1400 : 3200;
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const white = new THREE.Color(0xffffff);
  const gold = new THREE.Color(0xf5c24b);

  for (let i = 0; i < STAR_COUNT; i++) {
    // Even distribution on a sphere, radius 60–150, centred on the flight path.
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 60 + Math.random() * 90;

    // Centred on the middle of the camera's flight path so the sky surrounds
    // the whole journey rather than just the start of it.
    positions[i * 3] = 5 + r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = -3 + r * Math.sin(phi) * Math.sin(theta);

    const c = Math.random() < 0.1 ? gold : white;
    const shade = 0.55 + Math.random() * 0.45;
    colors[i * 3] = c.r * shade;
    colors[i * 3 + 1] = c.g * shade;
    colors[i * 3 + 2] = c.b * shade;
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Points are square by default, which reads as pixel dirt at this size. A
  // tiny radial-gradient canvas turns each one into a soft round dot.
  const dot = document.createElement('canvas');
  dot.width = dot.height = 32;
  const dctx = dot.getContext('2d');
  const grad = dctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  dctx.fillStyle = grad;
  dctx.fillRect(0, 0, 32, 32);

  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      size: isSmall ? 0.85 : 0.7,
      map: new THREE.CanvasTexture(dot),
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  scene.add(stars);

  // --- sizing -------------------------------------------------------------

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Widen the field of view on narrow screens so Earth still fits.
    camera.fov = camera.aspect < 0.8 ? 62 : 48;
    camera.updateProjectionMatrix();
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  // --- the loop -----------------------------------------------------------

  const target = new THREE.Vector3();
  let running = true;
  let firstFrameDrawn = false;
  let lastTime = performance.now();

  // Only run while the hero is actually on screen. Once you've scrolled down to
  // the pricing teaser there is no reason to keep a WebGL loop alive.
  const io = new IntersectionObserver(
    ([entry]) => {
      running = entry.isIntersecting;
      if (running) {
        lastTime = performance.now();
        requestAnimationFrame(frame);
      }
    },
    { threshold: 0 }
  );
  io.observe(heroEl);

  function setPanels(p) {
    // Stage 1 text: fully visible, then fades out.
    panelOpen.style.opacity = String(1 - range(p, OPEN_FADE[0], OPEN_FADE[1]));
    // Stage 3 text: fades in near the end.
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

    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    const p = readProgress();
    const { pos, look } = sampleWaypoints(p);

    camera.position.set(pos[0], pos[1], pos[2]);
    target.set(look[0], look[1], look[2]);
    camera.lookAt(target);

    // A slow spin so the planet feels alive even when you stop scrolling.
    earth.rotation.y += dt * 0.035;
    if (clouds) clouds.rotation.y += dt * 0.047;
    moon.rotation.y += dt * 0.012;

    renderer.render(scene, camera);
    setPanels(p);

    if (!firstFrameDrawn) {
      firstFrameDrawn = true;
      heroEl.classList.add('is-live');
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

start();
