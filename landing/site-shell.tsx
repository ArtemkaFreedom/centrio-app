'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'

export function SiteNav({ active }: { active?: string }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  const linkStyle = (href: string): React.CSSProperties => ({
    color: active === href ? '#f0f0ff' : 'rgba(240,240,255,.38)',
    fontSize: 14, fontWeight: 500, textDecoration: 'none', transition: 'color .2s',
  })

  return (
    <>
      <style>{`
        :root { color-scheme: dark; }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #06060f; color: #e8e8ff; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; overflow-x: hidden; }
        body::before { content:''; position:fixed; inset:0; z-index:0; pointer-events:none; background-image:radial-gradient(circle,rgba(255,255,255,0.05) 1px,transparent 1px); background-size:28px 28px; }
        .snav-link:hover { color: #f0f0ff !important; }
        .snav-dash:hover { color: #f0f0ff !important; border-color: rgba(168,85,247,.3) !important; }
        @media (max-width: 768px) { .snav-links { display: none !important; } }
      `}</style>
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, transition: 'all .3s', ...(scrolled ? { background: 'rgba(6,6,15,.9)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', borderBottom: '1px solid rgba(255,255,255,.05)' } : {}) }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 66, gap: 16 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', flexShrink: 0 }}>
            <img src="/logo.png" alt="Centrio" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            <span style={{ fontWeight: 800, fontSize: 18, color: '#f0f0ff', letterSpacing: '-.025em' }}>Centrio</span>
          </Link>
          <div className="snav-links" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            {([['Возможности', '/features'], ['Мессенджеры', '/#messengers'], ['Тарифы', '/pricing'], ['Скачать', '/download']] as [string,string][]).map(([label, href]) => (
              <Link key={href} href={href} className="snav-link" style={linkStyle(href)}>{label}</Link>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href="/dashboard" className="snav-dash" style={{ fontSize: 13.5, fontWeight: 600, color: 'rgba(240,240,255,.48)', textDecoration: 'none', padding: '8px 15px', borderRadius: 9, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', transition: 'all .2s', whiteSpace: 'nowrap' }}>Кабинет</Link>
            <Link href="/download" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'linear-gradient(135deg,#d946ef,#8b5cf6 50%,#38bdf8)', backgroundSize: '200% auto', color: '#fff', fontWeight: 700, fontSize: 13, padding: '9px 18px', borderRadius: 10, textDecoration: 'none', boxShadow: '0 4px 20px rgba(168,85,247,.35)', whiteSpace: 'nowrap' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Скачать
            </Link>
          </div>
        </div>
      </nav>
    </>
  )
}

export function SiteFooter() {
  return (
    <footer style={{ background: '#06060f', borderTop: '1px solid rgba(255,255,255,.05)', padding: '60px 0 36px', position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 48 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
              <img src="/logo.png" alt="Centrio" style={{ width: 26, height: 26, objectFit: 'contain' }} />
              <span style={{ fontWeight: 800, fontSize: 17, color: '#f0f0ff', letterSpacing: '-.025em' }}>Centrio</span>
            </div>
            <p style={{ color: 'rgba(240,240,255,.3)', fontSize: 13.5, lineHeight: 1.75, maxWidth: 240, marginBottom: 20 }}>Все мессенджеры в одном окне. Бесплатно для Windows, macOS и Linux.</p>
            <a href="mailto:support@centrio.me" style={{ fontSize: 13, color: 'rgba(240,240,255,.25)', textDecoration: 'none' }}>support@centrio.me</a>
          </div>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: 'rgba(240,240,255,.28)', display: 'block', marginBottom: 16 }}>Продукт</span>
            {([['Возможности', '/features'], ['Мессенджеры', '/#messengers'], ['Тарифы', '/pricing'], ['Скачать', '/download'], ['FAQ', '/faq']] as [string,string][]).map(([l, h]) => (
              <Link key={h} href={h} style={{ display: 'block', fontSize: 13.5, color: 'rgba(240,240,255,.38)', textDecoration: 'none', marginBottom: 9, transition: 'color .2s' }}>{l}</Link>
            ))}
          </div>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: 'rgba(240,240,255,.28)', display: 'block', marginBottom: 16 }}>Скачать</span>
            {([['Windows', '/download/windows'], ['macOS', '/download/macos'], ['Linux', '/download/linux']] as [string,string][]).map(([l, h]) => (
              <Link key={h} href={h} style={{ display: 'block', fontSize: 13.5, color: 'rgba(240,240,255,.38)', textDecoration: 'none', marginBottom: 9, transition: 'color .2s' }}>{l}</Link>
            ))}
          </div>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: 'rgba(240,240,255,.28)', display: 'block', marginBottom: 16 }}>Правовые</span>
            {([['Конфиденциальность', '/privacy'], ['Условия использования', '/terms'], ['Возврат', '/refund']] as [string,string][]).map(([l, h]) => (
              <Link key={h} href={h} style={{ display: 'block', fontSize: 13.5, color: 'rgba(240,240,255,.38)', textDecoration: 'none', marginBottom: 9, transition: 'color .2s' }}>{l}</Link>
            ))}
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,.05)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'rgba(240,240,255,.2)' }}>© 2024–2026 Centrio. Все права защищены.</span>
          <div style={{ display: 'flex', gap: 20 }}>
            <Link href="/privacy" style={{ fontSize: 13, color: 'rgba(240,240,255,.2)', textDecoration: 'none' }}>Конфиденциальность</Link>
            <Link href="/terms" style={{ fontSize: 13, color: 'rgba(240,240,255,.2)', textDecoration: 'none' }}>Условия</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
