'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────
interface StatsData {
  today:    { appTime: number; notifCount: number; msgSent: number; msgReceived: number }
  week:     { appTime: number; notifCount: number; msgSent: number; msgReceived: number }
  total:    { appTime: number; notifCount: number; msgSent: number; msgReceived: number }
  streak:   number
  services: { name: string; minutes: number; notifCount: number }[]
  chart:    { date: string; label: string; minutes: number }[]
}

interface Device {
  id: string; os: string; browser: string; icon: string
  ipAddress: string; createdAt: string; label: string
}

// ── Helpers ───────────────────────────────────────────────────────
function fmtTime(secs: number) {
  if (!secs) return '0 мин'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}ч ${m}м`
  return `${m} мин`
}

const PLAN_COLORS: Record<string, string> = {
  FREE: '#64748b', PRO: '#3b82f6', TEAM: '#06b6d4'
}
const PLAN_LABELS: Record<string, string> = {
  FREE: 'Free', PRO: 'Pro', TEAM: 'Team'
}

// ── SVG Icons ─────────────────────────────────────────────────────
const IcoOverview = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
    <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
    <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
  </svg>
)
const IcoDevices = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M8 18h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <rect x="16" y="8" width="6" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M5 18v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M11 18v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const IcoSubscription = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M12 2L14.4 8.6L21.5 9.3L16.5 13.8L18.1 20.7L12 17.1L5.9 20.7L7.5 13.8L2.5 9.3L9.6 8.6L12 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
  </svg>
)
const IcoLogout = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const IcoCheck = ({ color = '#3b82f6' }: { color?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M20 6L9 17L4 12" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IcoTime = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const IcoBell = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const IcoMsg = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
  </svg>
)
const IcoFlame = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
  </svg>
)
const IcoShield = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
  </svg>
)
const IcoCard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <rect x="1" y="4" width="22" height="16" rx="3" stroke="currentColor" strokeWidth="1.8"/>
    <line x1="1" y1="10" x2="23" y2="10" stroke="currentColor" strokeWidth="1.8"/>
  </svg>
)
const IcoArrow = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <path d="M7 17L17 7M17 7H7M17 7v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// ── Main Component ────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const { user, logout, setUser, _hasHydrated } = useAuthStore()
  const [tab, setTab] = useState<'overview' | 'devices' | 'subscription'>('overview')
  const [stats, setStats]     = useState<StatsData | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [loadingStats, setLoadingStats]     = useState(true)
  const [loadingDevices, setLoadingDevices] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [loggingOutAll, setLoggingOutAll] = useState(false)
  const [buyingPlan, setBuyingPlan] = useState<string | null>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [autoRenew, setAutoRenew]     = useState(false)
  const [hasMethod, setHasMethod]     = useState(false)
  const [togglingAR, setTogglingAR]   = useState(false)
  const [paymentModal, setPaymentModal] = useState<'month' | 'year' | null>(null)
  const [buyingCrypto, setBuyingCrypto] = useState<string | null>(null)

  useEffect(() => {
    if (!_hasHydrated) return
    if (!user) router.push('/auth/login')
  }, [user?.id, _hasHydrated]) // eslint-disable-line

  useEffect(() => {
    if (!user?.id) return
    api.get('/api/stats/summary')
      .then(r => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false))
  }, [user?.id]) // eslint-disable-line

  const loadDevices = useCallback(() => {
    setLoadingDevices(true)
    api.get('/api/user/devices')
      .then(r => setDevices(r.data.devices || []))
      .catch(() => setDevices([]))
      .finally(() => setLoadingDevices(false))
  }, [])

  useEffect(() => {
    if (tab === 'devices') loadDevices()
  }, [tab, loadDevices])

  const handleRevoke = async (id: string) => {
    setRevokingId(id)
    try {
      await api.delete(`/api/user/devices/${id}`)
      setDevices(prev => prev.filter(d => d.id !== id))
    } catch {}
    setRevokingId(null)
  }

  const handleLogoutAll = async () => {
    if (!confirm('Выйти на всех устройствах? Вы будете перенаправлены на страницу входа.')) return
    setLoggingOutAll(true)
    try {
      await api.delete('/api/user/devices', { data: {} })
      logout()
      router.push('/auth/login')
    } catch (e: any) {
      alert('Ошибка: ' + (e?.response?.data?.error || e?.message || 'попробуйте ещё раз'))
      setLoggingOutAll(false)
    }
  }

  const handleBuyPlan = async (plan: 'month' | 'year') => {
    setBuyingPlan(plan)
    setPaymentModal(null)
    try {
      const { data } = await api.post('/api/payments/create', { plan })
      if (data?.data?.confirmationUrl) {
        window.location.href = data.data.confirmationUrl
      }
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Ошибка создания платежа. Попробуйте позже.')
    } finally {
      setBuyingPlan(null)
    }
  }

  const handleBuyCrypto = async (plan: 'month' | 'year') => {
    setBuyingCrypto(plan)
    setPaymentModal(null)
    try {
      const { data } = await api.post('/api/payments/crypto-create', { plan })
      if (data?.data?.confirmationUrl) {
        window.open(data.data.confirmationUrl, '_blank')
      }
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Ошибка. Попробуйте позже.')
    } finally {
      setBuyingCrypto(null)
    }
  }

  const loadPayments = useCallback(() => {
    setLoadingPayments(true)
    api.get('/api/payments/my')
      .then(r => setPayments(r.data?.data || []))
      .catch(() => setPayments([]))
      .finally(() => setLoadingPayments(false))
  }, [])

  const refreshUser = useCallback(() => {
    api.get('/api/user/profile')
      .then(r => { if (r.data?.id) setUser(r.data) })
      .catch(() => {})
  }, [setUser])

  const loadAutoRenew = useCallback(() => {
    api.get('/api/payments/auto-renew')
      .then(r => { setAutoRenew(r.data?.data?.autoRenew ?? false); setHasMethod(r.data?.data?.hasMethod ?? false) })
      .catch(() => {})
  }, [])

  const toggleAutoRenew = async () => {
    setTogglingAR(true)
    try {
      const { data } = await api.patch('/api/payments/auto-renew', { enabled: !autoRenew })
      setAutoRenew(data?.data?.autoRenew ?? !autoRenew)
    } catch {} finally { setTogglingAR(false) }
  }

  useEffect(() => {
    if (tab === 'subscription') {
      refreshUser()
      loadPayments()
      loadAutoRenew()
    }
  }, [tab, loadPayments, refreshUser, loadAutoRenew])

  if (!_hasHydrated || !user) {
    return (
      <div style={{ minHeight:'100vh', background:'#060a14', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:40, height:40, border:'3px solid rgba(59,130,246,0.25)', borderTopColor:'#3b82f6', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  const isPro  = user.plan === 'PRO'  || user.plan === 'TEAM'
  const isTeam = user.plan === 'TEAM'
  const planColor = PLAN_COLORS[user.plan || 'FREE'] || '#64748b'
  const chartMax = Math.max(...(stats?.chart.map(c => c.minutes) || [1]), 1)

  const NAV = [
    { key: 'overview',     label: 'Обзор',       Icon: IcoOverview },
    { key: 'devices',      label: 'Устройства',   Icon: IcoDevices },
    { key: 'subscription', label: 'Подписка',     Icon: IcoSubscription },
  ] as const

  const glass = {
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 20,
  } as React.CSSProperties

  const glassBlue = {
    background: 'rgba(59,130,246,0.08)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(59,130,246,0.25)',
    borderRadius: 20,
    boxShadow: '0 0 40px rgba(59,130,246,0.08)',
  } as React.CSSProperties

  return (
    <div style={{ minHeight:'100vh', background:'#060a14', color:'#fff', fontFamily:'Inter,-apple-system,sans-serif', display:'flex' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(59,130,246,0.2);border-radius:4px}
        body{background:#060a14}

        .nav-item{
          display:flex;align-items:center;gap:10px;
          padding:10px 14px;border-radius:12px;
          font-size:13.5px;font-weight:500;
          color:rgba(255,255,255,0.45);
          cursor:pointer;border:none;background:none;
          width:100%;text-align:left;
          transition:all .18s;
        }
        .nav-item:hover{color:rgba(255,255,255,0.8);background:rgba(255,255,255,0.05)}
        .nav-item.active{
          color:#fff;
          background:rgba(59,130,246,0.15);
          border:1px solid rgba(59,130,246,0.25);
          box-shadow:0 0 20px rgba(59,130,246,0.1);
        }
        .nav-item.active svg{color:#60a5fa}

        .stat-card{
          background:rgba(255,255,255,0.04);
          backdrop-filter:blur(24px);
          -webkit-backdrop-filter:blur(24px);
          border:1px solid rgba(255,255,255,0.08);
          border-radius:20px;
          padding:24px;
          transition:border-color .2s, box-shadow .2s;
          animation:fadeIn .4s ease both;
        }
        .stat-card:hover{border-color:rgba(59,130,246,0.3);box-shadow:0 0 30px rgba(59,130,246,0.08)}

        .glass-card{
          background:rgba(255,255,255,0.04);
          backdrop-filter:blur(24px);
          -webkit-backdrop-filter:blur(24px);
          border:1px solid rgba(255,255,255,0.08);
          border-radius:20px;
          animation:fadeIn .4s ease both;
        }

        .btn-primary{
          background:linear-gradient(135deg,#2563eb,#3b82f6);
          border:none;color:#fff;border-radius:12px;
          padding:11px 22px;font-size:13.5px;font-weight:600;
          cursor:pointer;transition:all .2s;font-family:inherit;
          box-shadow:0 4px 20px rgba(59,130,246,0.35);
          display:flex;align-items:center;gap:7px;
          white-space:nowrap;
        }
        .btn-primary:hover{transform:translateY(-1px);box-shadow:0 8px 28px rgba(59,130,246,0.45)}
        .btn-primary:active{transform:translateY(0)}

        .btn-danger{
          background:rgba(239,68,68,0.08);
          border:1px solid rgba(239,68,68,0.2);
          color:#f87171;border-radius:10px;
          padding:9px 16px;font-size:13px;font-weight:500;
          cursor:pointer;font-family:inherit;
          transition:all .2s;white-space:nowrap;
          display:flex;align-items:center;gap:7px;
        }
        .btn-danger:hover{background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4)}
        .btn-danger:disabled{opacity:0.5;cursor:not-allowed}

        .btn-ghost{
          background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.1);
          color:rgba(255,255,255,0.55);border-radius:10px;
          padding:9px 16px;font-size:13px;
          cursor:pointer;font-family:inherit;
          transition:all .18s;
          display:flex;align-items:center;gap:7px;
        }
        .btn-ghost:hover{background:rgba(255,255,255,0.09);color:rgba(255,255,255,0.8)}

        .plan-card{
          background:rgba(255,255,255,0.04);
          backdrop-filter:blur(24px);
          -webkit-backdrop-filter:blur(24px);
          border:1px solid rgba(255,255,255,0.08);
          border-radius:20px;padding:26px;flex:1;
          display:flex;flex-direction:column;gap:16px;
          transition:all .25s;
          animation:fadeIn .4s ease both;
        }
        .plan-card:hover{border-color:rgba(255,255,255,0.16);transform:translateY(-2px)}
        .plan-card.pro{border-color:rgba(59,130,246,0.35);background:rgba(59,130,246,0.06);box-shadow:0 0 40px rgba(59,130,246,0.1)}
        .plan-card.team{border-color:rgba(6,182,212,0.35);background:rgba(6,182,212,0.06);box-shadow:0 0 40px rgba(6,182,212,0.08)}
        .plan-card.current-plan{box-shadow:inset 0 0 0 1.5px currentColor}

        .device-row{
          background:rgba(255,255,255,0.04);
          backdrop-filter:blur(20px);
          border:1px solid rgba(255,255,255,0.08);
          border-radius:16px;padding:18px 22px;
          display:flex;align-items:center;gap:16px;
          transition:border-color .2s;
          animation:fadeIn .35s ease both;
        }
        .device-row:hover{border-color:rgba(59,130,246,0.25)}

        .badge{
          font-size:10.5px;font-weight:700;
          padding:3px 8px;border-radius:6px;
          text-transform:uppercase;letter-spacing:.04em;
        }

        .bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px}
        .bar-col:hover .bar-fill{filter:brightness(1.25)}
        .bar-fill{width:100%;border-radius:5px 5px 2px 2px;transition:height .5s cubic-bezier(.4,0,.2,1),filter .2s}
      `}</style>

      {/* ── Payment method modal ── */}
      {paymentModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
          onClick={() => setPaymentModal(null)}>
          <div style={{ background:'#0d1525', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, padding:28, width:'100%', maxWidth:400, position:'relative', boxShadow:'0 24px 60px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setPaymentModal(null)} style={{ position:'absolute', top:16, right:16, background:'none', border:'none', color:'rgba(255,255,255,0.35)', cursor:'pointer', fontSize:20, lineHeight:1 }}>✕</button>
            <div style={{ fontWeight:800, fontSize:17, marginBottom:4 }}>Выберите способ оплаты</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.35)', marginBottom:22 }}>
              {paymentModal === 'month' ? 'Pro · 1 месяц' : 'Pro · 1 год (−34%)'}
            </div>
            {/* YooKassa */}
            <button
              onClick={() => handleBuyPlan(paymentModal)}
              disabled={buyingPlan !== null}
              style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'16px 20px', marginBottom:12, cursor:'pointer', display:'flex', alignItems:'center', gap:14, textAlign:'left', transition:'all .2s', fontFamily:'inherit' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
            >
              <div style={{ width:40, height:40, borderRadius:12, background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="1" y="4" width="22" height="16" rx="3" stroke="#60a5fa" strokeWidth="1.8"/><line x1="1" y1="10" x2="23" y2="10" stroke="#60a5fa" strokeWidth="1.8"/></svg>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#fff', marginBottom:2 }}>ЮКасса</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>
                  {buyingPlan ? 'Загрузка…' : (paymentModal === 'month' ? '199 ₽/мес · Карты РФ, СБП, ЮMoney' : '1 590 ₽/год · Карты РФ, СБП, ЮMoney')}
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
            {/* Crypto */}
            <button
              onClick={() => handleBuyCrypto(paymentModal)}
              disabled={buyingCrypto !== null}
              style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'16px 20px', cursor:'pointer', display:'flex', alignItems:'center', gap:14, textAlign:'left', transition:'all .2s', fontFamily:'inherit' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(249,115,22,0.5)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
            >
              <div style={{ width:40, height:40, borderRadius:12, background:'rgba(249,115,22,0.12)', border:'1px solid rgba(249,115,22,0.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#f97316" strokeWidth="1.8"/><path d="M9 12h6M12 9v6" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round"/></svg>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#fff', marginBottom:2 }}>Криптовалюта</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>
                  {buyingCrypto ? 'Загрузка…' : (paymentModal === 'month' ? '$2.99 · BTC, ETH, USDT, TON и 300+' : '$17.99 · BTC, ETH, USDT, TON и 300+')}
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
            <div style={{ marginTop:16, fontSize:11.5, color:'rgba(255,255,255,0.2)', textAlign:'center', lineHeight:1.5 }}>
              Безопасная оплата · Отмена в любое время
            </div>
          </div>
        </div>
      )}

      {/* ── Ambient glow ── */}
      <div style={{ position:'fixed', top:-200, left:'20%', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', pointerEvents:'none', zIndex:0 }} />
      <div style={{ position:'fixed', bottom:-100, right:'10%', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', pointerEvents:'none', zIndex:0 }} />

      {/* ════════════════ SIDEBAR ════════════════ */}
      <aside style={{
        width: 230, flexShrink: 0, height: '100vh', position: 'sticky', top: 0,
        background: 'rgba(255,255,255,0.025)',
        backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column',
        padding: '28px 16px', zIndex: 10,
      }}>
        {/* Logo */}
        <a href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none', marginBottom:36, paddingLeft:4 }}>
          <img src="/logo.png" alt="Centrio" width={32} height={32} style={{ borderRadius:9, objectFit:'contain' }} />
          <span style={{ fontWeight:800, fontSize:17, color:'#fff', letterSpacing:'-.025em' }}>Centrio</span>
        </a>

        {/* Navigation */}
        <nav style={{ display:'flex', flexDirection:'column', gap:4, flex:1 }}>
          <div style={{ fontSize:10.5, fontWeight:700, color:'rgba(255,255,255,0.25)', letterSpacing:'.09em', textTransform:'uppercase', marginBottom:6, paddingLeft:4 }}>
            Меню
          </div>
          {NAV.map(({ key, label, Icon }) => (
            <button
              key={key}
              className={`nav-item${tab === key ? ' active' : ''}`}
              onClick={() => setTab(key)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>

        {/* User card */}
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', paddingTop:18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, paddingLeft:2 }}>
            <div style={{
              width:36, height:36, borderRadius:10, flexShrink:0,
              background:`linear-gradient(135deg,${planColor},${planColor}aa)`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontWeight:800, fontSize:14, color:'#fff',
              boxShadow:`0 4px 12px ${planColor}55`,
            }}>
              {(user.name || user.email).charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow:'hidden', flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {user.name || user.email.split('@')[0]}
              </div>
              <span className="badge" style={{ background:`${planColor}22`, color:planColor, border:`1px solid ${planColor}44` }}>
                {PLAN_LABELS[user.plan || 'FREE']}
              </span>
            </div>
          </div>
          <button className="btn-ghost" style={{ width:'100%', justifyContent:'center', fontSize:12.5 }} onClick={() => { logout(); router.push('/') }}>
            <IcoLogout /> Выйти
          </button>
        </div>
      </aside>

      {/* ════════════════ MAIN ════════════════ */}
      <main style={{ flex:1, minHeight:'100vh', overflowY:'auto', padding:'36px 32px', position:'relative', zIndex:1 }}>

        {/* ──────────── OVERVIEW ──────────── */}
        {tab === 'overview' && (
          <div>
            {/* Page header */}
            <div style={{ marginBottom:32 }}>
              <h1 style={{ fontSize:24, fontWeight:800, letterSpacing:'-.03em', marginBottom:6 }}>
                {new Date().getHours() < 12 ? 'Доброе утро' : new Date().getHours() < 17 ? 'Добрый день' : 'Добрый вечер'}
                {user.name ? `, ${user.name.split(' ')[0]}` : ''}
              </h1>
              <p style={{ color:'rgba(255,255,255,0.38)', fontSize:13.5 }}>
                Статистика использования Centrio
              </p>
            </div>

            {/* No data banner */}
            {!loadingStats && stats && stats.total.appTime === 0 && (
              <div style={{ ...glassBlue, padding:'18px 22px', marginBottom:28, display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ width:40, height:40, borderRadius:12, background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:14, marginBottom:2 }}>Установите приложение</div>
                  <div style={{ fontSize:12.5, color:'rgba(255,255,255,0.45)' }}>После установки Centrio здесь появится статистика</div>
                </div>
                <a href="/download/windows" className="btn-primary" style={{ textDecoration:'none' }}>
                  Скачать <IcoArrow />
                </a>
              </div>
            )}

            {/* Stat cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
              {[
                {
                  label: 'Время сегодня',
                  value: loadingStats ? '...' : fmtTime(stats?.today.appTime || 0),
                  sub: `За неделю: ${fmtTime(stats?.week.appTime || 0)}`,
                  color: '#3b82f6',
                  Icon: IcoTime,
                },
                {
                  label: 'Уведомлений',
                  value: loadingStats ? '...' : (stats?.total.notifCount || 0).toLocaleString(),
                  sub: `Сегодня: ${stats?.today.notifCount || 0}`,
                  color: '#818cf8',
                  Icon: IcoBell,
                },
                {
                  label: 'Сообщений',
                  value: loadingStats ? '...' : (stats?.total.msgSent || 0).toLocaleString(),
                  sub: `Получено: ${(stats?.total.msgReceived || 0).toLocaleString()}`,
                  color: '#38bdf8',
                  Icon: IcoMsg,
                },
                {
                  label: 'Дней подряд',
                  value: loadingStats ? '...' : `${stats?.streak || 0}`,
                  sub: 'Streak',
                  color: '#f472b6',
                  Icon: IcoFlame,
                },
              ].map((s, i) => (
                <div key={s.label} className="stat-card" style={{ animationDelay:`${i*0.07}s` }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
                    <div style={{ fontSize:11.5, color:'rgba(255,255,255,0.4)', fontWeight:500, letterSpacing:'.02em' }}>{s.label}</div>
                    <div style={{ width:34, height:34, borderRadius:10, background:`${s.color}18`, border:`1px solid ${s.color}35`, display:'flex', alignItems:'center', justifyContent:'center', color:s.color }}>
                      <s.Icon />
                    </div>
                  </div>
                  <div style={{ fontSize:30, fontWeight:800, color:'#fff', letterSpacing:'-.03em', marginBottom:4, lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.28)' }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Chart + Services */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20, marginBottom:20 }}>
              {/* Activity chart */}
              <div className="glass-card" style={{ padding:28 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15.5 }}>Активность</div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,0.35)', marginTop:2 }}>За последние 7 дней</div>
                  </div>
                  <div style={{ fontSize:11, color:'rgba(59,130,246,0.8)', background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', padding:'4px 10px', borderRadius:8 }}>
                    Мин / день
                  </div>
                </div>
                {loadingStats ? (
                  <div style={{ height:140, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.2)', fontSize:13 }}>Загрузка...</div>
                ) : (
                  <div style={{ display:'flex', alignItems:'flex-end', gap:10, height:140 }}>
                    {(stats?.chart || Array(7).fill({ label:'', minutes:0 })).map((day, i) => {
                      const pct = chartMax > 0 ? (day.minutes / chartMax) : 0
                      const h = Math.max(pct * 100, day.minutes > 0 ? 6 : 3)
                      return (
                        <div key={i} className="bar-col">
                          <div style={{ width:'100%', height:120, display:'flex', alignItems:'flex-end' }}>
                            <div
                              className="bar-fill"
                              title={`${day.minutes} мин`}
                              style={{
                                height:`${h}%`,
                                background: day.minutes > 0
                                  ? 'linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)'
                                  : 'rgba(255,255,255,0.05)',
                                minHeight: 3,
                                boxShadow: day.minutes > 0 ? '0 0 12px rgba(59,130,246,0.3)' : 'none',
                              }}
                            />
                          </div>
                          <span style={{ fontSize:10.5, color:'rgba(255,255,255,0.3)', textTransform:'capitalize' }}>{day.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Services */}
              <div className="glass-card" style={{ padding:28 }}>
                <div style={{ fontWeight:700, fontSize:15.5, marginBottom:6 }}>Мессенджеры</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.35)', marginBottom:20 }}>Топ по времени</div>
                {loadingStats ? (
                  <div style={{ color:'rgba(255,255,255,0.25)', fontSize:13 }}>Загрузка...</div>
                ) : !stats?.services.length ? (
                  <div style={{ color:'rgba(255,255,255,0.25)', fontSize:13, lineHeight:1.7 }}>
                    Статистика появится после установки приложения
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                    {stats.services.slice(0, 5).map(s => {
                      const maxMin = stats.services[0]?.minutes || 1
                      const pct = (s.minutes / maxMin) * 100
                      return (
                        <div key={s.name}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                            <span style={{ fontSize:13, fontWeight:500, textTransform:'capitalize', color:'rgba(255,255,255,0.8)' }}>{s.name}</span>
                            <span style={{ fontSize:11.5, color:'rgba(255,255,255,0.35)' }}>{fmtTime(s.minutes * 60)}</span>
                          </div>
                          <div style={{ height:5, background:'rgba(255,255,255,0.06)', borderRadius:3 }}>
                            <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#3b82f6,#60a5fa)', borderRadius:3, boxShadow:'0 0 8px rgba(59,130,246,0.4)', transition:'width .6s' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Summary strip */}
            <div style={{ ...glassBlue, padding:'22px 28px', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:0 }}>
              {[
                { label:'Всего в приложении', value: fmtTime(stats?.total.appTime || 0), Icon: IcoTime },
                { label:'Всего уведомлений',  value: (stats?.total.notifCount || 0).toLocaleString(), Icon: IcoBell },
                { label:'Всего сообщений',    value: ((stats?.total.msgSent||0)+(stats?.total.msgReceived||0)).toLocaleString(), Icon: IcoMsg },
                { label:'Дней активности',    value: `${stats?.streak || 0}`, Icon: IcoFlame },
              ].map((s, i) => (
                <div key={s.label} style={{ paddingLeft: i > 0 ? 24 : 0, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.07)' : 'none', marginLeft: i > 0 ? 24 : 0 }}>
                  <div style={{ fontSize:11.5, color:'rgba(255,255,255,0.38)', marginBottom:6, display:'flex', alignItems:'center', gap:5 }}>
                    <s.Icon /> {s.label}
                  </div>
                  <div style={{ fontSize:22, fontWeight:800, letterSpacing:'-.02em' }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ──────────── DEVICES ──────────── */}
        {tab === 'devices' && (
          <div>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28, flexWrap:'wrap', gap:12 }}>
              <div>
                <h2 style={{ fontSize:22, fontWeight:800, letterSpacing:'-.03em', marginBottom:6 }}>Устройства</h2>
                <p style={{ color:'rgba(255,255,255,0.38)', fontSize:13.5 }}>
                  {isPro ? 'Все активные сессии вашего аккаунта' : 'Free план — 1 активное устройство'}
                </p>
              </div>
              <button
                className="btn-danger"
                onClick={handleLogoutAll}
                disabled={loggingOutAll}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                {loggingOutAll ? 'Выходим...' : 'Выйти на всех устройствах'}
              </button>
            </div>

            {!isPro && devices.length > 0 && (
              <div style={{ background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:14, padding:'14px 20px', marginBottom:20, display:'flex', alignItems:'center', gap:12 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0, color:'#fbbf24' }}><path d="M10.29 3.86L1.82 18A2 2 0 0 0 3.53 21H20.47A2 2 0 0 0 22.18 18L13.71 3.86A2 2 0 0 0 10.29 3.86Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                <span style={{ fontSize:13, color:'rgba(255,255,255,0.65)' }}>
                  На плане Free — только 1 устройство.{' '}
                  <button onClick={() => setTab('subscription')} style={{ background:'none', border:'none', color:'#60a5fa', cursor:'pointer', fontSize:13, padding:0, textDecoration:'underline', fontFamily:'inherit' }}>
                    Перейти на Pro
                  </button>
                </span>
              </div>
            )}

            {loadingDevices ? (
              <div style={{ display:'flex', alignItems:'center', gap:12, color:'rgba(255,255,255,0.3)', padding:'40px 0' }}>
                <div style={{ width:22, height:22, border:'2px solid rgba(59,130,246,0.25)', borderTopColor:'#3b82f6', borderRadius:'50%', animation:'spin .8s linear infinite' }} />
                Загружаем сессии...
              </div>
            ) : devices.length === 0 ? (
              <div style={{ textAlign:'center', padding:'70px 0', color:'rgba(255,255,255,0.25)' }}>
                <div style={{ width:60, height:60, borderRadius:18, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', color:'rgba(255,255,255,0.2)' }}>
                  <IcoDevices />
                </div>
                <div style={{ fontSize:16, fontWeight:600, marginBottom:6, color:'rgba(255,255,255,0.5)' }}>Нет активных сессий</div>
                <div style={{ fontSize:13 }}>Войдите в Centrio на устройстве и оно появится здесь</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {devices.map((device, idx) => (
                  <div key={device.id} className="device-row">
                    <div style={{ width:42, height:42, borderRadius:12, background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color:'#60a5fa' }}><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    </div>
                    <div style={{ flex:1, overflow:'hidden' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <span style={{ fontWeight:600, fontSize:14.5 }}>{device.label}</span>
                        {idx === 0 && (
                          <span className="badge" style={{ background:'rgba(59,130,246,0.15)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.3)' }}>
                            Текущая
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize:12, color:'rgba(255,255,255,0.35)' }}>
                        IP: {device.ipAddress} &nbsp;·&nbsp; Вход: {new Date(device.createdAt).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}
                      </div>
                    </div>
                    {idx !== 0 && (
                      <button className="btn-danger" onClick={() => handleRevoke(device.id)} disabled={revokingId === device.id} style={{ fontSize:12.5, padding:'7px 14px' }}>
                        {revokingId === device.id ? '...' : 'Отключить'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop:28, background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:'16px 20px', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ color:'rgba(59,130,246,0.6)', flexShrink:0 }}><IcoShield /></div>
              <div style={{ fontSize:12.5, color:'rgba(255,255,255,0.35)', lineHeight:1.65 }}>
                Если видите незнакомое устройство — немедленно отключите его и смените пароль.
                Сессии автоматически истекают через 30 дней.
              </div>
            </div>
          </div>
        )}

        {/* ──────────── SUBSCRIPTION ──────────── */}
        {tab === 'subscription' && (
          <div>
            <div style={{ marginBottom:28 }}>
              <h2 style={{ fontSize:22, fontWeight:800, letterSpacing:'-.03em', marginBottom:6 }}>Подписка</h2>
              <p style={{ color:'rgba(255,255,255,0.38)', fontSize:13.5 }}>Управляйте тарифным планом</p>
            </div>

            {/* Current plan */}
            <div style={{ ...glassBlue, padding:'22px 26px', marginBottom:28, display:'flex', alignItems:'center', gap:18 }}>
              <div style={{ width:48, height:48, borderRadius:14, background:`${planColor}20`, border:`1px solid ${planColor}40`, display:'flex', alignItems:'center', justifyContent:'center', color:planColor, flexShrink:0 }}>
                <IcoSubscription />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>
                  Текущий план:&nbsp;<span style={{ color:planColor }}>{PLAN_LABELS[user.plan || 'FREE']}</span>
                </div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.42)' }}>
                  {isPro
                    ? (user.planExpiresAt
                        ? `Активен до ${new Date(user.planExpiresAt).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}`
                        : 'Полный доступ ко всем функциям Centrio')
                    : 'Базовый доступ · до 5 мессенджеров'}
                </div>
              </div>
              {!isPro && (
                <button className="btn-primary" onClick={() => setPaymentModal('month')} disabled={buyingPlan !== null || buyingCrypto !== null}>
                  {(buyingPlan === 'month' || buyingCrypto === 'month') ? 'Загрузка…' : <>Купить Pro <IcoArrow /></>}
                </button>
              )}
            </div>

            {/* Auto-renew toggle (only for PRO users) */}
            {isPro && (
              <div className="glass-card" style={{ padding:'18px 24px', marginBottom:20, display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, marginBottom:3, display:'flex', alignItems:'center', gap:8 }}>
                    Автопродление
                    {autoRenew && <span style={{ fontSize:10, background:'rgba(34,197,94,0.15)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.3)', borderRadius:10, padding:'1px 8px' }}>Включено</span>}
                  </div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.38)', lineHeight:1.5 }}>
                    {hasMethod
                      ? (autoRenew ? 'Подписка продлится автоматически за 3 дня до истечения' : 'Сохранённый метод оплаты есть — можно включить')
                      : 'Оплатите подписку через ЮКассу, чтобы активировать автопродление'}
                  </div>
                </div>
                {hasMethod && (
                  <button onClick={toggleAutoRenew} disabled={togglingAR}
                    style={{ background: autoRenew ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${autoRenew ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`, borderRadius:10, padding:'9px 20px', color: autoRenew ? '#ef4444' : '#22c55e', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', opacity: togglingAR ? 0.6 : 1, transition:'all 0.2s' }}>
                    {togglingAR ? '...' : autoRenew ? 'Отключить' : 'Включить'}
                  </button>
                )}
              </div>
            )}

            {/* Plan cards */}
            <div style={{ display:'flex', gap:16, marginBottom:32 }}>
              {/* Free */}
              <div className={`plan-card${!isPro ? ' current-plan' : ''}`}>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Free</div>
                  <div style={{ fontSize:30, fontWeight:900, letterSpacing:'-.03em' }}>0 <span style={{ fontSize:16, fontWeight:400, color:'rgba(255,255,255,0.35)' }}>₽/мес</span></div>
                  {!isPro && <span className="badge" style={{ background:'rgba(100,116,139,0.2)', color:'#94a3b8', border:'1px solid rgba(100,116,139,0.3)', marginTop:8, display:'inline-block' }}>Текущий</span>}
                </div>
                <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', paddingTop:16, display:'flex', flexDirection:'column', gap:9 }}>
                  {['1 устройство', 'До 3 мессенджеров', 'Базовая синхронизация', 'Статистика'].map(f => (
                    <div key={f} style={{ display:'flex', alignItems:'center', gap:9, fontSize:13, color:'rgba(255,255,255,0.55)' }}>
                      <IcoCheck color="#64748b" /> {f}
                    </div>
                  ))}
                </div>
              </div>

              {/* Pro */}
              <div className={`plan-card pro${isPro && !isTeam ? ' current-plan' : ''}`}>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Pro</div>
                  <div style={{ fontSize:30, fontWeight:900, letterSpacing:'-.03em', color:'#fff' }}>199 <span style={{ fontSize:16, fontWeight:400, color:'rgba(255,255,255,0.35)' }}>₽/мес</span></div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.28)', marginTop:4 }}>или 1 590 ₽/год (−34%)</div>
                  {isPro && !isTeam && <span className="badge" style={{ background:'rgba(59,130,246,0.2)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.35)', marginTop:8, display:'inline-block' }}>Текущий</span>}
                </div>
                <div style={{ borderTop:'1px solid rgba(59,130,246,0.15)', paddingTop:16, display:'flex', flexDirection:'column', gap:9 }}>
                  {['До 5 устройств', 'Неограниченно мессенджеров', 'Облачная синхронизация', 'Расширенная статистика', 'Приоритетная поддержка'].map(f => (
                    <div key={f} style={{ display:'flex', alignItems:'center', gap:9, fontSize:13, color:'rgba(255,255,255,0.7)' }}>
                      <IcoCheck color="#3b82f6" /> {f}
                    </div>
                  ))}
                </div>
                {!isPro && (
                  <div style={{ marginTop:'auto', display:'flex', flexDirection:'column', gap:8 }}>
                    <button className="btn-primary" onClick={() => setPaymentModal('month')} disabled={buyingPlan !== null || buyingCrypto !== null}
                      style={{ fontSize:13, padding:'11px 16px' }}>
                      {buyingPlan === 'month' || buyingCrypto === 'month' ? '...' : '199 ₽/мес'}
                    </button>
                    <button className="btn-primary" onClick={() => setPaymentModal('year')} disabled={buyingPlan !== null || buyingCrypto !== null}
                      style={{ fontSize:13, padding:'11px 16px', background:'linear-gradient(135deg,#1d4ed8,#2563eb)', boxShadow:'0 4px 16px rgba(37,99,235,0.3)' }}>
                      {buyingPlan === 'year' || buyingCrypto === 'year' ? '...' : '1 590 ₽/год'}
                    </button>
                  </div>
                )}
              </div>

              {/* Team */}
              <div className={`plan-card team${isTeam ? ' current-plan' : ''}`}>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#22d3ee', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Team</div>
                  <div style={{ fontSize:30, fontWeight:900, letterSpacing:'-.03em' }}>699 <span style={{ fontSize:16, fontWeight:400, color:'rgba(255,255,255,0.35)' }}>₽/мес</span></div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.28)', marginTop:4 }}>за пользователя</div>
                  {isTeam && <span className="badge" style={{ background:'rgba(6,182,212,0.2)', color:'#22d3ee', border:'1px solid rgba(6,182,212,0.35)', marginTop:8, display:'inline-block' }}>Текущий</span>}
                </div>
                <div style={{ borderTop:'1px solid rgba(6,182,212,0.15)', paddingTop:16, display:'flex', flexDirection:'column', gap:9 }}>
                  {['Неограниченно устройств', 'Командное управление', 'Общие рабочие пространства', 'Аналитика команды', 'SLA-поддержка', 'API доступ'].map(f => (
                    <div key={f} style={{ display:'flex', alignItems:'center', gap:9, fontSize:13, color:'rgba(255,255,255,0.7)' }}>
                      <IcoCheck color="#06b6d4" /> {f}
                    </div>
                  ))}
                </div>
                {!isTeam && (
                  <button className="btn-primary" style={{ marginTop:'auto', background:'linear-gradient(135deg,#0891b2,#06b6d4)', boxShadow:'0 4px 20px rgba(6,182,212,0.3)', opacity:0.6, cursor:'not-allowed' }} disabled>
                    Скоро
                  </button>
                )}
              </div>
            </div>

            {/* Payment info */}
            <div className="glass-card" style={{ padding:'22px 26px', marginBottom:20 }}>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ color:'rgba(255,255,255,0.4)' }}><IcoCard /></div>
                Способы оплаты
              </div>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                {[
                  { label:'ЮKassa', sub:'Карты РФ, СБП, ЮMoney', active:true },
                  { label:'Криптовалюта', sub:'BTC, ETH, USDT, TON и 300+', active:true },
                  { label:'Карты EU/US', sub:'Скоро', active:false },
                ].map(m => (
                  <div key={m.label} style={{ background: m.active ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.04)', border: m.active ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'12px 18px' }}>
                    <div style={{ fontSize:13.5, fontWeight:600, marginBottom:2 }}>{m.label}</div>
                    <div style={{ fontSize:11.5, color: m.active ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.28)' }}>{m.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:14, fontSize:12, color:'rgba(255,255,255,0.22)', lineHeight:1.6 }}>
                Платежи защищены · ЮKassa · ИП Козловский А.С. · ИНН: 501908743800
              </div>
            </div>

            {/* Payment history */}
            <div className="glass-card" style={{ padding:'22px 26px' }}>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:16 }}>История платежей</div>
              {loadingPayments ? (
                <div style={{ color:'rgba(255,255,255,0.3)', fontSize:13 }}>Загрузка…</div>
              ) : payments.length === 0 ? (
                <div style={{ color:'rgba(255,255,255,0.25)', fontSize:13 }}>Платежей пока нет</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {payments.map((p: any) => {
                    const STATUS: Record<string, { label:string; color:string }> = {
                      SUCCEEDED: { label:'Оплачен', color:'#22c55e' },
                      PENDING:   { label:'Обрабатывается', color:'#f59e0b' },
                      FAILED:    { label:'Ошибка', color:'#ef4444' },
                      CANCELLED: { label:'Отменён', color:'#6b7280' },
                    }
                    const s = STATUS[p.status] || { label: p.status, color:'#6b7280' }
                    const months = p.months === 12 ? '12 мес (год)' : `${p.months} мес`
                    return (
                      <div key={p.id} style={{ display:'flex', alignItems:'center', gap:14, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'12px 16px' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13.5, fontWeight:600 }}>Centrio Pro · {months}</div>
                          <div style={{ fontSize:12, color:'rgba(255,255,255,0.35)', marginTop:2 }}>
                            {new Date(p.createdAt).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}
                          </div>
                        </div>
                        <div style={{ fontSize:14, fontWeight:700 }}>
                          {p.currency === 'USD' ? `$${p.amount}` : `${p.amount} ₽`}
                        </div>
                        <div style={{ fontSize:12, fontWeight:600, color: s.color, background: `${s.color}18`, border:`1px solid ${s.color}40`, borderRadius:8, padding:'4px 10px' }}>{s.label}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
