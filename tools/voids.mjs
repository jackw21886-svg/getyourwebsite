/**
 * Finds scroll positions where a fast scroller would see an empty viewport.
 *
 *   node tools/voids.mjs [path ...]
 *
 * Scroll-reveal hides content until it intersects, and the observer is tuned to
 * fire a little late. On a page with only a couple of big blocks that can leave
 * a gap: the section above has scrolled off, the block below hasn't been
 * revealed yet, and there is nothing on screen at all.
 *
 * This models the fast scroller rather than the careful one — it jumps to a
 * position and shoots on the next frame, before the reveal transition has had
 * time to run. Then it measures "ink": the share of pixels that differ from the
 * page's own background. A viewport under the threshold is a void.
 *
 * Needs a dev server on :4321.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';

const BASE = process.env.BASE ?? 'http://localhost:4321';
const PATHS = process.argv.slice(2).length ? process.argv.slice(2) : ['/contact'];
// px advanced per frame. This is the flick speed, and it matters: at a gentle
// 120px a frame the observer keeps up and the page looks fine. Roughly 700px a
// frame is an ordinary hard flick on a trackpad.
const STEP = Number(process.env.STEP ?? 700);
const MIN_INK = Number(process.env.MIN_INK ?? 0.4); // % of pixels that must be non-background
const VW = Number(process.env.VW ?? 1440);
const VH = Number(process.env.VH ?? 900);

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

let failures = 0;

for (const path of PATHS) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
  await page.waitForTimeout(600);

  const height = await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    return document.body.scrollHeight;
  });

  const voids = [];
  let worst = { ink: 101 };

  // Load once at the top, then scroll continuously — this is the whole point.
  // Jumping to a position on a fresh load reveals whatever is in view straight
  // away, so sampling that way reports a clean page no matter how late the
  // reveals are tuned. The void only exists for someone who is already on the
  // page and outruns the observer.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  for (let y = 0; y < height - VH; y += STEP) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));

    const png = await page.screenshot();
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });

    // Measure against this viewport's OWN dominant colour, not the page
    // corner. A white section on a page whose corner is black is not "100%
    // ink" — it's a blank white screen, which is exactly what we're hunting.
    const step = info.channels * 11;
    const buckets = new Map();
    for (let i = 0; i < data.length; i += step) {
      const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    let modeKey = 0;
    let modeN = -1;
    for (const [k, c] of buckets) if (c > modeN) { modeN = c; modeKey = k; }
    // +8 puts us at the CENTRE of the 16-wide bucket, not its floor. Without
    // it a white background reconstructs as 240 against real pixels of 255, and
    // every blank white screen reads as solid ink.
    const bg = [
      (((modeKey >> 8) & 15) << 4) | 8,
      (((modeKey >> 4) & 15) << 4) | 8,
      ((modeKey & 15) << 4) | 8,
    ];

    let ink = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += step) {
      const d =
        Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
      if (d > 40) ink++;
      n++;
    }
    const pct = +((ink / n) * 100).toFixed(2);
    if (pct < worst.ink) worst = { ink: pct, y };
    if (pct < MIN_INK) voids.push({ y, ink: pct });
  }

  if (voids.length) {
    failures++;
    console.log(`\n✗ ${path} — ${voids.length} blank viewport(s)`);
    for (const v of voids) console.log(`    at ${v.y}px  ${v.ink}% ink`);
  } else {
    console.log(`\n✓ ${path} — no blank viewport (thinnest ${worst.ink}% ink at ${worst.y}px)`);
  }

  await ctx.close();
}

await browser.close();
console.log();
process.exit(failures ? 1 : 0);
