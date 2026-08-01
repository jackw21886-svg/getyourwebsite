/**
 * Audits how every heading on the site wraps, at desktop and mobile.
 *
 *   node tools/wraps.mjs
 *
 * Swapping the heading face changes the width of every heading on the site, so
 * "does it still look right" is a question about forty headings, not the one
 * you happened to look at. This measures all of them.
 *
 * Two things get flagged:
 *
 *   lines   how many line boxes the heading actually occupies, counted from
 *           the rendered range rather than guessed from character counts
 *   widow   the last line as a fraction of the widest line. A very short last
 *           line is the classic awkward wrap — one orphaned word under a full
 *           measure. Headings use text-wrap: balance, so this should be rare;
 *           where it isn't, the type is too big for its container.
 *
 * Needs a dev server on :4321.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4321';
const PAGES = ['/', '/work', '/demo', '/pricing', '/benefits', '/why-us', '/contact'];

// A last line under this fraction of the widest line reads as an orphan.
const WIDOW_AT = 0.3;

const VIEWPORTS = [
  { tag: 'desktop', width: 1440, height: 900 },
  { tag: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const rows = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();

  for (const path of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    // The heading face has to be in use before anything is measured, or this
    // reports the fallback's metrics.
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({
      content: `[data-reveal] { opacity: 1 !important; transform: none !important; }`,
    });
    await page.waitForTimeout(700);

    const found = await page.evaluate(
      ([widowAt]) => {
        const out = [];
        const els = document.querySelectorAll('h1, h2, h3, .hero__title, .hero__closing');

        for (const el of els) {
          // Skip anything inside the demo sandbox — it deliberately runs its
          // own type system, copied from the client portal.
          if (el.closest('.sandbox')) continue;
          const box = el.getBoundingClientRect();
          if (box.height === 0 || box.width === 0) continue;

          // Line boxes, measured from the real rendered range.
          const range = document.createRange();
          range.selectNodeContents(el);
          const rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
          if (!rects.length) continue;

          // Client rects can split a single visual line at inline boundaries
          // (the hero title has a <span> in it), so group them by their top
          // edge rather than counting rects.
          const lines = new Map();
          for (const r of rects) {
            const key = Math.round(r.top / 4);
            const prev = lines.get(key);
            lines.set(key, {
              left: Math.min(prev?.left ?? Infinity, r.left),
              right: Math.max(prev?.right ?? -Infinity, r.right),
            });
          }
          const widths = [...lines.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([, v]) => v.right - v.left);

          const widest = Math.max(...widths);
          const lastRatio = widths[widths.length - 1] / widest;
          // The narrowest line anywhere, not just the last one. The hero title
          // has a hard <br> in it, so its orphan turns up in the MIDDLE —
          // "Websites that / are / out of this world." — and a last-line-only
          // test walks straight past it.
          const thinnest = Math.min(...widths) / widest;

          out.push({
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 46),
            lines: widths.length,
            lastRatio: +lastRatio.toFixed(2),
            thinnest: +thinnest.toFixed(2),
            widow: widths.length > 1 && Math.min(lastRatio, thinnest) < widowAt,
            fontPx: Math.round(parseFloat(getComputedStyle(el).fontSize)),
          });
        }
        return out;
      },
      [WIDOW_AT]
    );

    for (const f of found) rows.push({ ...f, path, vp: vp.tag });
  }

  await ctx.close();
}

await browser.close();

const widows = rows.filter((r) => r.widow);

console.log(`\n${rows.length} headings measured\n`);

for (const vp of VIEWPORTS) {
  const mine = rows.filter((r) => r.vp === vp.tag);
  const byLines = mine.reduce((acc, r) => ((acc[r.lines] = (acc[r.lines] ?? 0) + 1), acc), {});
  console.log(
    `${vp.tag.padEnd(8)} ` +
      Object.entries(byLines)
        .sort()
        .map(([n, c]) => `${c}x ${n}-line`)
        .join('  ')
  );
}

if (widows.length) {
  console.log(`\nAwkward wraps (last line under ${WIDOW_AT * 100}% of the widest):\n`);
  for (const w of widows) {
    console.log(
      `  ${w.vp.padEnd(8)} ${w.path.padEnd(10)} ${w.tag} ${String(w.fontPx).padStart(3)}px ` +
        `${w.lines} lines, thinnest ${(w.thinnest * 100).toFixed(0)}%  "${w.text}"`
    );
  }
} else {
  console.log('\nNo awkward wraps.');
}

// Everything running to three lines or more, at either width. Not a failure on
// its own — a long H1 on a narrow phone is allowed to be three lines — but it's
// the list to eyeball after a type change, because that's where a wider face
// shows up first.
const tall = rows.filter((r) => r.lines >= 3);
if (tall.length) {
  console.log('\nThree lines or more:\n');
  for (const t of tall.sort((a, b) => b.lines - a.lines)) {
    console.log(
      `  ${t.vp.padEnd(8)} ${t.path.padEnd(10)} ${t.tag} ${String(t.fontPx).padStart(3)}px ` +
        `${t.lines} lines  "${t.text}"`
    );
  }
}

// The headline sizes worth watching by hand, whatever the widow test says.
console.log('\nKey H1s at desktop:\n');
for (const r of rows.filter((x) => x.vp === 'desktop' && x.tag === 'h1')) {
  console.log(`  ${r.path.padEnd(10)} ${String(r.fontPx).padStart(3)}px  ${r.lines} lines  "${r.text}"`);
}
console.log();

process.exit(widows.length ? 1 : 0);
