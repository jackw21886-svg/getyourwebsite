/**
 * Proves the hero's copy is readable at a fast scroll, and still scrubs at a
 * slow one.
 *
 *   node tools/pacing.mjs
 *
 * The point of the test: someone who flicks through the hero in a couple of
 * seconds must still get to read all four copy beats. hero.js enforces that
 * with a speed limit on the timeline (MIN_PLAY_S), so the scene and the copy
 * keep playing after the scroll has already finished.
 *
 * Everything here is measured in ANIMATION time, not wall time. Headless
 * software rendering manages about 6fps, so a stopwatch would say every beat
 * flashes past — but the hero advances by real dt, so the same scroll
 * trajectory produces the same trajectory in animation time on any machine.
 * The simulation therefore drives scroll from its own accumulated dt (with the
 * same 0.1s clamp hero.js uses) and measures dwell against that clock.
 *
 * Needs a dev server on :4321.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4321';

// The user-facing requirement: flick through the whole hero in ~3 seconds and
// every beat is still legible for the better part of a second.
const SCROLL_S = 3;
const MIN_DWELL_S = 0.8;
const FULL = 0.98;   // "at full opacity"
const READABLE = 0.8; // still comfortably legible

let failures = 0;
const fail = (m) => { console.log(`  ✗ ${m}`); failures++; };
const pass = (m) => console.log(`  ✓ ${m}`);

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await (await browser.newContext({
  viewport: { width: 1440, height: 900 },
})).newPage();

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// ── Fast scroll ────────────────────────────────────────────────────────────
console.log(`\n[fast] whole hero scrolled in ${SCROLL_S}s\n`);

const dwell = await page.evaluate(
  async ([scrollS, full, readable]) => {
    document.documentElement.style.scrollBehavior = 'auto';
    const hero = document.querySelector('[data-hero]');
    const beats = [...document.querySelectorAll('[data-beat]')];
    const dist = hero.getBoundingClientRect().height - window.innerHeight;

    const atFull = {};
    const atReadable = {};
    const peak = {};
    beats.forEach((b) => {
      atFull[b.dataset.beat] = 0;
      atReadable[b.dataset.beat] = 0;
      peak[b.dataset.beat] = 0;
    });

    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));

    let t = 0;
    let last = performance.now();
    // Keep going well past the scroll: the timeline's speed limit means the
    // scene is still playing out after the scrolling stops, which is exactly
    // the window that makes fast scrolling readable.
    const TOTAL = scrollS + 8;

    await new Promise((resolve) => {
      const step = (now) => {
        const dt = Math.min((now - last) / 1000, 0.1); // hero.js clamps the same way
        last = now;
        t += dt;

        window.scrollTo(0, dist * Math.min(t / scrollS, 1));

        for (const b of beats) {
          const o = parseFloat(getComputedStyle(b).opacity);
          const k = b.dataset.beat;
          if (o > peak[k]) peak[k] = o;
          if (o >= full) atFull[k] += dt;
          if (o >= readable) atReadable[k] += dt;
        }

        if (t >= TOTAL) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

    return { atFull, atReadable, peak, order: beats.map((b) => b.dataset.beat) };
  },
  [SCROLL_S, FULL, READABLE]
);

for (const beat of dwell.order) {
  const f = dwell.atFull[beat];
  const r = dwell.atReadable[beat];
  const line =
    `${beat.padEnd(7)} ${f.toFixed(2)}s at full opacity, ` +
    `${r.toFixed(2)}s readable (peak ${dwell.peak[beat].toFixed(2)})`;
  f >= MIN_DWELL_S ? pass(line) : fail(line + `  — under ${MIN_DWELL_S}s`);
}

// ── Slow scroll still scrubs ───────────────────────────────────────────────
// The speed limit must not turn the hero into a fixed-length movie: at a
// leisurely pace the copy should follow the scroll position, so the beat
// showing at each quarter of the hero is the one that belongs there.
console.log('\n[slow] scrubbing at a leisurely pace\n');

const EXPECT = [
  [0.02, 'open'],
  [0.36, 'build'],
  [0.72, 'launch'],
  [1.0, 'close'],
];

for (const [at, expected] of EXPECT) {
  const active = await page.evaluate(
    async ([f, settle]) => {
      document.documentElement.style.scrollBehavior = 'auto';
      const hero = document.querySelector('[data-hero]');
      const dist = hero.getBoundingClientRect().height - window.innerHeight;
      window.scrollTo(0, dist * f);
      await new Promise((r) => setTimeout(r, settle));
      let best = null;
      let bestO = -1;
      document.querySelectorAll('[data-beat]').forEach((b) => {
        const o = parseFloat(getComputedStyle(b).opacity);
        if (o > bestO) {
          bestO = o;
          best = b.dataset.beat;
        }
      });
      return { best, bestO };
    },
    [at, 12000]
  );
  active.best === expected && active.bestO > 0.9
    ? pass(`${Math.round(at * 100)}% through → "${active.best}" at ${active.bestO.toFixed(2)}`)
    : fail(
        `${Math.round(at * 100)}% through → "${active.best}" at ${active.bestO.toFixed(2)}, expected "${expected}"`
      );
}

console.log(`\n${failures === 0 ? 'PACING OK' : `${failures} FAILURE(S)`}\n`);
await browser.close();
process.exit(failures ? 1 : 0);
