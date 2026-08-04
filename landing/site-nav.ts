// Single source of truth for the site's primary navigation and the
// cross-linked "compare" (vs-*) blog links.
//
// The site has three independent nav/footer implementations
// (SiteHeader.tsx, components/ui/site-shell.tsx, and the homepage's own
// inline nav in app/page.tsx) that used to hardcode their own copies of
// these link lists. That let them drift — e.g. the top nav's "Возможности"
// link pointed to `/#features` in SiteHeader.tsx but to `/features` in
// site-shell.tsx, and the homepage footer's comparison links were missing
// `vs-ferdium` entirely.
//
// Import MAIN_NAV / COMPARE_LINKS from here instead of re-declaring the
// array locally. Change a destination once, it updates everywhere that
// imports this file.

export interface NavItem {
  /** i18n key on the `t` object from useLang() */
  labelKey: 'nav_features' | 'nav_messengers' | 'nav_pricing' | 'nav_download' | 'nav_blog'
  href: string
}

// Canonical top-level navigation, used on every page except the homepage
// (the homepage links its own in-page anchor sections for messengers/
// pricing/download, which is an intentional same-page UX, not drift).
export const MAIN_NAV: NavItem[] = [
  { labelKey: 'nav_features',   href: '/features' },
  { labelKey: 'nav_messengers', href: '/#messengers' },
  { labelKey: 'nav_pricing',    href: '/pricing' },
  { labelKey: 'nav_download',   href: '/download' },
  { labelKey: 'nav_blog',       href: '/blog' },
]

export interface CompareLink {
  label: string
  href: string
}

// Comparison / "vs" blog posts, linked from footers and the blog index.
export const COMPARE_LINKS: CompareLink[] = [
  { label: 'vs Rambox',  href: '/blog/vs-rambox'  },
  { label: 'vs Franz',   href: '/blog/vs-franz'   },
  { label: 'vs Wavebox', href: '/blog/vs-wavebox' },
  { label: 'vs Ferdium', href: '/blog/vs-ferdium' },
]
