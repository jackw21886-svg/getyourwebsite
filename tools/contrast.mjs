/**
 * Proves the ambient animation on dark sections never eats text contrast.
 *
 *   node tools/contrast.mjs
 *
 * The sheens and glints lighten the background as they drift, so "it looked
 * fine in a screenshot" isn't good enough — the peak could land anywhere in
 * the cycle. This script freezes every CSS animation at a series of phases,
 * hides the content so only the ambient layers are painted, and measures the
 * brightest pixel each dark section ever reaches. Then it checks the site's
 * dimmest body text (--silver) against that peak.
 *
 * Needs a dev server on :4321.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';

const BASE = process.env.BASE ?? 'http://localhost:4321';
const PAGES = ['/', '/pricing', '/demo', '/work', '/benefits', '/why-us', '/contact'];

// Seconds to seek the animations to. The longest ambient cycle is the 19s
// sheen drift (which alternates, so 38s round trip); these sample across it
// plus the 12–14s specular sweeps.
const PHASES = [0, 2.5, 5, 7.5, 10, 13, 16, 19, 24, 30];

// The dimmest text the site puts on a dark background.
const SILVER = [0xa9, 0xad, 0xb6];
const MIN_RATIO = 4.5;

const srgbToLin = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const luminance = ([r, g, b]) =>
  0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
const contrast = (a, b) => {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};

const SILVER_L = luminance(SILVER);

let failures = 0;
const fail = (m) => { console.log(`  ✗ ${m}`); failures++; };
const pass = (m) => console.log(`  ✓ ${m}`);

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await (await browser.newContext({
  viewport: { width: 1440, height: 900 },
})).newPage();

/**
 * Brightest *background* a glyph could sit on, in a crop.
 *
 * A small Gaussian blur first, which matters: the single brightest pixel in a
 * dark section is always a 1px star, and a speck behind a letterform doesn't
 * change whether you can read it. Blurring to roughly text-stroke width models
 * the background a glyph actually sits against — isolated specks wash out,
 * while a broad sheen survives untouched, which is the thing under test.
 */
async function peakLuminance(png, rect) {
  const img = sharp(png);
  const meta = await img.metadata();

  // Clamp to the image: a section's box can round a pixel past the bottom of
  // the capture, and sharp treats that as a hard error.
  const left = Math.min(Math.max(0, Math.round(rect.x)), meta.width - 1);
  const top = Math.min(Math.max(0, Math.round(rect.y)), meta.height - 1);
  const width = Math.max(1, Math.min(Math.round(rect.width), meta.width - left));
  const height = Math.max(1, Math.min(Math.round(rect.height), meta.height - top));

  const scan = async (pipeline) => {
    const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
    const step = info.channels * 7;
    let peak = 0;
    let peakPx = [0, 0, 0];
    for (let i = 0; i < data.length - info.channels; i += step) {
      const px = [data[i], data[i + 1], data[i + 2]];
      const l = luminance(px);
      if (l > peak) {
        peak = l;
        peakPx = px;
      }
    }
    return { peak, peakPx };
  };

  // Inset a few pixels: a section's box can land on a fractional row, so the
  // outermost row of the crop picks up the white section next door and reads
  // as a contrast failure that has nothing to do with the ambient layers.
  const EDGE = 3;
  const area = {
    left: left + EDGE,
    top: top + EDGE,
    width: Math.max(1, width - EDGE * 2),
    height: Math.max(1, height - EDGE * 2),
  };
  const blurred = await scan(sharp(png).extract(area).blur(6));
  const rawPeak = await scan(sharp(png).extract(area));
  return { ...blurred, rawPeak: rawPeak.peakPx };
}

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

console.log('\nAmbient contrast — dimmest body text (--silver) over the ambient peak\n');

for (const path of PAGES) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  // Reveal everything and strip the dev toolbar, then hide the content so only
  // the ambient layers paint. The section's own ::before/::after aren't
  // children, so they survive.
  await page.addStyleTag({
    content: `
      astro-dev-toolbar { display: none !important; }
      [data-reveal] { opacity: 1 !important; transform: none !important; }
      .section--dark > *, .foot > * { visibility: hidden !important; }
      /* The hero draws to a canvas, not these layers — out of scope here. */
      [data-hero] { display: none !important; }
    `,
  });

  const rects = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.section--dark, .foot').forEach((el, i) => {
      const r = el.getBoundingClientRect();
      if (r.height < 40) return;
      out.push({
        i,
        cls: el.className.split(' ').filter((c) => c.startsWith('has-') || c === 'foot').join(' ') || 'section--dark',
        y: r.top + window.scrollY,
        height: r.height,
      });
    });
    return out;
  });

  if (!rects.length) continue;

  let worst = { ratio: Infinity };

  for (const seconds of PHASES) {
    await freezeAt(page, seconds);
    await page.waitForTimeout(120);

    const png = await page.screenshot({ fullPage: true });

    for (const r of rects) {
      const { peak, peakPx, rawPeak } = await peakLuminance(png, {
        x: 0,
        y: r.y,
        width: 1440,
        height: r.height,
      });
      const ratio = contrast(SILVER_L, peak);
      if (ratio < worst.ratio) worst = { ratio, seconds, cls: r.cls, peakPx, rawPeak };
    }
  }

  const line =
    `${path.padEnd(10)} worst ${worst.ratio.toFixed(2)}:1  ` +
    `(${worst.cls} at ${worst.seconds}s, backdrop rgb(${worst.peakPx.join(',')}), ` +
    `brightest single px rgb(${worst.rawPeak.join(',')}))`;
  worst.ratio >= MIN_RATIO ? pass(line) : fail(line + `  — under ${MIN_RATIO}:1`);
}

// ── The hero's prompt bar ──────────────────────────────────────────────────
// The typed request is copy sitting on a piece of the scene, so it needs the
// same proof. Its backdrop isn't static: the bar's glass is semi-transparent
// and a gold sheen slides across it on its own clock, so the brightest moment
// can land anywhere. Sample the backdrop across a spread of sheen phases and
// check the dimmest thing the text ever has to sit on.
console.log('\nHero prompt bar — the typed request over its own backdrop\n');
{
  // rgba(255,255,255,0.92) over the bar, i.e. what drawPromptBar() paints.
  const TEXT = [235, 235, 235];
  const TEXT_L = luminance(TEXT);

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const readings = await page.evaluate(async ([settle, frames]) => {
    document.documentElement.style.scrollBehavior = 'auto';
    const hero = document.querySelector('[data-hero]');
    const canvas = document.querySelector('[data-hero-canvas]');
    const g = canvas.getContext('2d', { willReadFrequently: true });
    const dist = hero.getBoundingClientRect().height - window.innerHeight;

    // Park at the rest position: request fully typed, nothing else happening.
    window.scrollTo(0, dist * 0.38);
    await new Promise((r) => setTimeout(r, settle));

    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const small = window.matchMedia('(max-width: 820px)').matches;
    const scale = canvas.width / cw;
    const barW = Math.min(cw * (small ? 0.88 : 0.56), small ? 396 : 620);
    const barH = small ? 52 : 62;
    const cx = cw / 2;
    const cy = ch * (small ? 0.37 : 0.4);
    const px = (v) => Math.max(0, Math.round(v * scale));

    // A band inside the bar just under the text, so it's pure backdrop — the
    // glyphs themselves would otherwise be the brightest thing in the crop.
    const box = {
      x: px(cx - barW / 2 + 14),
      y: px(cy + barH * 0.2),
      w: px(barW * 0.72),
      h: px(barH * 0.22),
    };

    const out = [];
    for (let i = 0; i < frames; i++) {
      await new Promise((r) => setTimeout(r, 260));
      const d = g.getImageData(box.x, box.y, box.w, box.h).data;
      // Mean over a text-stroke-sized neighbourhood, same reasoning as the
      // blur above: one bright speck isn't what a letterform sits on.
      let best = -1;
      const rowLen = box.w * 4;
      for (let y = 0; y + 3 < box.h; y += 2) {
        for (let x = 0; x + 3 < box.w; x += 2) {
          let sr = 0;
          let sg = 0;
          let sb = 0;
          for (let dy = 0; dy < 4; dy++) {
            for (let dx = 0; dx < 4; dx++) {
              const i2 = (y + dy) * rowLen + (x + dx) * 4;
              sr += d[i2];
              sg += d[i2 + 1];
              sb += d[i2 + 2];
            }
          }
          const px2 = [sr / 16, sg / 16, sb / 16];
          const l = 0.2126 * px2[0] + 0.7152 * px2[1] + 0.0722 * px2[2];
          if (l > best) {
            best = l;
            out[i] = px2.map(Math.round);
          }
        }
      }
    }
    return out;
  }, [12000, 10]);

  let worst = { ratio: Infinity };
  for (const px of readings) {
    const ratio = contrast(TEXT_L, luminance(px));
    if (ratio < worst.ratio) worst = { ratio, px };
  }

  const line =
    `prompt bar  worst ${worst.ratio.toFixed(2)}:1 across ${readings.length} sheen phases ` +
    `(brightest backdrop rgb(${worst.px.join(',')}))`;
  worst.ratio >= MIN_RATIO ? pass(line) : fail(line + `  — under ${MIN_RATIO}:1`);
}

console.log(`\n${failures === 0 ? 'CONTRAST OK' : `${failures} FAILURE(S)`}\n`);
await browser.close();
process.exit(failures ? 1 : 0);
