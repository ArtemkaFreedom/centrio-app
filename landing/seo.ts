// Shared Open Graph image fallback.
//
// Every page that declares its own `openGraph` metadata object was omitting
// `images` entirely (Next.js does not deep-merge `openGraph` with the root
// layout's default when a page redeclares the object — it fully replaces
// it), so blog posts, pricing, faq, features and download had NO og:image
// meta tag at all: sharing those links on Telegram/VK/WhatsApp/Twitter
// rendered a plain text link card, not an image preview.
//
// Import DEFAULT_OG_IMAGE and spread it into each page's own `openGraph`
// object (`images: [DEFAULT_OG_IMAGE]`) so every page gets a working image.
// /logo.png is a real 176x176 fallback; swap this one constant for a proper
// 1200x630 designed banner later and every page picks it up at once.
export const DEFAULT_OG_IMAGE = {
  url: 'https://centrio.me/logo.png',
  width: 176,
  height: 176,
  alt: 'Centrio',
}
