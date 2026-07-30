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

// ── The typed request is copy too ──────────────────────────────────────────
// It has to be finished, and then sit still long enough to read, before the
// send button fires — at a fast flick, not just a leisurely scroll.
//
// Both events are read off the canvas rather than off the constants in
// hero.js, so this fails if the drawing stops matching the timing:
//   "finished typing"  the lit pixels in the bar's text band stop increasing
//   "the send fires"   the button's gold area collapses under the press
console.log(`\n[typing] request finishes and rests, scrolling in ${SCROLL_S}s\n`);

// Start from a genuinely fresh page. The test above leaves the window scrolled
// to the bottom, and the timeline's reverse rate means a scrollTo(0,0) takes a
// couple of seconds to unwind — long enough that this test was catching the
// prompt stage playing *backwards* and calling it a pass.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const typing = await page.evaluate(
  async ([scrollS]) => {
    document.documentElement.style.scrollBehavior = 'auto';
    const hero = document.querySelector('[data-hero]');
    const canvas = document.querySelector('[data-hero-canvas]');
    const g = canvas.getContext('2d', { willReadFrequently: true });
    const dist = hero.getBoundingClientRect().height - window.innerHeight;

    // Where the bar sits while it's at rest, mirroring drawPromptBar().
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const small = window.matchMedia('(max-width: 820px)').matches;
    const scale = canvas.width / cw;
    const barW = Math.min(cw * (small ? 0.88 : 0.56), small ? 396 : 620);
    const barH = small ? 52 : 62;
    const cx = cw / 2;
    const cy = ch * (small ? 0.37 : 0.4);
    const btnR = (barH - (small ? 12 : 14)) / 2;

    const px = (v) => Math.max(0, Math.round(v * scale));
    const textBox = {
      x: px(cx - barW / 2 + (small ? 16 : 22)),
      y: px(cy - 12),
      w: px(barW * 0.66),
      h: px(24),
    };
    const btnBox = {
      x: px(cx + barW / 2 - btnR * 2 - (small ? 8 : 10)),
      y: px(cy - btnR - 4),
      w: px(btnR * 2 + 8),
      h: px(btnR * 2 + 8),
    };

    const sample = (box, test) => {
      const d = g.getImageData(box.x, box.y, box.w, box.h).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (test(d[i], d[i + 1], d[i + 2])) n++;
      return n;
    };
    // The request is near-white; the button is gold.
    const litText = () => sample(textBox, (r, gg, b) => r > 150 && gg > 150 && b > 150);
    const goldBtn = () => sample(btnBox, (r, gg, b) => r > 170 && gg > 110 && b < 110);

    // Collect the whole series and work out the two moments afterwards, rather
    // than trying to spot them live. Online detection kept latching onto the
    // first noisy frame; with the series in hand, "finished typing" and "the
    // send fired" are unambiguous.
    //
    // Only sample while the bar actually owns the frame.
    //
    // Without this gate the boxes pick up whatever else is on the canvas — the
    // white headline slabs drift through the text box during the opening, and
    // the assembled site's gold nav pill lands in the button box — so both
    // events get "detected" before the bar has even arrived. The prompt beat's
    // opacity is the honest signal for "this stage is on screen", and it rides
    // the same clock as the scene.
    const beat = document.querySelector('[data-beat="prompt"]');
    const onStage = () => parseFloat(getComputedStyle(beat).opacity) >= 0.9;

    // Wait for the timeline to actually unwind, not just for the scrollbar to
    // move. The browser restores the old scroll position across a reload, so
    // the hero starts believing it's at the end; rewinding runs at
    // REVERSE_FACTOR and still takes a couple of seconds. Starting the
    // measurement early caught the stage playing backwards at speed, which
    // reported a comfortable pass for a sequence that was never observed.
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 6000));

    let t = 0;
    let last = performance.now();
    const rows = [];
    const TOTAL = scrollS + 10;

    await new Promise((resolve) => {
      const step = (now) => {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        t += dt;
        window.scrollTo(0, dist * Math.min(t / scrollS, 1));

        if (onStage()) rows.push({ t, text: litText(), gold: goldBtn() });

        if (t >= TOTAL) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

    return rows;
  },
  [SCROLL_S]
);

{
  const maxText = Math.max(0, ...typing.map((r) => r.text));
  // The first frame the request is essentially complete.
  const typed = typing.find((r) => maxText > 50 && r.text >= maxText * 0.98);
  // The button's resting gold area, taken from before the request finished so
  // the press itself can't drag the baseline down.
  const before = typing.filter((r) => typed && r.t < typed.t).map((r) => r.gold);
  const rest = before.length ? before.sort((a, b) => a - b)[before.length >> 1] : 0;
  // The press shrinks the button and lays a dark ring across it, so its gold
  // area collapses. Nothing else in this window touches it.
  const pressed = typed && rest > 50
    ? typing.find((r) => r.t > typed.t && r.gold < rest * 0.75)
    : null;

  if (!typed || !pressed) {
    fail(
      `could not observe the stage — ${typing.length} frames, maxText=${maxText}, ` +
        `resting gold=${rest}, typedAt=${typed?.t?.toFixed(2)}, pressed=${!!pressed}\n` +
        typing
          .map((r) => `      t=${r.t.toFixed(2)} text=${r.text} gold=${r.gold}`)
          .join('\n')
    );
  } else {
    const gap = pressed.t - typed.t;
    const line =
      `request finished typing at ${typed.t.toFixed(2)}s, send pressed at ` +
      `${pressed.t.toFixed(2)}s — ${gap.toFixed(2)}s of rest`;
    gap >= MIN_DWELL_S ? pass(line) : fail(line + `  — under ${MIN_DWELL_S}s`);
  }
}

// ── Slow scroll still scrubs ───────────────────────────────────────────────
// The speed limit must not turn the hero into a fixed-length movie: at a
// leisurely pace the copy should follow the scroll position, so the beat
// showing at each quarter of the hero is the one that belongs there.
console.log('\n[slow] scrubbing at a leisurely pace\n');

const EXPECT = [
  [0.02, 'open'],
  [0.34, 'prompt'],
  [0.62, 'build'],
  [0.835, 'launch'],
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
