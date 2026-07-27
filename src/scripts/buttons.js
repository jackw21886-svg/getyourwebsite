/**
 * The press interaction for .btn — an inward-collapsing ring.
 *
 * Everything else about the buttons (hover, focus, the event-horizon ring,
 * the lensing sweep) is pure CSS in global.css. This file exists only because
 * a ripple needs to know where you pressed, which CSS can't tell it.
 *
 * Two rules it follows:
 *   - It never touches the event. No preventDefault, no waiting: the link
 *     navigates or the button fires the instant you press, and the ring plays
 *     over the top of whatever happens next.
 *   - It does nothing at all under prefers-reduced-motion. The hover and focus
 *     states are CSS colour changes, so those still work.
 */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

function collapse(event) {
  if (REDUCED.matches) return;

  const btn = event.target.closest('.btn');
  if (!btn || btn.disabled) return;

  const rect = btn.getBoundingClientRect();

  // Big enough to start outside the button from wherever you pressed, so the
  // ring is already sweeping past the edges as it begins to collapse.
  const size = Math.hypot(rect.width, rect.height) * 2.2;

  const ring = document.createElement('span');
  ring.className = 'btn__ripple';
  ring.style.width = `${size}px`;
  ring.style.height = `${size}px`;
  ring.style.left = `${event.clientX - rect.left}px`;
  ring.style.top = `${event.clientY - rect.top}px`;

  ring.addEventListener('animationend', () => ring.remove(), { once: true });
  btn.appendChild(ring);

  // Safety net: if the animation never fires an end event (element hidden
  // mid-flight, tab backgrounded), don't leave the node behind.
  setTimeout(() => ring.remove(), 900);
}

// One delegated listener rather than one per button, so buttons rendered
// later — or swapped in by the demo sandbox — are covered automatically.
document.addEventListener('pointerdown', collapse, { passive: true });
