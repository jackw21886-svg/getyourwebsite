/**
 * End-to-end verification. Run it before pushing anything significant.
 *
 *   node tools/verify.mjs
 *
 * Sections:
 *   1  every internal link resolves
 *   2  the demo sandbox flow works end to end
 *   2b nothing in the hero scene ever sits behind the copy
 *   3  reduced motion collapses the hero and stills the ambient layers
 *   4  the contact form validates and fails loudly when it can't send
 *   5  every button comes from the shared system
 *   6  the ambient dark-section layers behave
 *
 * Needs a dev server on :4321.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4321';
const PAGES = ['/', '/work', '/demo', '/pricing', '/benefits', '/why-us', '/contact'];

// Jumping straight to a scroll position takes a while to settle, because the
// hero timeline has a minimum play time (MIN_PLAY_S in hero.js, 4.6s).
//
// Be generous, and here's the arithmetic for why: hero.js clamps dt to 0.1s a
// frame so a stall can't jump the scene. Headless software rendering manages
// about 6fps, i.e. 0.167s of wall time per frame, so animation time advances at
// roughly 0.6x wall time — 4.6s of timeline needs ~7.7s of waiting. Anything
// tighter samples a half-finished frame and reads as a site bug.
const HERO_SETTLE_MS = 12000;

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

let failures = 0;
const fail = (m) => { console.log(`  ✗ ${m}`); failures++; };
const pass = (m) => console.log(`  ✓ ${m}`);

// ── 1. Links ───────────────────────────────────────────────────────────────
console.log('\n[1] Link check');
const seen = new Map();

for (const path of PAGES) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  const hrefs = await page.$$eval('a[href]', (as) =>
    as
      .map((a) => a.getAttribute('href'))
      .filter((h) => h && !h.startsWith('#') && !h.startsWith('mailto:'))
  );
  for (const h of new Set(hrefs)) {
    if (/^https?:\/\//.test(h)) continue; // external, not our problem
    if (!seen.has(h)) seen.set(h, new Set());
    seen.get(h).add(path);
  }
}

let linkFailures = 0;
for (const [href, from] of seen) {
  const res = await page.request.get(`${BASE}${href}`);
  if (res.status() >= 400) {
    fail(`${href} → ${res.status()}  (linked from ${[...from].join(', ')})`);
    linkFailures++;
  }
}
if (!linkFailures) pass(`${seen.size} distinct internal links all resolve`);

// ── 2. Demo sandbox ────────────────────────────────────────────────────────
console.log('\n[2] Demo sandbox flow');
await page.goto(`${BASE}/demo`, { waitUntil: 'networkidle' });

await page.click('[data-tab="real-site"]');
const versions = await page.locator('.portal-version-item').count();
versions === 3
  ? pass(`version list shows ${versions} approved versions`)
  : fail(`expected 3 versions, saw ${versions}`);

await page.click('[data-revise-latest]');
await page.waitForSelector('[data-revise]:not([hidden])');
pass('change-request workspace opens');

const pill = (await page.textContent('[data-revise-version]')).trim();
pill === 'Version 3' ? pass(`version pill reads "${pill}"`) : fail(`pill said "${pill}"`);

// Click a heading in the preview the way a person would: a real mouse click at
// its on-screen position. The preview's photos arrive late and reflow it, so
// let it settle before measuring where to click.
const frame = page.frameLocator('[data-frame]');
await frame.locator('h1').first().waitFor({ timeout: 15000 });
await page.waitForTimeout(2500);
const hbox = await frame.locator('h1').first().boundingBox();
await page.mouse.click(hbox.x + hbox.width / 2, hbox.y + hbox.height / 2);
await page.waitForTimeout(500);

const noteLabel = await page.textContent('.client-revise-note-label').catch(() => null);
noteLabel
  ? pass(`element note created: "${noteLabel.trim().slice(0, 50)}…"`)
  : fail('clicking the preview created no note');

await page.fill('.client-revise-note textarea', 'Make this bigger.');
await page.fill('[data-overall]', 'Warmer colours please.');
await page.waitForTimeout(200);

const prompt = await page.textContent('[data-prompt]');
prompt.includes('Overall changes for the whole website')
  ? pass('prompt preview uses the real client prompt format')
  : fail('prompt preview format is wrong');
prompt.includes('On the Home page:')
  ? pass('prompt includes the page section')
  : fail('prompt missing the page section');

(await page.getAttribute('[data-send]', 'disabled')) === null
  ? pass('send button enables once there is content')
  : fail('send button still disabled');

await page.click('[data-send]');
await page.waitForSelector('[data-success]:not([hidden])', { timeout: 5000 });
(await page.textContent('[data-success]')).includes('Your change request was sent')
  ? pass('success banner matches the real portal copy')
  : fail('success banner copy is wrong');

await page.waitForSelector('[data-log]:not([hidden])');
(await page.locator('[data-log-items] li').count()) === 1
  ? pass("request appears in the \"what we'd receive\" log")
  : fail('narration log did not record the request');

await page.click('[data-reset]');
await page.waitForTimeout(300);
(await page.locator('[data-log-items] li').count()) === 0
  ? pass('reset clears demo state')
  : fail('reset left state behind');

// ── 2b. Hero: nothing may sit behind the copy ──────────────────────────────
// The round-2 critical bug, turned into a regression test. Rather than
// eyeballing a screenshot, read the hero canvas and count how much of the
// rectangle the copy occupies is lit. A star field scores near zero; a website
// mockup parked behind the headline does not.
console.log('\n[2b] Hero copy stays clear');
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

async function litBehind(beat, fraction) {
  return page.evaluate(
    async ([beat, f, settle]) => {
      document.documentElement.style.scrollBehavior = 'auto';
      const hero = document.querySelector('[data-hero]');
      const dist = hero.getBoundingClientRect().height - window.innerHeight;
      window.scrollTo(0, dist * f);
      await new Promise((r) => setTimeout(r, settle));

      const canvas = document.querySelector('[data-hero-canvas]');
      const block = document.querySelector(`[data-beat="${beat}"] .shell`);
      const cr = canvas.getBoundingClientRect();
      const br = block.getBoundingClientRect();

      const sx = ((br.left - cr.left) / cr.width) * canvas.width;
      const sy = ((br.top - cr.top) / cr.height) * canvas.height;
      const sw = (br.width / cr.width) * canvas.width;
      const sh = (br.height / cr.height) * canvas.height;

      const g = canvas.getContext('2d', { willReadFrequently: true });
      const data = g.getImageData(
        Math.max(0, sx | 0),
        Math.max(0, sy | 0),
        Math.max(1, Math.min(sw | 0, canvas.width)),
        Math.max(1, Math.min(sh | 0, canvas.height))
      ).data;

      let lit = 0;
      let n = 0;
      for (let i = 0; i < data.length; i += 4 * 13) {
        const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        if (l > 42) lit++;
        n++;
      }
      return +((lit / n) * 100).toFixed(2);
    },
    [beat, fraction, HERO_SETTLE_MS]
  );
}

for (const [beat, at, limit] of [
  ['close', 1, 1.5],
  ['open', 0, 2.5],
  ['prompt', 0.34, 2.5],
  ['build', 0.62, 2.5],
]) {
  const lit = await litBehind(beat, at);
  lit < limit
    ? pass(`${beat} beat sits on clear background — ${lit}% lit`)
    : fail(`something is behind the ${beat} copy — ${lit}% lit (limit ${limit}%)`);
}

// ── 3. Reduced motion ──────────────────────────────────────────────────────
console.log('\n[3] Reduced motion');
const rmCtx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
});
const rm = await rmCtx.newPage();
await rm.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await rm.waitForTimeout(1200);

const heroH = await rm.evaluate(
  () => document.querySelector('[data-hero]').getBoundingClientRect().height
);
// What this is really checking is that the 550vh scroll hero has collapsed to a
// still one — not that it fits in a viewport. The still hero carries five
// blocks now (headline, the prompt beat, the bar, the CTAs, the mockup) and is
// legitimately a bit taller than one screen; 4950px would mean it hadn't
// collapsed at all.
heroH <= 1600
  ? pass(`hero collapses to a still screen (${Math.round(heroH)}px, not 4950px)`)
  : fail(`hero still ${Math.round(heroH)}px tall`);

(await rm.evaluate(() => document.querySelector('[data-hero]').classList.contains('is-live')))
  ? fail('canvas scene started anyway')
  : pass('canvas scene never starts under reduced motion');

(await rm.locator('[data-beat="close"] a.btn').first().isVisible())
  ? pass('static fallback still shows both CTAs')
  : fail('CTAs hidden in the reduced-motion hero');

// The prompt stage has to survive into the still hero: the beat that narrates
// it, and the bar itself with the request already typed in.
(await rm.locator('[data-beat="prompt"]').isVisible())
  ? pass('the prompt beat is part of the still hero')
  : fail('prompt beat hidden under reduced motion');

{
  const bar = rm.locator('.hero__promptbar');
  const text = (await bar.locator('.hero__promptbar-text').textContent().catch(() => '')) ?? '';
  const send = await bar.locator('.hero__promptbar-send').isVisible().catch(() => false);
  (await bar.isVisible()) && /warmer/.test(text) && send
    ? pass(`static prompt bar shows the finished request — "${text.trim()}"`)
    : fail(`static prompt bar wrong: visible=${await bar.isVisible()}, text="${text}", send=${send}`);
}

// …and it must never appear when the canvas is doing the job.
(await page.locator('.hero__promptbar').isVisible())
  ? fail('the static prompt bar is showing on top of the live canvas hero')
  : pass('static prompt bar stays hidden while the canvas runs');

(await rm.evaluate(() =>
  [...document.querySelectorAll('[data-reveal]')].every(
    (el) => getComputedStyle(el).opacity === '1'
  )
))
  ? pass('all content visible (no reveal animation)')
  : fail('some content stayed hidden');

// The ambient layers must keep their gradients but stop moving.
const rmAmbient = await rm.evaluate(() => {
  const s = document.querySelector('.section--dark');
  const after = getComputedStyle(s, '::after');
  return {
    running: document.getAnimations().length,
    hasGradient: after.backgroundImage.includes('gradient'),
  };
});
rmAmbient.running === 0 && rmAmbient.hasGradient
  ? pass('ambient layers keep their gradients but no animation is running')
  : fail(`reduced-motion ambient wrong: ${JSON.stringify(rmAmbient)}`);

await rmCtx.close();

// ── 4. Contact form ────────────────────────────────────────────────────────
console.log('\n[4] Contact form');
await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle' });

await page.click('[data-submit]');
await page.waitForTimeout(300);
(await page.getAttribute('[data-status]', 'data-state')) === 'error'
  ? pass('empty submit is blocked with an inline error')
  : fail('empty submit was not blocked');

(await page.evaluate(() => document.activeElement?.id)) === 'name'
  ? pass('focus moves to the first invalid field')
  : fail('focus did not move to the first invalid field');

await page.fill('#name', 'Rosa Delgado');
await page.fill('#business', "Rosa's Bakery");
await page.fill('#type', 'Bakery');
await page.fill('#email', 'not-an-email');
await page.click('[data-submit]');
await page.waitForTimeout(300);
(await page.getAttribute('#email', 'aria-invalid')) === 'true'
  ? pass('invalid email is flagged on the field')
  : fail('bad email was accepted');

await page.fill('#email', 'rosa@example.com');
await page.click('[data-submit]');
await page.waitForTimeout(2500);
const status = await page.getAttribute('[data-status]', 'data-state');
const msg = await page.textContent('[data-status]');
status === 'error' && /email us directly/i.test(msg)
  ? pass('unset access key fails loudly and points at the email fallback')
  : fail(`unexpected submit result: ${status} — ${msg}`);

// ── 5. Buttons ─────────────────────────────────────────────────────────────
console.log('\n[5] Buttons');
await page.goto(`${BASE}/pricing`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

const strays = await page.$$eval('a,button', (els) =>
  els
    .filter((el) => {
      const t = (el.textContent || '').trim();
      // Skip the portal lookalike (deliberately its own system), nav/footer
      // chrome, the FAQ accordion, anything hidden, and Astro's dev toolbar.
      if (!t || el.closest('.sandbox, nav, footer, .faq, header, astro-dev-toolbar')) return false;
      if (el.getBoundingClientRect().height === 0) return false;
      const cs = getComputedStyle(el);
      const styled = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.borderTopWidth !== '0px';
      return styled && !el.classList.contains('btn') && !el.classList.contains('link-arrow');
    })
    .map((el) => el.tagName + '.' + el.className)
);
strays.length === 0
  ? pass('no ad-hoc buttons outside the shared system')
  : fail('ad-hoc buttons found: ' + strays.slice(0, 4).join(', '));

const geom = await page.$$eval('.btn', (els) =>
  els
    .filter((el) => el.getBoundingClientRect().height > 0)
    .map((el) => ({
      r: getComputedStyle(el).borderRadius,
      h: Math.round(el.getBoundingClientRect().height),
    }))
);
geom.filter((g) => parseFloat(g.r) > 100).length === 0
  ? pass(`all ${geom.length} buttons use the system radius, not a full pill`)
  : fail('some buttons are still fully rounded');

const heights = [...new Set(geom.map((g) => g.h))].sort((a, b) => a - b);
heights.every((h) => [40, 48, 56].includes(h))
  ? pass('button heights are all on the 40/48/56 scale — ' + heights.join(', '))
  : fail('off-scale button heights: ' + heights.join(', '));

const ring = await page.evaluate(() => {
  const b = document.querySelector('.btn--gold');
  b.focus();
  const cs = getComputedStyle(b);
  return {
    width: cs.outlineWidth,
    dark: cs.boxShadow.includes('rgb(10, 10, 12)'),
  };
});
ring.dark && parseFloat(ring.width) >= 2
  ? pass('gold button focus ring has both a dark and a gold band')
  : fail(`focus ring looks wrong: ${JSON.stringify(ring)}`);

await page.mouse.move(0, 0);
const btnBox = await page.locator('.btn--gold').first().boundingBox();
await page.mouse.move(btnBox.x + 20, btnBox.y + 20);
await page.mouse.down();
await page.waitForTimeout(60);
const during = await page.locator('.btn__ripple').count();
await page.mouse.up();
await page.waitForTimeout(1000);
const after = await page.locator('.btn__ripple').count();
during > 0 && after === 0
  ? pass('press ripple spawns and is cleaned up afterwards')
  : fail(`ripple during=${during} after=${after}`);

// ── 6. Ambient dark sections ───────────────────────────────────────────────
console.log('\n[6] Ambient dark sections');
await page.goto(`${BASE}/pricing`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

// Every dark section carries both layers.
const layers = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.section--dark, .foot').forEach((el) => {
    const before = getComputedStyle(el, '::before').backgroundImage;
    const after = getComputedStyle(el, '::after').backgroundImage;
    out.push(before.includes('gradient') && after.includes('gradient'));
  });
  return { total: out.length, ok: out.filter(Boolean).length };
});
layers.total > 0 && layers.ok === layers.total
  ? pass(`all ${layers.total} dark regions carry both ambient layers`)
  : fail(`${layers.total - layers.ok} of ${layers.total} dark regions missing a layer`);

// White sections must be untouched.
const whiteClean = await page.evaluate(() =>
  [...document.querySelectorAll('.section:not(.section--dark)')].every((el) => {
    const a = getComputedStyle(el, '::after').backgroundImage;
    const b = getComputedStyle(el, '::before').backgroundImage;
    return !a.includes('gradient') && !b.includes('gradient');
  })
);
whiteClean
  ? pass('white sections have no ambient layers')
  : fail('a white section picked up an ambient layer');

// The specular sweep gets stronger on hover.
const hoverBoost = await page.evaluate(async () => {
  const tier = document.querySelector('.tier');
  const read = () => parseFloat(getComputedStyle(tier.querySelector('.tier__sheen'), '::before').opacity);
  const rest = read();
  tier.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
  // :hover can't be forced from script, so compare the declared rule instead.
  const ruleFound = [...document.styleSheets].some((sheet) => {
    try {
      return [...sheet.cssRules].some(
        (r) => r.selectorText?.includes('.tier:hover .tier__sheen::before') && r.style.opacity === '1'
      );
    } catch {
      return false;
    }
  });
  return { rest, ruleFound };
});
hoverBoost.rest < 1 && hoverBoost.ruleFound
  ? pass(`card sweep is ${hoverBoost.rest} at rest and rises to 1 on hover`)
  : fail(`hover boost missing: ${JSON.stringify(hoverBoost)}`);

// Offscreen sections stop animating.
const paused = await page.evaluate(async () => {
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 700));
  const all = [...document.querySelectorAll('.section--dark, .foot')];
  const off = all.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom < -200 || r.top > window.innerHeight + 200;
  });
  return {
    offscreen: off.length,
    pausedOffscreen: off.filter((el) => el.classList.contains('ambient-paused')).length,
  };
});
paused.offscreen === 0 || paused.pausedOffscreen === paused.offscreen
  ? pass(
      paused.offscreen === 0
        ? 'no offscreen dark sections to pause at this scroll position'
        : `all ${paused.offscreen} offscreen dark sections are paused`
    )
  : fail(`${paused.offscreen - paused.pausedOffscreen} offscreen sections still animating`);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} FAILURE(S)`}\n`);
await browser.close();
process.exit(failures ? 1 : 0);
