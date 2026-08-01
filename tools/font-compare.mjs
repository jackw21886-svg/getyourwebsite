/**
 * Side-by-side comparison of heading-font candidates.
 *
 *   node tools/font-compare.mjs [outDir]
 *
 * Swaps `--font-display` (headings only — body and mono are untouched) and
 * shoots the same three views for each candidate, then composes one strip per
 * view so they can be compared at a glance rather than by flicking between
 * files.
 *
 * The swap is injected rather than committed, so the repo stays on its current
 * font while we decide. The @font-face rules here are the same ones in
 * global.css, so what you see is what you'd get.
 *
 * Needs a dev server on :4321.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? '.shots/fonts';
mkdirSync(out, { recursive: true });

const BASE = process.env.BASE ?? 'http://localhost:4321';
const PANEL_W = 720;

const CANDIDATES = [
  { id: 'outfit', label: 'Outfit (current)', css: '' },
  {
    id: 'clash',
    label: 'Clash Display',
    family: 'Clash Display',
    file: 'ClashDisplay-Variable.woff2',
    range: '200 700',
  },
  {
    id: 'cabinet',
    label: 'Cabinet Grotesk',
    family: 'Cabinet Grotesk',
    file: 'CabinetGrotesk-Variable.woff2',
    range: '100 800',
  },
  {
    id: 'sora',
    label: 'Sora',
    family: 'Sora',
    file: 'Sora-Variable.woff2',
    range: '400 800',
  },
];

const VIEWS = [
  { id: 'hero', path: '/', selector: null, settle: 2600 },
  { id: 'pricing', path: '/pricing', selector: null, settle: 900 },
  // A white section, to see the face on light as well as dark.
  { id: 'white', path: '/benefits', selector: '.section:not(.section--dark)', settle: 900 },
  // The headline on its own, near native size — this is where the character of
  // a face actually shows, and it's invisible in a downscaled page shot.
  { id: 'letterforms', path: '/', selector: '.hero__title', settle: 2600, width: 860 },
];

const faceCss = (c) =>
  c.file
    ? `@font-face {
         font-family: '${c.family}';
         src: url('/fonts/${c.file}') format('woff2');
         font-weight: ${c.range};
         font-display: swap;
       }
       :root { --font-display: '${c.family}', 'Outfit', system-ui, sans-serif; }`
    : '';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

/** name -> { viewId: Buffer } */
const shots = {};

for (const c of CANDIDATES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  shots[c.id] = {};

  for (const v of VIEWS) {
    await page.goto(`${BASE}${v.path}`, { waitUntil: 'networkidle' });
    await page.addStyleTag({
      content: `
        astro-dev-toolbar { display: none !important; }
        [data-reveal] { opacity: 1 !important; transform: none !important; }
        ${faceCss(c)}
      `,
    });
    // Wait for the face to actually be in use before shooting, otherwise the
    // first view of each candidate silently captures the fallback.
    if (c.family) {
      await page.evaluate((f) => document.fonts.load(`600 48px "${f}"`), c.family);
      await page.evaluate(() => document.fonts.ready);
    }
    await page.waitForTimeout(v.settle);

    const target = v.selector ? page.locator(v.selector).first() : page;
    shots[c.id][v.id] = await target.screenshot();
    console.log(`  shot ${c.id}/${v.id}`);
  }

  await ctx.close();
}

await browser.close();

// -- compose one strip per view ---------------------------------------------

const labelSvg = (text, w) =>
  Buffer.from(
    `<svg width="${w}" height="46" xmlns="http://www.w3.org/2000/svg">
       <rect width="${w}" height="46" fill="#111114"/>
       <text x="14" y="30" font-family="monospace" font-size="20" fill="#f5c24b">${text}</text>
     </svg>`
  );

for (const v of VIEWS) {
  const panels = [];
  let maxH = 0;

  const panelW = v.width ?? PANEL_W;

  for (const c of CANDIDATES) {
    const resized = await sharp(shots[c.id][v.id])
      .resize({ width: panelW, fit: 'inside' })
      .toBuffer();
    const meta = await sharp(resized).metadata();
    const labelled = await sharp({
      create: {
        width: panelW,
        height: meta.height + 46,
        channels: 3,
        background: '#111114',
      },
    })
      .composite([
        { input: labelSvg(c.label, panelW), top: 0, left: 0 },
        { input: resized, top: 46, left: 0 },
      ])
      .png()
      .toBuffer();
    const lm = await sharp(labelled).metadata();
    maxH = Math.max(maxH, lm.height);
    panels.push(labelled);
  }

  const strip = sharp({
    create: {
      width: panelW * panels.length,
      height: maxH,
      channels: 3,
      background: '#111114',
    },
  }).composite(panels.map((input, i) => ({ input, top: 0, left: i * panelW })));

  const file = `${out}/${v.id}.png`;
  await strip.png().toFile(file);
  console.log(`✓ ${file}`);
}
