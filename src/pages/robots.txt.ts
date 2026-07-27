/**
 * robots.txt, generated at build time so the sitemap URL always matches
 * whatever SITE_URL the build ran with.
 */
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('sitemap.xml', site ?? 'https://example.com').href;

  return new Response(
    `User-agent: *
Allow: /

Sitemap: ${sitemap}
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  );
};
