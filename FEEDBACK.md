# Design feedback — round 2: replace the black hole hero

The buttons from round 1 came out well — keep them exactly as they are. This round is about the hero animation, which is getting replaced again. Read the findings, then the three concepts. **You choose which to build** (decision protocol at the end). Palette stays strict: black, white, silver, gold. `prefers-reduced-motion` gets a static styled fallback as always.

## Findings from a live review of the current black hole hero

1. **CRITICAL BUG regardless of concept:** at the final stage, the headline "Above and beyond." and both CTA buttons render **behind** the black hole — the text and gold button are occluded by the disk and ring glow. Text and CTAs must ALWAYS sit on clear background, above every scene element, with the scene composed so nothing crosses them.
2. The black hole reads as a **glowing gold donut / Saturn**, not a black hole: no gravitational lensing (background stars don't warp around it), no doppler brightening on one side, no matter falling in. The physics that makes a black hole impressive is absent.
3. The middle ~half of the scroll is **one object slowly enlarging in empty space** — no text on screen, nothing else moving, nothing to look at. That's the boredom.
4. The concept is **decoration, not communication** — it says nothing about building websites. That's why it feels unnecessary.
5. The unpin into Our Work crops the object mid-frame — the handoff is abrupt.

## Universal rules for the replacement (apply to whichever concept wins)

- A short line of copy is on screen at **every** stage of the scroll (write beat-by-beat lines that match the visuals), and the finale ("Above and beyond." + CTAs) lands on **clear black — nothing behind or crossing the text, ever**.
- Every scroll position is visually alive: multiple elements in motion, layered parallax starfield (near stars move more than far), bloom on gold light sources, scroll inertia so the camera has weight, subtle film grain.
- Add gentle mouse-move parallax on desktop so the scene feels alive even without scrolling.
- Design the unpin: the scene should resolve/clear (fade, recede, or fly off) before the page continues into Our Work.
- Delete the old black hole code and assets once replaced.

## Concept A — The Build & Launch *(Jack's lean — the animation IS the pitch)*

A website gets assembled by gravity, then launched.

- **Stage 1 (0%):** deep parallax starfield. Drifting among the stars: glowing **website fragments** — a gold nav bar, buttons, silver wireframe image blocks, text-line slabs — tumbling slowly like debris, catching light. Headline + sub fade in. Copy beat: the main headline.
- **Stage 2 (~35–70%):** scroll pulls the pieces together — they fly in with real inertia (fast approach, eased deceleration) and **snap magnetically** into place, assembling a glowing wireframe browser/site floating in space. Assembly order is legible: frame → nav → hero block → buttons. Copy beat: "We design it. We build it."
- **Stage 3 (~70–100%):** the assembled site **ignites and launches** — rises and streaks upward as a gold light trail, stage clears to calm starfield, and "Above and beyond." + CTAs land on clean black. Copy beat: the closer + CTAs.
- **Why it wins:** constant motion in every frame, physically real easing, palette-native, unmistakably about getting your website, and the gravity theme still matches the event-horizon button interactions.
- **Implementation hints:** instanced meshes/planes for fragments (no photo textures needed); GSAP ScrollTrigger scrubbing per-piece position/rotation curves with staggered timing; additive-blend glow; launch streak as a stretched bloom trail.

## Concept B — Fly through the portfolio *(the proof-first hero)*

- **Stage 1 (0%):** starfield with several **gold-edge-lit holographic panels** floating at different depths — live screenshots of Rosa's Bakery, Vela Kitchen, Iron Forge Gym, Bright Smile Dental (use real captures from the mock sites). Nearest panel slightly tilted, catching light. Headline over clear space.
- **Stage 2 (~35–70%):** scrolling flies the camera **between and past** the panels — each tilts with parallax as you pass, depth-of-field keeps the near one crisp and far ones soft. Copy beats name what you're passing: "Real sites. Built by us."
- **Stage 3 (~70–100%):** panels recede and shrink into a glowing constellation of gold points; "Above and beyond." + CTAs on clear black.
- **Why it fits:** rich and personal — visitors see actual work in the first five seconds.
- **Implementation hints:** textured planes from real screenshots + gold edge glow; camera on a scrubbed spline path; DOF via blur by depth; panels must never cross the text.

## Concept C — Make the black hole actually work *(fallback, only if you can hit true quality fast)*

Keep the concept ONLY if you implement the real physics: full-screen fragment-shader **gravitational lensing** that visibly warps and smears the background starfield around the horizon, **doppler asymmetry** (approaching side of the disk hotter/brighter), a thin **infalling particle stream** spiraling in, copy beats at every stage, and the hole shrinking/slingshotting off-axis before Stage 3 so the finale is clear. If you can't reach that fidelity quickly, build A or B instead.

## Decision protocol

Assess A, B, and C against what you can render flawlessly at 60fps. If torn, prototype the top two, screenshot each at 0% / 35% / 70% / 100%, compare like a designer, keep the winner, delete the loser. Jack leans **A**. Whatever wins: verify with fresh screenshots at all four scroll points plus the unpin transition, on desktop and mobile widths, and confirm the reduced-motion fallback and that no element ever overlaps the text or CTAs.
