/**
 * Build an internal link that respects the site's base path.
 *
 * On Netlify, Vercel or a custom domain the base is "/" and this is a no-op.
 * On GitHub Pages the site lives at /getyourwebsite/, so every internal href
 * has to be prefixed or the links 404. Always wrap internal links in url():
 *
 *   <a href={url('/pricing')}>Pricing</a>
 *
 * External links (https://…) and anchors (#…) are returned untouched.
 */
export function url(path = '/') {
  if (/^([a-z]+:)?\/\//i.test(path) || path.startsWith('#') || path.startsWith('mailto:')) {
    return path;
  }

  const base = import.meta.env.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  return `${cleanBase}${cleanPath}` || '/';
}

/**
 * True when `current` (usually Astro.url.pathname) points at `href`.
 * Used to mark the active nav link with aria-current.
 */
export function isActive(current, href) {
  const target = url(href).replace(/\/$/, '');
  const here = current.replace(/\/$/, '');
  return here === target;
}
