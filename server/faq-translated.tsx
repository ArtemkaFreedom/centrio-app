'use client'

import SiteFooter from '@/components/SiteFooter'
import SiteHeader from '@/components/SiteHeader'
import { useLang } from '@/lib/i18n'
import { useState } from 'react'

function AccordionItem({ q, a, index, total }: { q: string; a: string; index: number; total: number }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: index < total - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: '100%', background: 'none', border: 'none', padding: '22px 0', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, textAlign: 'left' }}
      >
        <span style={{ fontSize: 16, fontWeight: 600, color: '#fff', lineHeight: 1.4 }}>{q}</span>
        <svg style={{ flexShrink: 0, transition: 'transform .25s', transform: open ? 'rotate(180deg)' : 'none' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.8, paddingBottom: 22 }}>
          {a}
        </div>
      )}
    </div>
  )
}

export default function FaqPage() {
  const { t } = useLang()

  return (
    <>
      <style>{`
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:#080810; color:#e2e2e2; font-family:'Inter',-apple-system,sans-serif; }
      `}</style>
      <SiteHeader />

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '100px 24px 56px', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(59,130,246,0.07) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 600, color: '#60a5fa', marginBottom: 20 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            {t.faq_page_title}
          </div>
          <h1 style={{ fontSize: 'clamp(32px,5vw,52px)', fontWeight: 900, color: '#fff', letterSpacing: '-.03em', marginBottom: 16, lineHeight: 1.1 }}>
            {t.faq_page_title}
          </h1>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.4)', maxWidth: 480, margin: '0 auto', lineHeight: 1.65 }}>
            {t.faq_page_sub}
          </p>
        </div>
      </section>

      {/* FAQ list */}
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px 96px' }}>
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '8px 36px' }}>
          {t.faq_items.map((item, i) => (
            <AccordionItem key={i} q={item.q} a={item.a} index={i} total={t.faq_items.length} />
          ))}
        </div>

        {/* Support CTA */}
        <div style={{ marginTop: 40, textAlign: 'center', background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 20, padding: '32px 24px' }}>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
            {t.sup_title}
          </p>
          <a href="mailto:support@centrio.me" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', color: '#fff', fontWeight: 700, fontSize: 14, padding: '11px 24px', borderRadius: 10, textDecoration: 'none', boxShadow: '0 4px 20px rgba(59,130,246,.35)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            support@centrio.me
          </a>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
