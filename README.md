# GetYourWebsite

The marketing site for GetYourWebsite — websites for local businesses, built by
high school students.

Seven pages (Home, Our Work, Demo, Pricing, Benefits, Why Us, Contact) plus a
404, a scroll-driven hero where a website assembles itself and launches, six
live mock client sites, and an interactive demo of our real client portal.

---

## Running it locally

You need [Node.js](https://nodejs.org) 20 or newer. Then:

```bash
npm install
```

```bash
npm run dev
```

That starts a dev server at <http://localhost:4321> and reloads when you save.

Two other commands:

```bash
npm run build
```

Builds the finished site into `dist/`. This is what gets deployed.

```bash
npm run preview
```

Serves `dist/` so you can check the built site before you push.

---

## How the project is laid out

```
src/
  pages/           one file per URL — index.astro is "/", work.astro is "/work"
  layouts/
    BaseLayout.astro   the <head>, nav and footer every page shares
  components/      reusable pieces (Nav, Footer, ProjectCard, TierCard, Hero…)
  data/
    site.js        ← almost everything you'll want to change lives here
    url.js         link helper (see "Deploying" below)
  styles/
    global.css     the whole design system: colours, type, spacing, components
  scripts/
    hero.js        the build-and-launch hero, drawn on a 2D canvas
    buttons.js     the button press interaction
    reveal.js      the scroll-reveal animation
    ambient.js     starts the dark sections' ambient drift, pauses it off screen
    demo.js        the demo sandbox

tools/             checks and screenshot harnesses — see "Verifying changes"

public/            copied to the site as-is, no build step
  bakery.html      the six mock client sites
  dental.html
  gym.html
  auto.html
  landscaping.html
  restaurant.html
  shots/           screenshots used on the Our Work cards
  og.png           the social sharing card
  favicon.svg
```

`.claude/` and `PROMPT.md` are tooling and the original brief. They stay in the
repo and are never copied into the built site.

### The things you'll actually edit

**`src/data/site.js`** holds the contact email, the form key, the nav links, the
Our Work grid and the pricing tiers. Changing a price there updates both the
pricing page and the home page teaser.

**Adding a seventh mock site** (a tech store, say) is three steps:

1. Put the HTML at `public/techstore.html`.
2. Save a screenshot to `public/shots/techstore.webp`.
3. Add one object to the `PROJECTS` array in `src/data/site.js`.

The grid picks it up automatically.

---

## Design system

Four colours and nothing else — white, black, silver and gold. They're defined
at the top of `src/styles/global.css` along with a couple of derived colours
that exist purely for contrast:

| Token | Use |
| --- | --- |
| `--white` `--black` | backgrounds and text |
| `--silver` `--silver-light` | secondary text and borders on dark |
| `--gold` | the accent — CTAs and highlights only, kept rare on purpose |
| `--ink-soft` | muted text on white (silver fails contrast there) |
| `--gold-deep` | gold that's legible on white |

Every pairing meets WCAG AA. **Never put plain `--gold` text on white** — use
`--gold-deep`.

Type is Clash Display for headings, Work Sans for body and JetBrains Mono for
labels and figures. The heading face is self-hosted from `public/fonts/`; the
other two come from Google Fonts.

`HEADING_FONT` in `src/data/site.js` is the switch — `clash`, `cabinet`, `sora`
or `outfit`. BaseLayout preloads the right file and points `--font-display` at
it. Each face can also carry its own `track`, which overrides `--h-track`: a
wider face has to be set tighter to hold the same line counts, and that belongs
to the face rather than to the layout.

Two tokens travel with the face: `--h-track` and `--h-word`. They are a pair
and have to be tuned together — opening the word gaps widens every line, so the
letters have to go tighter to pay for it. Clash Display runs at -0.055em with
0.08em of word spacing.

**If you change the heading font, run `npm run verify:wraps`.** Swapping the
face changes the width of every heading on the site, so "does it still look
right" is a question about forty headings, not the one you happened to look at.
It counts the line boxes for each and flags orphans — a line much shorter than
the rest, anywhere in the heading — at desktop and mobile. Clash Display needed
four adjustments to match Outfit's line counts, all recorded in the CSS next to
the values: `--h-track` to -0.055em, `--t-h3` down from 1.6rem, the final CTA
heading down from 3.4rem, and `--t-display`'s mobile end down so "Websites that
are" stops breaking across two lines and orphaning "are".

Sections alternate: `.section` for white, `.section--dark` for black. Add
`.has-stars` for the star texture and `.has-glow` for the gold halo.

### Dark-section atmosphere

Every dark section drifts, very slightly, in the same visual language as the
hero — so the site reads as one thing rather than a space hero bolted onto a
normal website. It's all in `global.css` §6, all CSS, and there are four layers:

| Layer | What it is | Cycle |
| --- | --- | --- |
| the section's own `background-image` | four stars that never move | — |
| `::before` | five more stars, breathing | 13s |
| `::after` | a gold and a silver lobe drifting across the section | 19s |
| `.card::after` / `.tier__sheen::before` | a narrow gold band crossing a card, like a reflection travelling over metal | 14s |
| gold `.btn--gold::after` on dark | a white glint | 12s |

Three knobs control the whole thing, at the top of §6: `--sheen-gold`,
`--sheen-silver` and `--spec-a`. Turn those down and everything gets subtler
together. `.has-glow` sections raise `--sheen-gold` on their own.

Four rules if you touch any of it:

1. **White sections stay clean.** Nothing here applies to `.section`.
2. **Text must stay readable.** The sheens lighten the background, so contrast
   is a real constraint, not a formality. `npm run verify:contrast` freezes the
   animations at ten points in the cycle, hides all the content, and measures
   the brightest backdrop each dark band ever reaches against `--silver`. It
   currently passes at about 7.8:1 against a 4.5:1 requirement — that's the
   headroom you'd be spending.
3. **Background level only.** Every layer sits at `z-index: -1` behind the
   content, which is why the sections and cards need `isolation: isolate`.
   `.tier` can't take `overflow: hidden` (the "Most popular" flag hangs over
   its top edge), so the pricing card uses a `.tier__sheen` span to clip instead.
4. **Motion is opt-in.** `src/scripts/ambient.js` adds `ambient-live` to
   `<html>` after load, and only then does anything animate; it also pauses
   sections while they're off screen. With JS off, or under
   `prefers-reduced-motion`, you get the same gradients holding still — which is
   a design state we checked, not a fallback.

### Buttons

There is one button system, defined once in `global.css`. Use it — don't style
a button inline, or the site drifts.

| Class | Use |
| --- | --- |
| `.btn .btn--gold` | primary. One per screen; it's the thing we want clicked. |
| `.btn .btn--ghost` | secondary, on a dark background |
| `.btn .btn--outline` | secondary, on a light background |
| `.link-arrow` | tertiary — a text link with a gold arrow |

Sizes are `.btn--sm`, nothing (medium), and `.btn--lg`.

The hover and press effects are space-themed: a dark "event horizon" ring
tightens inward on hover, a lensing sweep crosses the secondary buttons, and
pressing collapses a ring inward instead of the usual outward ripple. All of it
is decoration — `src/scripts/buttons.js` never touches the click, and none of
it runs under reduced motion, where the colour and focus changes carry the
feedback on their own.

### The hero

The animation is the pitch, in five stages: fragments of a website drift in
space, you ask for what you want, the pieces assemble into a mockup, it
launches, and the CTAs land on clean black. `src/scripts/hero.js` draws it on a
2D canvas — no 3D library, no textures, no images.

| Stage | What happens | Copy |
| --- | --- | --- |
| `open` | fragments drift in a ring around the headline | Websites that are out of this world. |
| `prompt` | a bar rises, a request types itself in, the send button presses, the bar lifts off | You tell us what you want. |
| `build` | the pieces come back down and assemble | We design it. We build it. |
| `launch` | the mockup flies up out of frame | Then we launch it. |
| `close` | empty frame, CTAs on clean black | Above and beyond. |

Things to edit:

- **`LAYOUT`** — the assembled site. Each entry is one piece, positioned in
  normalised coordinates (`-0.5` to `0.5` across the mockup) so it scales with
  the viewport. `g` is the assembly group: lower numbers fly in first, which
  is what makes the build legible.
- **`BEATS_VH`** — the scroll windows for the five lines of copy.
- **`REQUEST`** — the sentence that types into the prompt bar. Keep it short
  (it has to fit the bar at 390px wide) and keep it tied to a real client — it
  names Rosa's Bakery, whose site is the one that assembles immediately after.

**The prompt stage** has its own windows: `BAR_IN_VH`, `TYPE_VH`, `PRESS_VH`,
`LIFT_VH`. The gap between `TYPE_VH` ending and `PRESS_VH` starting is the
important one — the typed request is copy, so it has to be finished and then
sit still long enough to read before the send fires, and that gap is what
guarantees it. The pieces are deliberately stowed above the frame while the bar
is up and come back down through the point it exits, so the build reads as an
answer to the request rather than something that was always going to happen.

Two rules the scene must never break, both from design review:

1. **Nothing sits behind or crosses the copy.** The opening beat scatters
   fragments into a ring *around* the headline, the middle beats put the copy
   at the bottom with the mockup above it, and by the finale everything has
   physically left the frame. The `clearOfCopy()` helper enforces the first of
   those by measuring the real headline box and pushing any overlapping piece
   outward, and there's an automated test for all three (see "Verifying").
2. **No stretch of the scroll is visually empty.** There is always the mockup,
   the debris field, or both, in motion.

On desktop the scene also drifts gently with the mouse, so it feels alive
before you scroll.

**Pacing.** Scroll-linked opacity on its own can't keep copy readable — flick
through the hero and every line is gone before you've read it, however wide
the windows are. So the timeline has a speed limit: `MIN_PLAY_S` in
`hero.js` is the fewest seconds the whole sequence can take. Scroll slower
than that and it's a pure scrub, frame for frame; scroll faster and it plays
at that pace rather than skipping. The hold windows are sized against it, so
every beat gets at least ~0.9s of full-opacity reading time even for someone
who flicks the entire hero in one go.

`MIN_PLAY_S` scales with the sequence, and this is the easiest thing to get
wrong. It's 6.9s for 450vh of scroll. Add a stage without raising it in
proportion and you haven't added anything — you've just sped every existing
beat up to pay for the new one.

If you retime the beats, re-run the pacing check (below) — the two are a
matched pair, and widening a hold without checking the limit is how copy
starts flashing past again.

---

## Analytics

Off by default. Set `GOATCOUNTER_ID` in `src/data/site.js` to your GoatCounter
site code and the tag appears; leave it empty and no script is emitted at all,
which is why an unset placeholder costs nothing.

GoatCounter rather than Plausible or Google Analytics: no cookies, so no consent
banner, nothing personal stored, and roughly 3KB. The tag is `defer`red, so it
can't block a paint or add to Total Blocking Time.

---

## Deploying

The site is static, so all three free hosts work. Two environment variables
control the build:

- **`SITE_URL`** — the public address. Used for `sitemap.xml`, `robots.txt` and
  the social card. Change this when you buy a domain.
- **`BASE_PATH`** — the sub-folder the site is served from. Defaults to `/`.

### GitHub Pages (already set up)

`.github/workflows/deploy.yml` builds and publishes on every push to `main`.

**One-time setup:** go to **Settings → Pages → Build and deployment** and set
**Source** to **GitHub Actions**. That's the only click.

The site then lives at <https://jackw21886-svg.github.io/getyourwebsite/>.

Because Pages serves project sites from a sub-folder, the workflow sets
`BASE_PATH=/getyourwebsite`. That's also why internal links are written as
`url('/pricing')` rather than `"/pricing"` — the helper in `src/data/url.js`
adds the prefix. **If you add a link, wrap it in `url()`** or it will 404 on
Pages.

### Netlify

Connect the repo at [app.netlify.com](https://app.netlify.com). `netlify.toml`
already has the build command and publish directory. Update `SITE_URL` in that
file to your Netlify address.

### Vercel

Import the repo at [vercel.com](https://vercel.com). `vercel.json` handles the
rest. Set `SITE_URL` in the project's environment variables.

### When you buy a domain

1. Change `SITE_URL` to the new domain (in the workflow, or in
   `netlify.toml` / Vercel's settings).
2. Set `BASE_PATH` to `/` — on Pages that means deleting the `BASE_PATH` line
   from the workflow.
3. On Pages, add the domain under **Settings → Pages → Custom domain**.

---

## The contact form

The form on `/contact` posts to [Web3Forms](https://web3forms.com), which is
free and needs no server.

**To switch it on:** get an access key (paste your email at web3forms.com, they
send you one), then put it in `WEB3FORMS_KEY` in `src/data/site.js`.

Until you do, the page shows a visible warning to you and the form fails with a
clear message pointing visitors at the email address instead — nothing
disappears silently.

The form has a honeypot field for spam, validates in the browser, and works
without JavaScript (Web3Forms just shows its own thank-you page instead of the
inline one).

---

## Verifying changes

Before pushing anything significant:

```bash
npm run build
```

Then check the pages at three widths — 360px, 768px and 1280px — and click
through the nav, the Our Work cards and the demo sandbox.

### The automated checks

Most of the things that have broken on this site broke invisibly, so they're
tests now rather than things to remember. They live in `tools/` and each one
needs `npm run dev` running in another terminal.

```bash
npm run verify           # 36 checks: links, the demo flow, hero copy clearance,
                         # reduced motion, the contact form, buttons, ambient layers
npm run verify:pacing    # flick-scroll the hero in 3s; every line readable ≥0.8s,
                         # and the request finishes typing and rests before it sends
npm run verify:contrast  # text contrast under the moving ambient gradients, and
                         # the typed request over the prompt bar's own backdrop
npm run verify:wraps     # how every heading wraps at desktop and mobile
npm run verify:voids     # scroll-reveal never leaves a fast scroller a blank screen
npm run shots:ambient    # screenshots of the dark sections, hover and reduced motion
npm run shots:teaser     # regenerate the home page's portal image from the sandbox
```

`tools/shots.mjs` is a general screenshot harness if you want to eyeball
something: `node tools/shots.mjs .shots "pricing=/pricing" "hero70=/@0.7"`, where
`@0.7` scrubs the hero to 70% of its scroll.

One thing to know before you trust a failure: headless Chrome renders this site
at roughly 6fps, and `hero.js` deliberately clamps each frame's time step, so the
hero's timeline advances at about 0.6× wall time in these tests. That's why the
settle waits look absurdly long (12 seconds). Shorten them and the hero tests
start failing on half-finished frames that look exactly like real bugs.

### And by hand

For the hero there are two things worth checking yourself, because they're about
feel: flick-scroll the whole hero in a couple of seconds and confirm you can
actually read all four lines, and scroll it slowly to confirm it still tracks
your finger rather than playing on its own. If you changed the hero, scroll it
slowly from top to bottom and watch for stutter, then turn on "Reduce motion" in
**System Settings → Accessibility → Display** and reload to confirm the static
fallback still shows the headline and both buttons.

Lighthouse: run it against `npm run preview`, not the dev server. Expect 100 on
accessibility, best practices and SEO, and 0ms Total Blocking Time, everywhere.
Performance is 100 on most pages but bounces between about 95 and 100 on `/demo`
and `/benefits` depending on which image wins the Largest Contentful Paint race —
that's measurement noise, so don't chase a three-point drop on one run.

---

## `[EDIT]` placeholders — the list of things left for you

Search the project for `[EDIT]` to find them all. In priority order:

| # | What | Where |
| --- | --- | --- |
| 1 | **Your email address** — the form destination and the footer address | `CONTACT_EMAIL` in `src/data/site.js` |
| 2 | **Web3Forms access key** — until this is set the contact form cannot send | `WEB3FORMS_KEY` in `src/data/site.js` |
| 3 | **Final tier prices** — currently $150 / $350 / $600+ | `TIERS` in `src/data/site.js` |
| 4 | **Social links** — add them or leave the array empty to hide the row | `SOCIALS` in `src/data/site.js` |
| 5 | **Your names, school and town** | `src/pages/why-us.astro`, in the `.story__names` block |
| 6 | **Team photo** — drop it at `public/team.webp`, then swap the placeholder for an `<img>` | `src/pages/why-us.astro` and `src/pages/index.astro` |
| 7 | **A real statistic with a source**, if you want one on Benefits | `src/pages/benefits.astro`, the `.stat-slot` block |
| 8 | **Custom domain** when you buy one | see "Deploying" above |
| 9 | **GoatCounter site code**, if you want visitor stats | `GOATCOUNTER_ID` in `src/data/site.js` |

---

## Notes and known limitations

- **The mock sites use placeholder photos** from `loremflickr.com`, which serves
  a random image per keyword. They occasionally return something odd. When you
  have real client photos, host them in `public/` and swap the `src` attributes.
- **The demo sandbox mirrors our client app** (`GetYourWebsiteAdmin`,
  `development` branch, the **`client/`** workspace — not `frontend/`, which is
  the staff admin app). After changing the sandbox, run `npm run shots:teaser`:
  the home page shows a picture of it (`public/shots/demo.webp`) and that
  picture is not generated by the build, so it can silently go stale — it did
  exactly that when the portal moved from mint to gold. `npm run verify`
  checks the asset's accent hue and fails if it's from the old design.
  If that app's screens change, update
  `src/components/DemoSandbox.astro` and `src/scripts/demo.js` to match — the
  whole value of that page is that it's honest.
- **There is no approve button in the demo** because there isn't one in the real
  client portal. Approval happens on our side and versions only appear once
  they're approved. `/demo` says so explicitly.
- **Anyone with reduced motion turned on** gets a still version of the same
  idea: the headline, both CTAs and a CSS drawing of the assembled site, all
  in flow so nothing overlaps. It's in the markup already, so it also covers
  no-JS and any browser without canvas.
