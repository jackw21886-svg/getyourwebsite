# Design feedback — round 1 (from Jack & partner, plus a live review of the current build)

Make the changes below. Keep the white/black/silver/gold palette everywhere — the color scheme is staying. After each change, screenshot desktop + mobile widths, review like a designer, and iterate until it looks premium. Use the ui-ux-pro-max skill's style/motion databases where helpful. Respect `prefers-reduced-motion` throughout.

## Context: what a live review of the current build found

- Hero Stage 1 (Earth + headline) reads well. **Stage 2 is the weak point**: Earth hugs the left edge with a heavy **blue** rim glow (off-palette) and a tiny distant Moon in an otherwise near-empty black frame — it feels unfinished mid-scroll.
- Buttons are flat, fully-rounded gold pills; hover only brightens them slightly. Ghost buttons are thin outline pills. Nothing broken — just generic, no craft, no motion.
- The rest (section rhythm, typography, pricing cards, footer) reads clean — don't regress it while making these changes.

## 1. Replace the hero animation — no more Earth and Moon

Remove the literal Earth → Moon → deep-space scene entirely. Replace it with a **realistic-feeling, techy** scroll-driven animation: same mechanics (pinned full-viewport hero, scrubbed by scroll progress, ~3 stages ending in the headline + CTAs), same palette (black space, silver/white stars and structure, gold accents), no photoreal planets.

Below are three fully-specced concepts. **You decide which to build**: assess all three against what you can render flawlessly; if you're not certain, prototype the top two, screenshot each at 0% / 35% / 70% / 100% scroll, compare side by side, keep the best-executed one, and delete the loser's code. Jack leans toward A because it unifies with the button interactions — treat that as the tiebreaker, not a mandate. Whatever you pick must look premium at EVERY scroll position.

### Concept A — The black hole approach (Interstellar-style, gold on black)

- **Stage 1 (0%):** wide shot — deep parallax starfield, and in the distance a thin, tilted, blazing **gold accretion ring** around a dark mass. Headline + sub fade in; scroll hint.
- **Stage 2 (~35–70%):** scrolling flies the camera in. The disk grows and brightens asymmetrically (doppler-style: the approaching side hotter/brighter), and **gravitational lensing** visibly warps and smears the starfield around the event horizon — space bends as you get close.
- **Stage 3 (→100%):** slingshot past — the lensing releases, stars settle into a calm clean field, "Above and beyond." + CTAs land.
- **Why it fits:** real physics (lensing is a classic fragment-shader effect — cheap, fast, no textures), palette-perfect (gold disk, black hole, silver stars), and the hero + event-horizon button hovers + inward-collapse press ripples become one unified idea.
- **Implementation hints:** full-screen fragment shader for lensing + disk; GSAP ScrollTrigger scrubbing camera-distance/angle uniforms; 2–3 parallax particle star layers.

### Concept B — The night ascent (the brand story, literal "above and beyond")

- **Stage 1 (0%):** looking down at a town at night rendered as a dark wireframe/point-grid landscape with warm **gold dots of light** — the local businesses. Headline over it.
- **Stage 2 (~35–70%):** scroll lifts the camera straight up — the gold lights recede into a constellation-like web, thin silver haze layers (atmosphere) sweep past, stars fade in above.
- **Stage 3 (→100%):** floating in space, looking back at the small glowing gold web far below; "Above and beyond." + CTAs.
- **Why it fits:** the most literal telling of "we take local businesses above and beyond"; quieter and elegant.
- **Implementation hints:** layered planes + particles; ground as a glowing point grid (no photo textures); haze via gradient layers; parallax on ascent.

### Concept C — The warp (cinematic speed)

- **Stage 1 (0%):** calm deep starfield with subtle drift; headline.
- **Stage 2 (~35–70%):** scroll accelerates you — stars stretch into long **silver motion-blur streaks** converging toward a faint gold core glow; stretch amount maps directly to scroll progress so the visitor feels like they control the throttle.
- **Stage 3 (→100%):** deceleration snap — streaks collapse back into points, everything calms; "Above and beyond." + CTAs.
- **Why it fits:** pure speed, easiest of the three to make flawlessly smooth.
- **Implementation hints:** particle system with velocity-stretched line primitives; bloom on the gold core; ease the acceleration curve so it feels physical.

**Required craft for whichever concept wins** — this is what makes it "realistic" instead of screensaver: layered parallax star depth (near stars move more than far), bloom on all gold light sources, scroll inertia/damping so the camera has weight, a subtle film-grain overlay, and zero off-palette color.

Two hard rules learned from the current build: **every scroll position must have visual interest** — no near-empty frames like the current Stage 2 — and **strictly palette colors only** (no blue glows or off-palette atmosphere effects; stars are white/silver, accents gold).

Keep the headline beats from the brief ("Websites that are out of this world" → "Above and beyond." → CTAs), adjusting any line that no longer matches the visuals. Performance rules still apply: smooth on a mid laptop and a recent phone, lighter mobile variant if needed, static styled fallback under reduced motion. Delete any now-unused Earth/Moon textures or assets from the project once replaced.

## 2. Make the buttons genuinely nice

Right now every button is a flat, fully-rounded gold pill (or thin-outline ghost) whose hover just brightens it. Redesign the system — primary (gold CTA), secondary/ghost, and the nav "Free Mockup" — so nothing looks default: reconsider the fully-round radius, add craft to the primary fill (subtle gradient or inner highlight so it has depth instead of flat color), consistent sizing and padding, crisp type, clear hierarchy between primary and secondary, and complete states (hover, active/pressed, focus-visible ring, disabled). Define the button system once (shared component/utility classes) and reuse it site-wide so every button matches. Give the "View live site →" / "What makes us different →" text links a matching hover (arrow slides right, color shifts to gold) so all interactive elements feel like one family.

## 3. Button animations — black hole / space themed

Give the buttons micro-interactions inspired by black holes and space. Tasteful and quick (~150–300ms, ease-out) — motion must never delay or block the click:

- **Primary (gold):** on hover, a subtle *gravitational pull* — a soft glow or tiny particles drawn inward toward the button, or a thin gold "event-horizon" ring that tightens around the border. On press, an **inward-collapsing** ripple (matter falling past the horizon) instead of the usual outward ripple.
- **Secondary/ghost:** on hover, a faint starfield shimmer or lensing sweep across the surface; border brightens silver → gold.
- Nav "Free Mockup" gets the primary treatment, scaled down.
- Under `prefers-reduced-motion`, drop the decorative motion but keep obvious hover/focus feedback (color/ring changes are fine).

## 4. Verify before done

Re-screenshot every page (desktop + mobile), scrub the new hero at start/middle/end, tab through the buttons to check focus states, and confirm the reduced-motion fallback still looks intentional.
