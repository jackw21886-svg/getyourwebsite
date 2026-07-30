/**
 * Starts the dark sections' ambient animation, and pauses it off screen.
 *
 * Everything the ambient layers look like is CSS (global.css §6). This file
 * does two things CSS can't:
 *
 *   1. Turns the animation on at all, by adding `ambient-live` to <html> once
 *      the page has loaded. The gradients are painted from the start; only the
 *      motion waits, because an animated layer has to be composited before the
 *      first frame can be presented and there's no reason to do that during
 *      load — nobody has scrolled to a dark section in the first second.
 *   2. Pauses a section while it's off screen, because there's no CSS way to
 *      say "stop animating when nobody can see you". A long page can have half
 *      a dozen dark sections and there's no reason for the footer's sheen to be
 *      ticking over while somebody reads the hero.
 */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

// Under reduced motion the static gradients are the finished product — no class
// gets added, so nothing ever animates and there is nothing to pause.
if (!REDUCED.matches && 'IntersectionObserver' in window) {
  const sections = document.querySelectorAll('.section--dark, .foot');

  const start = () => document.documentElement.classList.add('ambient-live');
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });

  if (sections.length) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.classList.toggle('ambient-paused', !entry.isIntersecting);
        }
      },
      // A little margin so a section is already running by the time its top
      // edge appears, rather than visibly starting up mid-view.
      { rootMargin: '15% 0px' }
    );

    sections.forEach((section) => {
      // Start paused; the observer's first callback turns on whatever is
      // actually on screen. Avoids every section animating during load.
      section.classList.add('ambient-paused');
      io.observe(section);
    });
  }
}
