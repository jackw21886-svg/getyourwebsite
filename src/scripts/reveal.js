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
    // Fire slightly before the element reaches the bottom of the viewport.
    { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
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
