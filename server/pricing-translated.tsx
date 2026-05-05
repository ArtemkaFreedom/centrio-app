'use client'

import { useState } from 'react'
import SiteFooter from '@/components/SiteFooter'
import SiteHeader from '@/components/SiteHeader'
import { useLang } from '@/lib/i18n'

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '20px 0' }}>
      <div onClick={() => setOpen(!open)} style={{ fontSize: 16, fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        {q}
        <svg style={{ flexShrink: 0, transition: 'transform .25s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      {open && <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.75, marginTop: 12 }}>{a}</div>}
    </div>
  )
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(true)
  const { t } = useLang()

  return (
    <>
      <style>{`
        :root { color-scheme: dark; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080810; color: #e2e2e2; font-family: 'Inter', -apple-system, sans-serif; overflow-x: hidden; }
        .container { max-width: 1100px; margin: 0 auto; padding: 0 28px; }
        @keyframes pulse-glow { 0%,100% { opacity:.3; } 50% { opacity:.65; } }
        .hero-glow { position:absolute; border-radius:50%; filter:blur(130px); animation:pulse-glow 5s ease-in-out infinite; pointer-events:none; }
        .plan-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 36px 32px; transition: all .3s; flex: 1; position: relative; }
        .plan-card.featured { background: rgba(99,102,241,0.08); border-color: rgba(99,102,241,0.4); box-shadow: 0 0 60px rgba(99,102,241,0.12); }
        .plan-card.featured:hover { box-shadow: 0 0 80px rgba(99,102,241,0.2); border-color: rgba(99,102,241,0.6); }
        .check-row { display:flex; align-items:flex-start; gap:12px; }
        .check-icon { width:20px; height:20px; border-radius:50%; flex-shrink:0; margin-top:1px; display:flex; align-items:center; justify-content:center; }
        .check-icon.ok { background:rgba(34,197,94,0.12); border:1px solid rgba(34,197,94,0.3); }
        .check-icon.no { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); }
        .btn-buy { display:block; width:100%; text-align:center; font-weight:700; font-size:15px; padding:14px; border-radius:12px; cursor:pointer; text-decoration:none; transition:all .22s; border:none; }
        .btn-buy.primary { background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; box-shadow:0 4px 28px rgba(99,102,241,.4); }
        .btn-buy.primary:hover { transform:translateY(-2px); box-shadow:0 8px 40px rgba(99,102,241,.6); }
        .btn-buy.ghost { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14); color:#e2e2e2; }
        .btn-buy.ghost:hover { background:rgba(255,255,255,0.1); transform:translateY(-2px); }
        .toggle-wrap { display:inline-flex; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:50px; padding:4px; gap:4px; }
        .toggle-btn { padding:8px 22px; border-radius:50px; font-size:14px; font-weight:500; cursor:pointer; transition:all .2s; border:none; }
        .toggle-btn.active { background:rgba(99,102,241,0.25); color:#a78bfa; border:1px solid rgba(99,102,241,0.4); }
        .toggle-btn.inactive { background:transparent; color:rgba(255,255,255,0.4); }
        .compare-row { display:grid; grid-template-columns: 1fr 1fr 1fr; gap:0; border-bottom:1px solid rgba(255,255,255,0.06); }
        .compare-cell { padding:14px 16px; font-size:14px; }
        .compare-row:nth-child(odd) .compare-cell { background:rgba(255,255,255,0.02); }
      `}</style>
      <SiteHeader />

      {/* HERO */}
      <section style={{ position: 'relative', padding: '140px 0 80px', textAlign: 'center', overflow: 'hidden' }}>
        <div className="hero-glow" style={{ width: 600, height: 600, background: '#6366f1', opacity: .09, top: -100, left: '50%', transform: 'translateX(-50%)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(99,102,241,0.06) 1px, transparent 1px)', backgroundSize: '44px 44px', opacity: .7, pointerEvents: 'none' }} />
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 50, padding: '7px 18px', fontSize: 13, fontWeight: 500, color: '#a78bfa', marginBottom: 24 }}>
            ✨ {t.pricing_badge}
          </div>
          <h1 style={{ fontSize: 'clamp(38px,5vw,62px)', fontWeight: 900, color: '#fff', letterSpacing: '-.03em', lineHeight: 1.1, marginBottom: 16 }}>
            {t.pr_title}
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.45)', maxWidth: 500, margin: '0 auto 40px', lineHeight: 1.75 }}>
            {t.pr_sub}
          </p>
          <div className="toggle-wrap">
            <button className={`toggle-btn ${annual ? 'inactive' : 'active'}`} onClick={() => setAnnual(false)}>{t.pricing_toggle_month}</button>
            <button className={`toggle-btn ${annual ? 'active' : 'inactive'}`} onClick={() => setAnnual(true)}>
              {t.pricing_toggle_year}
              <span style={{ marginLeft: 8, fontSize: 11, background: 'rgba(34,197,94,0.2)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 50, padding: '2px 8px', fontWeight: 700 }}>−34%</span>
            </button>
          </div>
        </div>
      </section>

      {/* PLANS */}
      <section style={{ padding: '0 0 96px' }}>
        <div className="container">
          <div style={{ display: 'flex', gap: 20, alignItems: 'stretch', flexWrap: 'wrap' }}>

            {/* FREE */}
            <div className="plan-card">
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>{t.plan_free}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 48, fontWeight: 900, color: '#fff', letterSpacing: '-.03em' }}>0</span>
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>{t.plan_free_sub}</div>
              </div>
              <a href="/#download" className="btn-buy ghost" style={{ marginBottom: 28 }}>{t.plan_free_btn}</a>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {t.pricing_free_features.map((text, i) => (
                  <div key={i} className="check-row">
                    <div className="check-icon ok"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{text}</span>
                  </div>
                ))}
                {t.pricing_free_no.map((text, i) => (
                  <div key={i} className="check-row">
                    <div className="check-icon no"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.25)', lineHeight: 1.5 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* PRO */}
            <div className="plan-card featured">
              <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '5px 18px', borderRadius: '0 0 12px 12px', whiteSpace: 'nowrap' }}>
                {t.pricing_recommended}
              </div>
              <div style={{ marginBottom: 24, marginTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#a78bfa', marginBottom: 10 }}>Pro</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 48, fontWeight: 900, color: '#fff', letterSpacing: '-.03em' }}>
                    {annual ? '133 ₽' : '199 ₽'}
                  </span>
                  <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.35)' }}>{t.pricing_per_month}</span>
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
                  {annual
                    ? <><span style={{ color: 'rgba(255,255,255,0.25)', textDecoration: 'line-through', marginRight: 8 }}>2 388 ₽</span><span style={{ color: '#4ade80', fontWeight: 600 }}>{t.pricing_year_total}</span></>
                    : t.pricing_month_note
                  }
                </div>
              </div>
              <a href="/dashboard" className="btn-buy primary" style={{ marginBottom: 28 }}>
                {annual ? t.pricing_buy_year : t.pricing_buy_month}
              </a>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {t.pricing_pro_features.map((text, i) => (
                  <div key={i} className="check-row">
                    <div className="check-icon ok"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>
                    <span style={{ fontSize: 14, color: t.pricing_pro_highlight[i] ? '#c4b5fd' : 'rgba(255,255,255,0.65)', lineHeight: 1.5, fontWeight: t.pricing_pro_highlight[i] ? 600 : 400 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payment info */}
          <div style={{ textAlign: 'center', marginTop: 40, fontSize: 13, color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
            {t.pricing_payment_info.map((item, i) => (
              <>
                {i > 0 && <span key={`dot-${i}`}>·</span>}
                <span key={i}>{item}</span>
              </>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARE TABLE */}
      <section style={{ padding: '0 0 96px', background: 'rgba(99,102,241,0.02)' }}>
        <div className="container">
          <h2 style={{ fontSize: 'clamp(26px,3vw,38px)', fontWeight: 800, color: '#fff', textAlign: 'center', marginBottom: 48, letterSpacing: '-.02em' }}>
            {t.pricing_compare_title}
          </h2>
          <div style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div className="compare-row" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="compare-cell" style={{ fontWeight: 600, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{t.pricing_col_feature}</div>
              <div className="compare-cell" style={{ fontWeight: 700, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>{t.pricing_col_free}</div>
              <div className="compare-cell" style={{ fontWeight: 700, color: '#a78bfa', textAlign: 'center' }}>{t.pricing_col_pro}</div>
            </div>
            {t.pricing_compare_rows.map(([feature, free, pro], i) => (
              <div key={i} className="compare-row">
                <div className="compare-cell" style={{ color: 'rgba(255,255,255,0.6)' }}>{feature}</div>
                <div className="compare-cell" style={{ textAlign: 'center', color: free === '—' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.5)' }}>{free}</div>
                <div className="compare-cell" style={{ textAlign: 'center', color: pro === '✓' ? '#4ade80' : '#a78bfa', fontWeight: 600 }}>{pro}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '0 0 96px' }}>
        <div className="container" style={{ maxWidth: 720 }}>
          <h2 style={{ fontSize: 'clamp(26px,3vw,38px)', fontWeight: 800, color: '#fff', textAlign: 'center', marginBottom: 48, letterSpacing: '-.02em' }}>
            {t.pricing_faq_title}
          </h2>
          {t.pricing_faq_items.map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} />
          ))}
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
