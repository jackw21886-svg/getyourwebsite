/**
 * Site-wide data. Almost everything you'll want to change day to day lives
 * here rather than inside a page: contact details, nav links, the Our Work
 * grid and the pricing tiers.
 *
 * Anything marked [EDIT] is a placeholder Jack still needs to fill in.
 * There's a full list of them at the bottom of README.md.
 */

/** [EDIT] Where the contact form is delivered and what shows in the footer. */
export const CONTACT_EMAIL = 'hello@getyourwebsite.example'; // [EDIT: your email]

/**
 * [EDIT] Web3Forms access key. Get a free one in 10 seconds at
 * https://web3forms.com — paste your email, they email you a key.
 * Until this is a real key the contact form shows a friendly error and
 * falls back to the mailto link, so nothing silently disappears.
 */
export const WEB3FORMS_KEY = 'REPLACE_WITH_YOUR_WEB3FORMS_ACCESS_KEY'; // [EDIT]

/** [EDIT] Social links. Delete any you don't want — the footer adapts. */
export const SOCIALS = [
  // { label: 'Instagram', href: 'https://instagram.com/...' }, // [EDIT]
  // { label: 'TikTok', href: 'https://tiktok.com/@...' },      // [EDIT]
];

/** The five links that sit in the middle of the nav bar. */
export const NAV_LINKS = [
  { label: 'Our Work', href: '/work' },
  { label: 'Demo', href: '/demo' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Benefits', href: '/benefits' },
  { label: 'Why Us', href: '/why-us' },
];

/**
 * The Our Work grid. Adding a new mock site is a one-object job: drop the
 * HTML file in public/, take a screenshot into public/shots/, add an entry.
 */
export const PROJECTS = [
  {
    slug: 'bakery',
    name: "Rosa's Bakery",
    type: 'Bakery',
    href: '/bakery.html',
    shot: '/shots/bakery.webp',
    blurb: 'Warm, appetite-first layout where the daily menu and the address do the selling.',
    featured: true,
  },
  {
    slug: 'dental',
    name: 'Bright Smile Dental',
    type: 'Dental practice',
    href: '/dental.html',
    shot: '/shots/dental.webp',
    blurb: 'Calm, trust-building design built around one job: getting an appointment booked.',
    featured: true,
  },
  {
    slug: 'gym',
    name: 'Iron Forge Gym',
    type: 'Gym',
    href: '/gym.html',
    shot: '/shots/gym.webp',
    blurb: 'High-contrast and loud, with class times and membership tiers front and centre.',
    featured: true,
  },
  {
    slug: 'auto',
    name: 'Redline Auto Repair',
    type: 'Auto repair',
    href: '/auto.html',
    shot: '/shots/auto.webp',
    blurb: 'Industrial and direct — services, upfront pricing and a phone number you can hit from anywhere.',
  },
  {
    slug: 'landscaping',
    name: 'Cedar & Stone Landscaping',
    type: 'Landscaping',
    href: '/landscaping.html',
    shot: '/shots/landscaping.webp',
    blurb: 'Organic and photo-led, with a seasonal service list and a quote request that takes 20 seconds.',
  },
  {
    slug: 'restaurant',
    name: 'Vela Kitchen',
    type: 'Restaurant',
    href: '/restaurant.html',
    shot: '/shots/restaurant.webp',
    blurb: 'Editorial and confident, with a full menu, hours and reservations without a single PDF.',
  },
];

/** Just the three we lead with on the home page. */
export const FEATURED_PROJECTS = PROJECTS.filter((p) => p.featured);

/**
 * Pricing tiers. All prices are [EDIT] placeholders — change the `price`
 * strings here and the pricing page and home teaser both update.
 */
export const TIERS = [
  {
    id: 'launch',
    name: 'Launch',
    price: '$150', // [EDIT: e.g. $150]
    tagline: 'Everything a small business actually needs, done properly.',
    pages: 'Up to 3 pages',
    revisions: '2 revision rounds',
    design: 'Clean template-based design, customised to your brand',
    delivery: '1–2 weeks',
    like: "A site like Rosa's Bakery",
    likeHref: '/bakery.html',
    features: [
      'Up to 3 pages',
      '2 revision rounds',
      'Template-based design customised to your brand',
      'Contact form that reaches your inbox',
      'Mobile-friendly on every screen',
    ],
  },
  {
    id: 'orbit',
    name: 'Orbit',
    price: '$350', // [EDIT: e.g. $350]
    tagline: 'A fully custom site with room to show everything you offer.',
    pages: 'Up to 6 pages',
    revisions: '4 revision rounds',
    design: 'Fully custom design, built around your brand',
    delivery: '2–3 weeks',
    like: 'A site like Bright Smile Dental',
    likeHref: '/dental.html',
    popular: true,
    features: [
      'Up to 6 pages',
      '4 revision rounds',
      'Fully custom design — no template',
      'Extra sections: menus, galleries, booking links',
      'Basic SEO setup so you turn up on Google',
      'Contact form that reaches your inbox',
    ],
  },
  {
    id: 'deep-space',
    name: 'Deep Space',
    price: '$600+', // [EDIT: e.g. $600+]
    tagline: 'The full build, with the details that make people stay.',
    pages: '8+ pages',
    revisions: '6 revision rounds',
    design: 'Fully custom design with animation and advanced features',
    delivery: 'Priority turnaround',
    like: 'A site like Iron Forge Gym — and beyond',
    likeHref: '/gym.html',
    features: [
      '8+ pages',
      '6 revision rounds',
      'Fully custom design with animation',
      'Advanced features built to order',
      'Full SEO setup',
      'Priority turnaround',
    ],
  },
];

export const PRICING_DISCLAIMER =
  'Example pricing. Every business is different — send an inquiry and we’ll reply with a personal quote after we review it.';

/**
 * Which typeface the headings use. Body and mono are unaffected.
 *
 *   'outfit'  — the current one, loaded from Google Fonts with the others
 *   'clash'   — Clash Display, self-hosted (Fontshare, ITF Free Font License)
 *   'cabinet' — Cabinet Grotesk, self-hosted (Fontshare, ITF Free Font License)
 *   'sora'    — Sora, self-hosted (Google Fonts, SIL Open Font License 1.1)
 *
 * The three alternatives are variable fonts sitting in `public/fonts/`, all
 * under 45KB. Changing this line is the whole switch: BaseLayout preloads the
 * right file and points `--font-display` at it, and every heading follows.
 * Whichever is picked keeps Outfit behind it in the stack.
 *
 * Run `node tools/font-compare.mjs` to see them side by side.
 */
export const HEADING_FONT = 'outfit';
