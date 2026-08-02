/**
 * Regenerates the home page's demo-teaser image from the live sandbox.
 *
 *   node tools/teaser.mjs          (npm run shots:teaser)
 *
 * The teaser at public/shots/demo.webp is a picture of the client portal, and
 * the portal is a component in this repo — so it should never be hand-captured.
 * It went stale exactly that way: the portal was redesigned from mint to gold
 * and the static asset kept showing the old one on the home page for a while.
 *
 * Run this whenever DemoSandbox.astro changes. `npm run verify` will fail if
 * you forget — see the asset-palette check in tools/verify.mjs, which is the
 * safety net for precisely this.
 *
 * Needs a dev server on :4321.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';

const BASE = process.env.BASE ?? 'http://localhost:4321';
const OUT = 'public/shots/demo.webp';

// Matches the <img width/height> on the home page.
const OUT_W = 1280;

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

// Wide viewport so the portal is captured at its desktop layout — sidebar
// visible, three KPI cards across — rather than the stacked mobile one.
const ctx = await browser.newContext({
  viewport: { width: 1680, height: 1000 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

await page.goto(`${BASE}/demo`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({
  content: `
    astro-dev-toolbar { display: none !important; }
    [data-reveal] { opacity: 1 !important; transform: none !important; }
    /* The panels fade in on tab switch (sandbox-page-in). Playwright scrolls an
       element into view before shooting it, which can restart that animation —
       the first version of this script captured the whole right-hand side at
       about 40% opacity, with the gold button rendered as dark olive. */
    .sandbox *, .sandbox *::before, .sandbox *::after {
      animation: none !important;
      transition: none !important;
    }
    .sandbox .portal-tab { opacity: 1 !important; }
  `,
});
await page.waitForTimeout(1200);

// The same view the alt text describes: the version list with its Open and
// Request changes buttons.
await page.click('.sandbox .client-nav-tab[data-tab="real-site"]');
await page.waitForTimeout(600);

const shot = await page.locator('.sandbox .client-dashboard').screenshot();

await sharp(shot)
  .resize({ width: OUT_W })
  .webp({ quality: 82 })
  .toFile(OUT);

const meta = await sharp(OUT).metadata();
console.log(`✓ ${OUT} — ${meta.width}x${meta.height}`);
console.log('  Update the width/height on the <img> in src/pages/index.astro if');
console.log('  the aspect ratio moved, or the page will shift as it loads.');

await browser.close();
