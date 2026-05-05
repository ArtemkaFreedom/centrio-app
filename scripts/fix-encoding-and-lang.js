// fix-encoding-and-lang.js
// 1. Fix encoding artifacts (U+FFFD + ?) in SiteFooter.tsx and i18n-new.ts
// 2. Update useLang() to broadcast language changes via custom window event
// 3. Deploy all fixed files and rebuild

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FOOTER = path.join(ROOT, 'server', 'components', 'SiteFooter.tsx');
const I18N = path.join(ROOT, 'server', 'i18n-new.ts');

// Replacement character U+FFFD followed by ? (U+003F) — the artifact
const BAD = '\uFFFD?';

// ── 1. Fix SiteFooter.tsx ──────────────────────────────────────────────────
let footer = fs.readFileSync(FOOTER, 'utf8');
const footerBefore = footer;

// The legal text has И corrupted to \uFFFD?
footer = footer
  .replace(BAD + 'П Козловский', 'ИП Козловский')   // ИП
  .replace(BAD + 'НН: 50190', 'ИНН: 50190')           // ИНН
  .replace('ОГРН' + BAD + 'П:', 'ОГРНИП:');            // ОГРНИП

if (footer !== footerBefore) {
  fs.writeFileSync(FOOTER, footer, 'utf8');
  console.log('✓ SiteFooter.tsx — encoding artifacts fixed');
} else {
  console.log('- SiteFooter.tsx — no artifacts found');
}

// ── 2. Fix i18n-new.ts ────────────────────────────────────────────────────
let i18n = fs.readFileSync(I18N, 'utf8');
const i18nBefore = i18n;

// Fix МИР card (Visa / Mastercard / МИР)
i18n = i18n.replaceAll('М' + BAD + 'Р', 'МИР');
// Fix any other И corruptions (История платежей, etc.)
// General pattern: scan and replace BAD sequences
// Common words: История, ИНН, ИП
i18n = i18n
  .replaceAll(BAD + 'стория', 'История')
  .replaceAll(BAD + 'НН:', 'ИНН:')
  .replaceAll(BAD + 'П Козловский', 'ИП Козловский')
  .replaceAll('ОГРН' + BAD + 'П', 'ОГРНИП');

if (i18n !== i18nBefore) {
  fs.writeFileSync(I18N, i18n, 'utf8');
  console.log('✓ i18n-new.ts — encoding artifacts fixed');
} else {
  console.log('- i18n-new.ts — no artifacts found');
}

// ── 3. Fix useLang() to broadcast changes ────────────────────────────────
// Read i18n-new.ts again (after encoding fix)
i18n = fs.readFileSync(I18N, 'utf8');

const OLD_USELANG = `export function useLang(): { lang: Lang; t: TDict; setLang: (l: Lang) => void } {
  const [lang, setLangState] = useState<Lang>('ru')
  useEffect(() => {
    const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('centrio_lang')) as Lang | null
    if (saved && (LANGS as readonly string[]).includes(saved)) setLangState(saved)
  }, [])
  const setLang = (l: Lang) => {
    setLangState(l)
    if (typeof localStorage !== 'undefined') localStorage.setItem('centrio_lang', l)
  }
  return { lang, t: (d[lang] || d.ru) as TDict, setLang }
}`;

const NEW_USELANG = `const LANG_EVENT = 'centrio_lang_change'

export function useLang(): { lang: Lang; t: TDict; setLang: (l: Lang) => void } {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('centrio_lang') as Lang | null
      if (saved && (LANGS as readonly string[]).includes(saved)) return saved
    }
    return 'ru'
  })

  useEffect(() => {
    // Sync on mount (for SSR hydration)
    const saved = typeof localStorage !== 'undefined'
      ? (localStorage.getItem('centrio_lang') as Lang | null)
      : null
    if (saved && (LANGS as readonly string[]).includes(saved) && saved !== lang) {
      setLangState(saved)
    }
    // Listen for changes from other components
    const handler = (e: Event) => {
      const l = (e as CustomEvent<Lang>).detail
      setLangState(l)
    }
    window.addEventListener(LANG_EVENT, handler)
    return () => window.removeEventListener(LANG_EVENT, handler)
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    if (typeof localStorage !== 'undefined') localStorage.setItem('centrio_lang', l)
    // Broadcast to all other useLang() instances on the page
    window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: l }))
  }

  return { lang, t: (d[lang] || d.ru) as TDict, setLang }
}`;

if (i18n.includes(OLD_USELANG)) {
  i18n = i18n.replace(OLD_USELANG, NEW_USELANG);
  fs.writeFileSync(I18N, i18n, 'utf8');
  console.log('✓ useLang() — broadcast mechanism added');
} else {
  console.log('⚠ useLang() pattern not matched — check manually');
  // Try partial match to diagnose
  const idx = i18n.indexOf('export function useLang');
  if (idx > -1) {
    console.log('  Found useLang at:', idx);
    console.log('  Context:', JSON.stringify(i18n.slice(idx, idx + 200)));
  }
}

console.log('\nDone. Run deploy-blog-pages.js to push to server.');
