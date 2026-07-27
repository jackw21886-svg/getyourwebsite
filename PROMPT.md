# GetYourWebsite — Claude Code Build Prompt

> **How to use this file (Jack):** open a terminal in your `getyourwebsite` repo folder, start Claude Code, and paste everything below the line. Search the file for `[EDIT]` afterward — those are the spots you'll fill in yourself (prices, email, names, photos).
>
> **Design skills are already installed** in this project at `.claude/skills/` (ui-ux-pro-max, design, ui-styling, design-system, brand, banner-design, slides) — Claude Code picks them up automatically when run in this folder. Optional: to get them in *every* project instead, run `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` then `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill`.

---

You are building the full marketing website for **GetYourWebsite** — a brand-new, from-scratch, multi-page site. It replaces the old `index.html`, and you must **not** build off the old site in any way. Read this whole brief before writing any code, then start with a short plan (stack choice + file structure) before scaffolding.

## Who we are (use this voice everywhere)

GetYourWebsite is run by high school students who build websites for local businesses. We do it to help the businesses in our community get online, to play a real role in our town, and to raise money for college. The brand personality: modern, techy, ambitious, and sincere — "out of this world" is our theme (space, orbit, above and beyond), but the writing should sound like sharp, confident students, never corporate and never gimmicky. Use space wordplay sparingly — a couple of well-placed lines, not every sentence.

## Where you're working

- You are in `~/Developer/getyourwebsite` — a clone of the existing repo (`jackw21886-svg/getyourwebsite`). It currently contains `index.html` (the old one-page site) and three finished mock client sites: `bakery.html` (Rosa's Bakery), `dental.html` (Bright Smile Dental), `gym.html` (Iron Forge Gym).
- **The old `index.html` is being fully replaced. Do not read it, reuse it, or take inspiration from its code, layout, styles, or copy — the new site is designed 100% from scratch.** Replacing it is expected and pre-approved.
- The three mock sites are the exception: keep them, and use them in the new site (Our Work cards, pricing examples, the demo's fake client).
- `.claude/skills/` and `PROMPT.md` are tooling and this brief — leave them out of the built/deployed site (exclude from the build output, keep in the repo).
- **Keep the three mock sites working at their current URLs.** If you pick a framework with a build step, copy them into the static/public directory unchanged so `/bakery.html`, `/dental.html`, and `/gym.html` still resolve.
- Beyond replacing `index.html`, do not delete existing files without asking. Commit in logical chunks with clear messages.

## Tech stack — your call, within these rules

Pick whatever stack you judge best for the requirements below (plain HTML/CSS/JS, Vite, Next.js, Astro — your choice). Hard constraints:

1. Free hosting must work: the site must deploy on GitHub Pages, Vercel, or Netlify at zero cost. Set up the deploy config (e.g. a GitHub Action for Pages or a `vercel.json`) and document the deploy steps in the README.
2. Two students maintain this. Keep the structure simple, commented, and explained in the README. No exotic tooling.
3. The scroll-driven hero animation (below) must run smoothly — pick the stack partly based on what makes that easiest to do well.
4. The contact form must actually deliver submissions on the chosen hosting (details in the Contact section).

## Design system

Colors — white, black, silver, and gold only:

- `--white: #FFFFFF` — light section backgrounds, text on dark.
- `--black: #0A0A0C` — dark/space section backgrounds, text on light.
- `--silver: #A9ADB6` and `--silver-light: #E6E7EB` — secondary text, borders, dividers, subtle UI.
- `--gold: #F5C24B` — the accent. CTAs, highlights, key numbers, star glints. Use it sparingly so it stays special.
- Contrast rule: meet WCAG AA everywhere. Gold text goes on black backgrounds only; on white, use gold for fills/borders with black text, or a darkened gold for large headings only.

Feel: modern and techy. Dark space-themed sections (black with subtle star fields) alternating with clean white content sections, silver for quiet detail, gold for the moments that matter. Generous spacing, big confident type, subtle scroll-reveal animations on content (fade/slide, nothing bouncy). Choose the typography fresh: pick a modern, techy heading/body pairing from the ui-ux-pro-max font database — nothing is carried over from the old site.

## Site structure

Pages: **Home** (`/`), **Our Work** (`/work`), **Demo** (`/demo`), **Pricing** (`/pricing`), **Benefits** (`/benefits`), **Why Us** (`/why-us` — "What makes us different"), **Contact** (`/contact` — inquiries / free mockup requests). Plus an on-theme 404 ("Lost in space").

Shared sticky nav on every page: logo/wordmark left; links to Our Work, Demo, Pricing, Benefits, Why Us; a gold **"Free Mockup"** button on the right linking to `/contact`. Transparent over the home hero, solid black once scrolled. Shared footer: wordmark, page links, contact email `[EDIT: your email]`, socials `[EDIT: links or remove]`, and the line "Built by students who'd love to build yours."

## Page 1 — Home

### The hero: scroll-driven Earth → Moon → deep space animation

This is the first thing every visitor sees and the signature of the site. It is **driven by scrolling** (scrubbed to scroll position — it does not autoplay):

- A pinned, full-viewport hero spanning roughly 300–400vh of scroll distance.
- **Stage 1 (0%):** close on Earth — a beautiful planet with an atmosphere glow against black. Headline fades in: "Websites that are out of this world." plus a one-line sub ("Custom sites for local businesses — built by students who go above and beyond."). A subtle "scroll" hint invites the first scroll.
- **Stage 2 (~35%):** scrolling pulls the camera back — Earth shrinks, the Moon slides into frame, and the camera sweeps around the Moon.
- **Stage 3 (~70–100%):** past the Moon into deep space — a star field, with the closing line "Above and beyond." and two CTAs: gold **"Request a free mockup"** → `/contact`, ghost **"See our work"** → `/work`. Then the hero unpins and the page continues into the sections below.

Implementation is your judgment call: Three.js textured spheres + particle starfield, a pre-rendered frame sequence scrubbed on canvas, or layered parallax — whatever you can make look premium. Requirements, not suggestions:

- Smooth on a mid-range laptop and a recent phone; no jank, no layout shift.
- `prefers-reduced-motion`: swap to a static space-scene hero with the headline and CTAs.
- Mobile gets a lighter version (fewer particles, smaller textures) if needed for frame rate.
- Lazy-load heavy assets; keep the hero payload lean. Use free, properly licensed imagery (NASA imagery is public domain — credit in the footer if required).

### Below the hero: one teaser section for every other main page

In this order, each with a link to its full page:

1. **Our Work** — cards for 3 featured mock sites → `/work`.
2. **Demo** — a framed screenshot of the revision sandbox + "Try the client demo" → `/demo`.
3. **Benefits** — the sharpest with/without-a-website contrast → `/benefits`.
4. **Pricing** — the three tier cards, condensed → `/pricing`.
5. **Why Us** — two sentences of our story + team photo placeholder `[EDIT]` → `/why-us`.
6. Final CTA banner — "Your business deserves a website that's above and beyond." → `/contact`.

## Page 2 — Our Work

Honest framing: these are concept builds. Header line like "Concept sites we've built — real client work coming soon." (We'll swap in real clients later, so make the card grid data-driven/easy to extend.)

- Feature the three existing mocks with live links: **Rosa's Bakery** (`/bakery.html`), **Bright Smile Dental** (`/dental.html`), **Iron Forge Gym** (`/gym.html`).
- **Build three new standalone mock sites** in the same self-contained single-file style and at the same or better quality: an **auto repair shop**, a **landscaping company**, and a **restaurant**. (A tech store mock may come later — the grid should make adding one trivial.) Invent believable local-business names. Each mock gets its own palette and personality (they should read as distinct client work, not as pages of our site).
- Each card: screenshot thumbnail (capture real screenshots of the pages), business type tag, one line on what the site shows off, and a "View live site" link opening in a new tab.

## Page 3 — Demo: the client revision experience

Goal: an **interactive, read-only sandbox** that recreates what it's like to be a GetYourWebsite client reviewing a mockup and requesting revisions — so prospects can feel the process before they ever fill out the form.

### Source of truth — our real client revision UI

- Repo: `https://github.com/GetYourWebsite-now/GetYourWebsiteAdmin` (**private** — my GitHub account has access)
- Branch: `production`
- App: the **`client/` directory** — the client-facing app where our clients view mockup versions and submit revision requests. This is the UI the demo must mirror.

### Getting the code

1. If a local clone already exists at `../GetYourWebsiteAdmin`, use it: `git -C ../GetYourWebsiteAdmin fetch && git -C ../GetYourWebsiteAdmin checkout production && git -C ../GetYourWebsiteAdmin pull`.
2. Otherwise clone it next to this repo: `git clone -b production https://github.com/GetYourWebsite-now/GetYourWebsiteAdmin.git ../GetYourWebsiteAdmin` (or `gh repo clone GetYourWebsite-now/GetYourWebsiteAdmin ../GetYourWebsiteAdmin -- -b production`).
3. If access fails, **stop and ask me** — do not invent the UI from imagination.

Heads-up: `~/Developer/gyw-internal-app` (next to this project) is our *internal ops app* (leads dialer, client list) — it is **not** the client revision UI. Don't use it as the reference for the demo; the revision UI lives only in the admin repo's `client/` directory above.

### What to read before building anything

- `client/README.md` (or `README` at the repo root) and any `docs/` directory — product flow, setup, naming.
- `client/package.json` — the framework and key libraries the real UI is built with.
- The revision flow itself: search `client/` source for routes/components matching `revision`, `feedback`, `comment`, `annotat`, `approve`, `version`, `mockup`, `request` and read them along with their styles. Write down the actual screens, states, statuses, and on-screen copy.
- The data shapes: any `types/`, `models/`, `api/`, or `lib/` code showing what a client project, mockup version, and revision request look like. The demo's fake data should mirror these shapes and status values exactly.

### What to build

A sandboxed lookalike embedded in the site (either inline on `/demo` or as a full-screen `/demo/sandbox` view with a slim "← Back to GetYourWebsite" bar):

- **Match the real UI's layout, components, flow, and terminology** closely enough that the demo is an honest preview of the real product. Reuse UI patterns and styles from `client/` freely — it's our own code.
- **No backend, no auth, no network calls.** All state lives in memory and resets on reload. Include a small "Reset demo" button.
- Seed it with a fake client project for **"Rosa's Bakery"** (ties into Our Work): 2–3 mockup versions, a few pre-existing revision requests across the real status lifecycle (e.g. requested → in progress → done — use the exact statuses from the code), and one approved version.
- Visitors can: browse mockup versions, submit a new revision request (with pinned/annotated comments if the real UI supports them), watch it appear in the request list, and approve a version. If a real feature depends on the backend (email notifications, etc.), fake the visible result (a toast like "We'll email you when it's updated") instead of dropping the step.
- Persistent banner: "Live demo with sample data — this is exactly what you get as a GetYourWebsite client." End with a gold CTA: "Want this for your business? Request a free mockup →" → `/contact`.
- **Never copy over `.env` files, API keys, service URLs, or real client data** from the admin repo — UI code, styles, and flow only.

## Page 4 — Pricing

Tiers with example pricing, connected to Our Work so the numbers feel concrete. Show for each tier: pages included, revision rounds, customizability, delivery time, and what it's like ("A site like Rosa's Bakery"). All prices are `[EDIT]` placeholders — use these until I change them:

- **Free Mockup** — $0: a homepage concept for your business, no commitment. (Give this its own highlighted strip above the paid tiers.)
- **Launch** — `[EDIT: e.g. $150]`: up to 3 pages, 2 revision rounds, clean template-based design customized to the brand, contact form, mobile-friendly. "A site like Rosa's Bakery."
- **Orbit** — `[EDIT: e.g. $350]`: up to 6 pages, 4 revision rounds, fully custom design, extra sections (menus, galleries, booking links), basic SEO setup. "A site like Bright Smile Dental." Mark this one "Most popular."
- **Deep Space** — `[EDIT: e.g. $600+]`: 8+ pages, 6 revision rounds, fully custom design with animations and advanced features, priority turnaround. "A site like Iron Forge Gym — and beyond."

Required disclaimer near the tiers: **"Example pricing. Every business is different — send an inquiry and we'll reply with a personal quote after we review it."** Below the tiers, a short FAQ (how long it takes, what we need from the business, how revisions work, how the free mockup works).

## Page 5 — Benefits

The case for having a website at all — the contrast between a business with one and without one:

- A bold split/comparison visual: "Without a website" (invisible on Google, open 9–5 only, relies on word of mouth, looks less established) vs "With a website" (found by people searching right now, open 24/7, builds trust instantly, takes inquiries while you sleep).
- Sections on the three outcomes from our positioning: **more revenue**, **more new clients**, **a more streamlined experience** (info, hours, menus, and booking handled online instead of by phone).
- Keep claims qualitative and credible by default. Only include a specific statistic if you can cite a real, current source next to it; otherwise leave a `[EDIT: stat + source]` placeholder rather than inventing numbers.
- End with the free-mockup CTA: "See what your business would look like online — it costs nothing."

## Page 6 — Why Us ("What makes us different")

Our story, told sincerely:

- We're high school students `[EDIT: names, school/town if we want them public]` who build real websites.
- Why we do it: local businesses deserve to be online, we want to play a real role in our community, and we're raising money for college. Say the college part plainly — it's honest and people root for it.
- What that means for clients: personal attention, fast communication, fair prices, and we treat every site like our reputation depends on it (it does).
- Placeholder for a team photo `[EDIT]` and a short "how we work" strip (inquiry → free mockup → revisions together in our client portal → launch) that quietly links back to `/demo`.

## Page 7 — Contact / Request a Free Mockup

An inquiry form for either a **free mockup** or a **full website**:

- Fields: name, business name, business type, email, phone (optional), what they want (radio: Free mockup / Full website / Not sure yet), current website URL if any (optional), anything specific they need (textarea), how they heard about us (optional).
- Copy near the form: "We read every inquiry and reply personally. Pricing is confirmed after we review your request — the mockup is always free."
- The form must actually deliver on the chosen hosting: use a free form service (e.g. Formspree or Web3Forms) for static hosting, or an API route + email if you chose a stack with a server. Wire it to `[EDIT: your email]`, include a honeypot spam field, and build real success/error states. Also show the email address as a plain fallback.

## Global requirements (every page)

- Fully responsive, mobile-first. Check 360px, 768px, and 1280px widths.
- Accessibility: semantic HTML landmarks, keyboard navigable, visible focus states, alt text everywhere, WCAG AA contrast, `prefers-reduced-motion` respected globally.
- Performance: optimized images (WebP, lazy-loaded below the fold), deferred scripts, no layout shift. Target Lighthouse ≥ 90 across categories (the home hero may cost some performance — keep every other page fast).
- SEO: unique title + meta description per page, Open Graph/social card image on brand, favicon (simple planet/orbit mark in gold on black), `sitemap.xml`, `robots.txt`.
- Scroll-reveal animations on section content site-wide: subtle, consistent, disabled under reduced motion.

## Design quality — use your design skills

- This project ships with design skills in `.claude/skills/`: **ui-ux-pro-max** (searchable databases of UI styles, palettes, font pairings, UX rules, per-stack guidelines, with a search script) plus design, ui-styling, design-system, brand, banner-design, and slides. Use ui-ux-pro-max **before designing anything**: read its SKILL.md and run its design-system search, e.g. `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "web agency tech modern premium" --design-system -p "GetYourWebsite"`, then apply its style, typography, and spacing recommendations *within* our white/black/silver/gold palette. Do the same per mock site (auto repair, landscaping, restaurant each get their own fitting style and palette from a fresh search).
- Iterate visually, never blind: after building each page, render it, screenshot it at desktop and mobile widths, look at the screenshot, and critique it like a designer (hierarchy, spacing rhythm, contrast, alignment, how the fold looks). Refine and re-screenshot until it looks like a top-tier agency site, not a first draft. If you have a browser/Playwright tool available, use it for this loop.
- Details that separate pro from amateur: consistent spacing scale, real visual hierarchy (one clear focal point per screen), restrained gold usage, generous whitespace, polished hover/focus states, and no default-looking buttons or unstyled edges.

## How to work, and how to verify before you're done

1. Present a brief plan first: chosen stack, why, file structure, deploy target. Then scaffold.
2. Build order: shared layout/nav/footer → Home (animation can be iterated last) → Our Work + the three new mock sites → Demo sandbox (after studying the admin repo) → Pricing → Benefits → Why Us → Contact → 404 → polish pass.
3. Verification pass (required): run the site locally; screenshot every page at mobile and desktop widths and actually review the screenshots; scrub the hero animation start/middle/end; click every nav, footer, card, and CTA link; run the demo sandbox flow end to end (browse versions → submit request → approve → reset); submit the contact form and confirm delivery; check the reduced-motion fallback; run Lighthouse if available. Fix what you find before calling it done.
4. Update the README: what the site is, how to run it locally, how to deploy, and a list of every `[EDIT]` placeholder left for me.
5. Ask before adding any paid service, deleting existing files, or if the admin repo is unreachable.

## Placeholders I'll fill in myself (leave them marked `[EDIT]`)

Final tier prices · contact email (form destination + footer) · phone/socials · our names and team photo · any real stats with sources on Benefits · custom domain when we buy one.

