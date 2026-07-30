/**
 * Captures the ambient dark-section states for design review.
 *
 *   node tools/ambient-shots.mjs [outDir]
 *
 * The specular sweeps spend most of their cycle parked off the edge on
 * purpose, so a screenshot taken at a random moment almost always misses them.
 * This freezes the animations at chosen phases so each state is reviewable,
 * and captures the card hover and the reduced-motion pose too.
 *
 * Needs a dev server on :4321.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? '.shots/ambient';
mkdirSync(out, { recursive: true });

const BASE = process.env.BASE ?? 'http://localhost:4321';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

/** Reveal content, drop the dev toolbar, and hide the hero (reviewed elsewhere). */
const PREP = `
  astro-dev-toolbar { display: none !important; }
  [data-reveal] { opacity: 1 !important; transform: none !important; }
`;

/**
 * Freeze every animation on the page at an exact phase.
 *
 * A negative animation-delay looks like it should do this, but it only SHIFTS
 * the phase relative to whenever the animation started — so the result
 * depends on how long the page has been open. Setting currentTime through the
 * Web Animations API is absolute, and it reaches pseudo-element animations too,
 * which is where all of the ambient layers live.
 */
async function freezeAt(page, seconds) {
  await page.evaluate((ms) => {
    for (const anim of document.getAnimations()) {
      try {
        anim.currentTime = ms;
        anim.pause();
      } catch {
        /* a finished or unseekable animation is fine to skip */
      }
    }
  }, seconds * 1000);
}

async function shoot(page, name, selector) {
  const target = selector ? page.locator(selector).first() : page;
  await target.screenshot({ path: `${out}/${name}.png` });
  console.log(`✓ ${out}/${name}.png`);
}

for (const vp of [
  { tag: 'desktop', width: 1440, height: 900 },
  { tag: 'mobile', width: 390, height: 844 },
]) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // ── Pricing cards: the specular sweep mid-pass ──────────────────────────
  await page.goto(`${BASE}/pricing`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.addStyleTag({ content: PREP });
  // 14s cycle crossing between 0% and 38%, i.e. over 5.32s. The band sits at
  // the card's centre when translateX hits 0, which is halfway: ~2.66s.
  await freezeAt(page, 2.66);
  await page.waitForTimeout(200);
  await shoot(page, `pricing-sweep-${vp.tag}`, '.tiers');

  // ── The dark section as a whole ─────────────────────────────────────────
  await shoot(page, `pricing-section-${vp.tag}`, '.section--dark');

  // ── Footer ──────────────────────────────────────────────────────────────
  await shoot(page, `footer-${vp.tag}`, '.foot');

  // ── Card hover, sweep at the same phase for a fair comparison ───────────
  if (vp.tag === 'desktop') {
    const ctxHover = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    const hoverPage = await ctxHover.newPage();
    await hoverPage.goto(`${BASE}/pricing`, { waitUntil: 'networkidle' });
    await hoverPage.waitForTimeout(900);
    await hoverPage.addStyleTag({ content: PREP });
    await hoverPage.hover('.tier--popular');
    await freezeAt(hoverPage, 2.66);
    await hoverPage.waitForTimeout(300);
    await hoverPage.locator('.tiers').first().screenshot({
      path: `${out}/pricing-sweep-hover.png`,
    });
    console.log(`✓ ${out}/pricing-sweep-hover.png`);
    await ctxHover.close();
  }

  // ── Home: demo teaser and the final CTA band ────────────────────────────
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.addStyleTag({ content: PREP + '[data-hero]{display:none !important}' });
  await freezeAt(page, 9);
  await page.waitForTimeout(200);
  await shoot(page, `demo-teaser-${vp.tag}`, '.section--dark');
  await shoot(page, `cta-band-${vp.tag}`, '.cta-band');

  await ctx.close();
}

// ── Reduced motion: the same gradients, held still ─────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/pricing`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.addStyleTag({ content: PREP });
  await page.locator('.section--dark').first().screenshot({
    path: `${out}/reduced-pricing.png`,
  });
  console.log(`✓ ${out}/reduced-pricing.png`);
  await page.locator('.foot').first().screenshot({ path: `${out}/reduced-footer.png` });
  console.log(`✓ ${out}/reduced-footer.png`);
  await ctx.close();
}

await browser.close();
