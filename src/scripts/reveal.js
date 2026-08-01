/**
 * Scroll-reveal for anything marked data-reveal.
 *
 * Deliberately tiny: one IntersectionObserver, no library. Elements fade and
 * slide up 18px once, then the observer stops watching them.
 *
 * Children of a [data-reveal-group] stagger via a --i custom property, which
 * global.css turns into a transition-delay.
 */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

function revealAll() {
  document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
}

function init() {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;

  // Anything marked, or inside something marked, [data-reveal-now] skips the
  // animation entirely. For a page that is mostly one or two big blocks there
  // is nothing to stagger, and animating them in only creates a window where a
  // fast scroller can arrive before they land.
  document.querySelectorAll('[data-reveal-now] [data-reveal], [data-reveal][data-reveal-now]')
    .forEach((el) => el.classList.add('is-visible'));

  // Reduced motion, or a browser without IntersectionObserver: show everything
  // immediately rather than animating it.
  if (REDUCED.matches || !('IntersectionObserver' in window)) {
    revealAll();
    return;
  }

  // Number the children of each group so they stagger.
  document.querySelectorAll('[data-reveal-group]').forEach((group) => {
    group.querySelectorAll(':scope > [data-reveal]').forEach((child, i) => {
      child.style.setProperty('--i', String(i));
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    // Fire BEFORE the element reaches the viewport, not after.
    //
    // This margin used to be -10%, which held the reveal back until the element
    // was a tenth of a screen inside the fold. That looks good when you scroll
    // at a reading pace and works against you when someone flicks: they can
    // outrun the observer and land on content that hasn't been told to appear
    // yet. A positive bottom margin gives it a head start instead.
    { rootMargin: '0px 0px 14% 0px', threshold: 0.02 }
  );

  targets.forEach((el) => observer.observe(el));
}

// If someone turns reduced motion on mid-visit, stop hiding things.
REDUCED.addEventListener('change', (e) => e.matches && revealAll());

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
