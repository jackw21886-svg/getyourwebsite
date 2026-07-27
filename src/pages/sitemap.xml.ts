/**
 * sitemap.xml.
 *
 * Lists the seven real pages plus the mock client sites, which are worth
 * indexing — they're the portfolio. 404 is deliberately left out.
 *
 * If you add a page, add it to PAGES below.
 */
import type { APIRoute } from 'astro';
import { PROJECTS } from '../data/site.js';

const PAGES = [
  { path: '/', priority: '1.0' },
  { path: '/work', priority: '0.9' },
  { path: '/demo', priority: '0.8' },
  { path: '/pricing', priority: '0.9' },
  { path: '/benefits', priority: '0.7' },
  { path: '/why-us', priority: '0.7' },
  { path: '/contact', priority: '0.9' },
];

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://example.com');
  const today = new Date().toISOString().slice(0, 10);

  const entries = [
    ...PAGES.map((p) => ({ loc: new URL(p.path, base).href, priority: p.priority })),
    ...PROJECTS.map((p) => ({ loc: new URL(p.href, base).href, priority: '0.5' })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) => `  <url>
    <loc>${e.loc}</loc>
    <lastmod>${today}</lastmod>
    <priority>${e.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
