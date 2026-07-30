/**
 * Screenshot harness for reviewing the site like a designer.
 *
 *   node tools/shots.mjs <outDir> <spec> [<spec> ...]
 *
 * A spec is `name=path` for a full-page shot, or `name=path@fraction` to scrub
 * the hero to a point in its scroll (0 → 1) and shoot the viewport.
 *
 *   node tools/shots.mjs .shots "pricing=/pricing" "hero70=/@0.7"
 *
 * Needs a dev server on :4321 and a browser: `npx playwright install chromium`.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [outDir, ...specs] = process.argv.slice(2);
if (!outDir || !specs.length) {
  console.error('usage: node tools/shots.mjs <outDir> name=path[@fraction] ...');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const BASE = process.env.BASE ?? 'http://localhost:4321';
const VIEWPORTS = [
  { tag: 'desktop', width: 1440, height: 900 },
  { tag: 'mobile', width: 390, height: 844 },
];

// The hero's timeline has a minimum play time (MIN_PLAY_S, 4.6s), so jumping to
// a scroll position takes a while to settle. hero.js also clamps dt to 0.1s a
// frame, and headless software rendering manages about 6fps, so animation time
// advances at roughly 0.6x wall time: 4.6s of timeline needs ~7.7s of waiting.
const HERO_SETTLE_MS = 12000;

const scrubbing = specs.some((s) => s.includes('@'));

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    // Full-page shots of a 4-screen hero exceed Chrome's capture limit at 2x.
    deviceScaleFactor: scrubbing ? 2 : 1,
  });
  const page = await ctx.newPage();

  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  for (const spec of specs) {
    const [name, rest] = spec.split('=');
    const [path, at] = rest.split('@');

    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);

    await page.evaluate((isScrub) => {
      // Astro's dev toolbar isn't part of the design.
      document.querySelector('astro-dev-toolbar')?.remove();
      // A full-page capture never scrolls, so the reveal observer never fires
      // and lazy images below the fold never load. Force both.
      document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
      document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
        img.loading = 'eager';
      });
      // Collapsing the hero makes a full-page capture possible, but it would
      // also zero the scroll distance the hero animation runs on — so never
      // when we're scrubbing to a position.
      const hero = document.querySelector('[data-hero]');
      if (hero && !isScrub) hero.style.height = '100vh';
      window.dispatchEvent(new Event('resize'));
    }, at !== undefined);

    await page.waitForTimeout(1400);

    let fullPage = true;
    if (at !== undefined) {
      fullPage = false;
      await page.evaluate(
        async ([f, settle]) => {
          document.documentElement.style.scrollBehavior = 'auto';
          const hero = document.querySelector('[data-hero]');
          const dist = hero.getBoundingClientRect().height - window.innerHeight;
          window.scrollTo(0, dist * Number(f));
          await new Promise((r) => setTimeout(r, settle));
        },
        [at, HERO_SETTLE_MS]
      );
    }

    const file = `${outDir}/${name}-${vp.tag}.png`;
    await page.screenshot({ path: file, fullPage });
    console.log(`✓ ${file}`);
  }

  if (errors.length) {
    console.log(`\n⚠ console errors (${vp.tag}):`);
    [...new Set(errors)].forEach((e) => console.log('   ' + e));
  }

  await ctx.close();
}

await browser.close();
