// @ts-check
import { defineConfig } from 'astro/config';

// ---------------------------------------------------------------------------
// Two knobs, both set by environment variables so the same code deploys
// anywhere without editing this file:
//
//   SITE_URL   the full public URL of the site. Used for sitemap.xml, robots.txt
//              and the Open Graph tags. Change this when we buy a domain.
//   BASE_PATH  the sub-folder the site is served from. GitHub Pages project
//              sites live at /<repo-name>/, so the Pages workflow sets this to
//              "/getyourwebsite". Netlify, Vercel and a custom domain serve from
//              the root, so they leave it unset and it defaults to "/".
//
// See README.md → "Deploying" for the full story.
// ---------------------------------------------------------------------------
const SITE_URL = process.env.SITE_URL ?? 'https://jackw21886-svg.github.io';
const BASE_PATH = process.env.BASE_PATH ?? '/';

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'ignore',
  build: {
    // Emit /work/index.html rather than /work.html so the clean URLs in the nav
    // (/work, /pricing, …) resolve on every static host, including GitHub Pages.
    format: 'directory',
  },
});
