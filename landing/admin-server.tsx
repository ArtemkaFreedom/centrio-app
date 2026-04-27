'use client'

import React, { useState, useEffect, useCallback } from 'react'

const API         = process.env.NEXT_PUBLIC_API_URL || 'https://api.centrio.me'
const SESSION_KEY = 'centrio_admin_token'

// ─── Types ────────────────────────────────────────────────────────────────────
interface AdminUser {
  id: string; email: string; name: string | null; avatar: string | null
  plan: 'FREE' | 'PRO' | 'TEAM'; planExpiresAt: string | null
  isActive: boolean; isAdmin: boolean; lastSeenAt: string | null
  createdAt: string; online: boolean; provider: string
  messengers: number; folders: number; sessions: number
  autoRenew?: boolean
}
interface Stats { total: number; free: number; pro: number; team: number; onlineNow: number }
interface AppNotif {
  id: string; title: string; body: string; imageUrl: string | null
  actionLabel: string | null; actionUrl: string | null; createdAt: string
  _count?: { reads: number }
}
interface Visitor {
  id: string; visitorId: string; platform: string | null; appVersion: string | null
  firstSeenAt: string; lastSeenAt: string; sessions: number; messengersCount: number
  online: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtRelative(iso: string | null) {
  if (!iso) return 'никогда'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000)     return '< 1 мин назад'
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)} мин назад`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ч назад`
  return fmtDate(iso)
}

function PlanBadge({ plan }: { plan: string }) {
  const style: React.CSSProperties =
    plan === 'PRO'  ? { background: 'rgba(14,165,233,0.15)', color: '#0ea5e9', border: '1px solid rgba(14,165,233,0.4)' } :
    plan === 'TEAM' ? { background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.4)' } :
                      { background: '#1e1e1e', color: '#555', border: '1px solid #2a2a2a' }
  return <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 20, ...style }}>{plan}</span>
}

const S = {
  page:    { minHeight: '100vh', background: '#080810', color: '#e2e2e2', fontFamily: 'Inter, sans-serif', paddingBottom: 48 } as React.CSSProperties,
  header:  { background: '#0c0c14', borderBottom: '1px solid #141420', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 12 } as React.CSSProperties,
  card:    { background: '#0c0c14', border: '1px solid #141420', borderRadius: 12, overflow: 'hidden' } as React.CSSProperties,
  input:   { background: '#0c0c14', border: '1px solid #141420', borderRadius: 8, padding: '9px 14px', color: '#e2e2e2', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box' } as React.CSSProperties,
  textarea:{ background: '#0c0c14', border: '1px solid #141420', borderRadius: 8, padding: '9px 14px', color: '#e2e2e2', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box', resize: 'vertical' } as React.CSSProperties,
  btnPrimary: { background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' } as React.CSSProperties,
  btnGhost:   { background: 'transparent', border: '1px solid #1e1e2a', borderRadius: 8, padding: '6px 14px', color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif' } as React.CSSProperties,
  btnDanger:  { background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '4px 12px', color: '#ef4444', fontSize: 11, cursor: 'pointer', fontFamily: 'Inter, sans-serif' } as React.CSSProperties,
}

// ─── Login screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onAuth }: { onAuth: (t: string) => void }) {
  const [code, setCode]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    if (code.length < 6) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/api/admin/verify-totp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code.trim() }) })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Неверный код'); setCode(''); return }
      sessionStorage.setItem(SESSION_KEY, d.token)
      onAuth(d.token)
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080810', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 20, padding: 40, width: 380, display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 16px' }}>⚙</div>
          <h1 style={{ color: '#fff', margin: 0, fontSize: 22, fontWeight: 800 }}>Centrio Admin</h1>
          <p style={{ color: '#444', margin: '8px 0 0', fontSize: 13 }}>Введите код из Google Authenticator</p>
        </div>
        <form onSubmit={verify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000 000" maxLength={6} autoFocus
              style={{ width: '100%', background: '#0d0d14', border: `1.5px solid ${code.length === 6 ? '#6366f1' : '#1e1e1e'}`, borderRadius: 12, padding: '16px 0', color: '#fff', fontSize: 32, fontWeight: 800, letterSpacing: 14, textAlign: 'center', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box', transition: 'border-color 0.2s' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, height: 2, borderRadius: '0 0 12px 12px', background: '#6366f1', width: `${(code.length / 6) * 100}%`, transition: 'width 0.1s' }} />
          </div>
          {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, textAlign: 'center' }}>{error}</div>}
          <button type="submit" disabled={loading || code.length < 6}
            style={{ background: code.length === 6 ? '#6366f1' : '#1a1a22', color: code.length === 6 ? '#fff' : '#444', border: 'none', borderRadius: 12, padding: '13px 0', fontSize: 15, fontWeight: 700, cursor: code.length === 6 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all 0.2s' }}>
            {loading ? 'Проверка…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: USERS
// ═══════════════════════════════════════════════════════════════════════════════
function UsersTab({ token }: { token: string }) {
  const [users, setUsers]           = useState<AdminUser[]>([])
  const [stats, setStats]           = useState<Stats | null>(null)
  const [loading, setLoading]       = useState(false)
  const [search, setSearch]         = useState('')
  const [page, setPage]             = useState(1)
  const [pages, setPages]           = useState(1)
  const [total, setTotal]           = useState(0)
  const [editUser, setEditUser]     = useState<AdminUser | null>(null)
  const [editPlan, setEditPlan]     = useState('FREE')
  const [editExp, setEditExp]       = useState('')
  const [saving, setSaving]         = useState(false)
  const [msg, setMsg]               = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [userDetails, setUserDetails] = useState<Record<string, any>>({})

  const load = useCallback(async (pg = 1, q = '') => {
    setLoading(true)
    try {
      const params  = new URLSearchParams({ page: String(pg), limit: '50', ...(q ? { search: q } : {}) })
      const headers = { 'x-admin-token': token }
      const [ur, sr] = await Promise.all([
        fetch(`${API}/api/admin/users?${params}`, { headers }),
        fetch(`${API}/api/admin/stats`, { headers })
      ])
      if (ur.status === 403) return
      const ud = await ur.json(); const sd = await sr.json()
      setUsers(ud.users || []); setTotal(ud.total || 0); setPages(ud.pages || 1); setStats(sd)
    } finally { setLoading(false) }
  }, [token])

  useEffect(() => { load(1, '') }, [load])

  async function savePlan() {
    if (!editUser) return
    setSaving(true); setMsg('')
    try {
      const body: Record<string, string> = { plan: editPlan }
      if (editPlan !== 'FREE' && editExp) body.planExpiresAt = editExp
      const res = await fetch(`${API}/api/admin/users/${editUser.id}/plan`, { method: 'PATCH', headers: { 'x-admin-token': token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      if (res.ok) { setMsg('✓ Сохранено'); setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, plan: d.user.plan, planExpiresAt: d.user.planExpiresAt } : u)); setTimeout(() => { setEditUser(null); setMsg('') }, 1200) }
      else setMsg('❌ ' + (d.error || 'Ошибка'))
    } finally { setSaving(false) }
  }

  async function toggleActive(u: AdminUser) {
    await fetch(`${API}/api/admin/users/${u.id}/active`, { method: 'PATCH', headers: { 'x-admin-token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !u.isActive }) })
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: !x.isActive } : x))
  }

  async function deleteUser(u: AdminUser) {
    if (!window.confirm(`Удалить ${u.email}? Все данные будут стёрты.`)) return
    await fetch(`${API}/api/admin/users/${u.id}`, { method: 'DELETE', headers: { 'x-admin-token': token } })
    setUsers(prev => prev.filter(x => x.id !== u.id)); setTotal(t => t - 1)
  }

  async function toggleExpand(u: AdminUser) {
    const next = new Set(expandedIds)
    if (next.has(u.id)) { next.delete(u.id); setExpandedIds(next); return }
    next.add(u.id); setExpandedIds(next)
    if (!userDetails[u.id]) {
      try {
        const r = await fetch(`${API}/api/admin/users/${u.id}/payments`, { headers: { 'x-admin-token': token } })
        const d = await r.json()
        setUserDetails(prev => ({ ...prev, [u.id]: d }))
      } catch { setUserDetails(prev => ({ ...prev, [u.id]: { payments: [] } })) }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[{ label: 'Всего', val: stats.total, color: '#6366f1' }, { label: 'FREE', val: stats.free, color: '#555' }, { label: 'PRO', val: stats.pro, color: '#0ea5e9' }, { label: 'TEAM', val: stats.team, color: '#818cf8' }, { label: 'Онлайн', val: stats.onlineNow, color: '#22c55e' }].map(s => (
            <div key={s.label} style={{ background: '#0c0c14', border: '1px solid #141420', borderRadius: 12, padding: '12px 20px', minWidth: 110 }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color, letterSpacing: -1, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 11, color: '#333', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load(1, search) } }} placeholder="Поиск по email или имени…" style={{ ...S.input, flex: 1 }} />
        <button onClick={() => { setPage(1); load(1, search) }} style={S.btnPrimary}>Найти</button>
      </div>

      {/* Table */}
      <div style={S.card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #141420', background: '#0a0a12' }}>
                {['', 'Пользователь', 'План', 'Вход', 'Последний визит', 'Мессенджеров', 'Зарег.', 'Действия'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#2a2a3a', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#333' }}>Загрузка…</td></tr>}
              {!loading && users.length === 0 && <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#333' }}>Нет пользователей</td></tr>}
              {users.map(u => (
                <React.Fragment key={u.id}>
                  <tr style={{ borderBottom: '1px solid #0f0f18', opacity: u.isActive ? 1 : 0.4 }}>
                    <td style={{ padding: '10px 6px 10px 14px' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: u.online ? '#22c55e' : 'transparent', border: u.online ? 'none' : '1px solid #222' }} />
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {u.avatar ? <img src={u.avatar} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" /> : <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{(u.name || u.email).charAt(0).toUpperCase()}</div>}
                        <div>
                          <div style={{ color: '#ccc', fontWeight: 500 }}>{u.name || '—'}</div>
                          <div style={{ color: '#333', fontSize: 11 }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <PlanBadge plan={u.plan} />
                      {u.autoRenew && <span style={{ marginLeft: 4, fontSize: 9, color: '#22c55e' }} title="Автопродление">↻</span>}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#555', whiteSpace: 'nowrap' }}>{u.provider}</td>
                    <td style={{ padding: '10px 14px', color: '#444', whiteSpace: 'nowrap', fontSize: 12 }}>{fmtRelative(u.lastSeenAt)}</td>
                    <td style={{ padding: '10px 14px', color: '#444', textAlign: 'center' }}>{u.messengers}</td>
                    <td style={{ padding: '10px 14px', color: '#2a2a3a', whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(u.createdAt).split(',')[0]}</td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { setEditUser(u); setEditPlan(u.plan); setEditExp(u.planExpiresAt ? u.planExpiresAt.slice(0, 10) : ''); setMsg('') }} style={{ background: '#141420', border: '1px solid #1e1e2a', borderRadius: 6, padding: '4px 10px', color: '#aaa', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Изм. план</button>
                        <button onClick={() => toggleActive(u)} style={{ background: 'transparent', border: `1px solid ${u.isActive ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`, borderRadius: 6, padding: '4px 10px', color: u.isActive ? '#ef4444' : '#22c55e', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>{u.isActive ? 'Блок' : 'Разблок'}</button>
                        <button onClick={() => deleteUser(u)} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, padding: '4px 10px', color: '#ef4444', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Удалить</button>
                        <button onClick={() => toggleExpand(u)} style={{ background: 'transparent', border: '1px solid #1e1e2a', borderRadius: 6, padding: '4px 10px', color: expandedIds.has(u.id) ? '#6366f1' : '#444', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>{expandedIds.has(u.id) ? '▲' : '▼'}</button>
                      </div>
                    </td>
                  </tr>
                  {expandedIds.has(u.id) && (
                    <tr style={{ background: '#08080f' }}>
                      <td colSpan={8} style={{ padding: '0 14px 14px' }}>
                        <div style={{ border: '1px solid #141420', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                            {[{ label: 'ID', val: u.id }, { label: 'Последний визит', val: fmtDate(u.lastSeenAt) }, { label: 'Дата регистрации', val: fmtDate(u.createdAt) }, { label: 'Тариф', val: u.plan }, { label: 'Тариф до', val: u.planExpiresAt ? fmtDate(u.planExpiresAt) : '—' }, { label: 'Мессенджеров', val: String(u.messengers) }, { label: 'Папок', val: String(u.folders) }, { label: 'Сессий', val: String(u.sessions) }, { label: 'Вход через', val: u.provider }, { label: 'Активен', val: u.isActive ? 'Да' : 'Нет' }, { label: 'Автопродление', val: u.autoRenew ? '✓ Да' : 'Нет' }].map(item => (
                              <div key={item.label} style={{ background: '#0c0c14', borderRadius: 8, padding: '8px 12px' }}>
                                <div style={{ fontSize: 10, color: '#2a2a3a', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{item.label}</div>
                                <div style={{ fontSize: 12, color: '#888', wordBreak: 'break-all' }}>{item.val}</div>
                              </div>
                            ))}
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: '#2a2a3a', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>История платежей</div>
                            {!userDetails[u.id] ? <div style={{ color: '#333', fontSize: 12 }}>Загрузка…</div>
                            : (userDetails[u.id]?.payments || []).length === 0 ? <div style={{ color: '#2a2a3a', fontSize: 12 }}>Платежей нет</div>
                            : (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead><tr>{['Дата', 'Сумма', 'Статус', 'Тариф', 'Месяцев'].map(h => <th key={h} style={{ textAlign: 'left', padding: '4px 10px', color: '#2a2a3a', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
                                <tbody>
                                  {(userDetails[u.id]?.payments || []).map((p: any) => (
                                    <tr key={p.id} style={{ borderTop: '1px solid #0f0f18' }}>
                                      <td style={{ padding: '5px 10px', color: '#555' }}>{fmtDate(p.createdAt)}</td>
                                      <td style={{ padding: '5px 10px', color: '#888' }}>{p.amount} {p.currency}</td>
                                      <td style={{ padding: '5px 10px' }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10, background: p.status === 'SUCCEEDED' ? 'rgba(34,197,94,0.1)' : p.status === 'PENDING' ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)', color: p.status === 'SUCCEEDED' ? '#22c55e' : p.status === 'PENDING' ? '#eab308' : '#ef4444' }}>{p.status}</span>
                                      </td>
                                      <td style={{ padding: '5px 10px', color: '#555' }}>{p.plan}</td>
                                      <td style={{ padding: '5px 10px', color: '#555' }}>{p.months}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <span style={{ color: '#2a2a3a', fontSize: 12 }}>Итого: {total}</span>
          {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => { setPage(p); load(p, search) }} style={{ background: p === page ? '#6366f1' : '#0c0c14', border: `1px solid ${p === page ? '#6366f1' : '#141420'}`, borderRadius: 6, padding: '4px 12px', color: p === page ? '#fff' : '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{p}</button>
          ))}
        </div>
      )}

      {/* Edit plan modal */}
      {editUser && (
        <div onClick={() => setEditUser(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0c0c14', border: '1px solid #1e1e2a', borderRadius: 20, padding: 28, width: 360, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>
            <h2 style={{ margin: 0, fontSize: 16, color: '#fff', fontWeight: 700 }}>Изменить план</h2>
            <div><div style={{ color: '#bbb', fontWeight: 500 }}>{editUser.name || '—'}</div><div style={{ color: '#333', fontSize: 12 }}>{editUser.email}</div></div>
            <div>
              <label style={{ color: '#333', fontSize: 11, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>План</label>
              <select value={editPlan} onChange={e => setEditPlan(e.target.value)} style={{ ...S.input }}>
                <option value="FREE">FREE</option><option value="PRO">PRO</option><option value="TEAM">TEAM</option>
              </select>
            </div>
            {editPlan !== 'FREE' && (
              <div>
                <label style={{ color: '#333', fontSize: 11, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Действует до</label>
                <input type="date" value={editExp} onChange={e => setEditExp(e.target.value)} style={{ ...S.input }} />
                <p style={{ color: '#2a2a3a', fontSize: 11, margin: '4px 0 0' }}>Пусто — автоматически +1 год</p>
              </div>
            )}
            {msg && <p style={{ margin: 0, fontSize: 13, color: msg.startsWith('✓') ? '#22c55e' : '#ef4444' }}>{msg}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEditUser(null)} style={{ ...S.btnGhost, flex: 1 }}>Отмена</button>
              <button onClick={savePlan} disabled={saving} style={{ ...S.btnPrimary, flex: 2, opacity: saving ? 0.6 : 1 }}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════
function NotificationsTab({ token }: { token: string }) {
  const [notifs, setNotifs]         = useState<AppNotif[]>([])
  const [loading, setLoading]       = useState(false)
  const [showForm, setShowForm]     = useState(false)
  const [previewId, setPreviewId]   = useState<string | null>(null)
  const [search, setSearch]         = useState('')

  // Form state
  const [title, setTitle]           = useState('')
  const [body, setBody]             = useState('')
  const [imageUrl, setImageUrl]     = useState('')
  const [actionLabel, setActionLabel] = useState('')
  const [actionUrl, setActionUrl]   = useState('')
  const [sending, setSending]       = useState(false)
  const [sendMsg, setSendMsg]       = useState('')

  const headers = { 'x-admin-token': token, 'Content-Type': 'application/json' }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/admin/notifications`, { headers: { 'x-admin-token': token } })
      const d = await r.json()
      setNotifs(Array.isArray(d.notifications) ? d.notifications : [])
    } catch { setNotifs([]) } finally { setLoading(false) }
  }, [token])

  useEffect(() => { load() }, [load])

  async function sendNotif(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setSending(true); setSendMsg('')
    try {
      const res = await fetch(`${API}/api/admin/notifications`, {
        method: 'POST', headers,
        body: JSON.stringify({ title: title.trim(), body: body.trim(), imageUrl: imageUrl.trim() || undefined, actionLabel: actionLabel.trim() || undefined, actionUrl: actionUrl.trim() || undefined })
      })
      if (res.ok) {
        setSendMsg('✓ Отправлено всем пользователям')
        setTitle(''); setBody(''); setImageUrl(''); setActionLabel(''); setActionUrl('')
        load()
        setTimeout(() => { setSendMsg(''); setShowForm(false) }, 2500)
      } else { const d = await res.json(); setSendMsg('❌ ' + (d.error || 'Ошибка')) }
    } finally { setSending(false) }
  }

  async function deleteNotif(id: string) {
    await fetch(`${API}/api/admin/notifications/${id}`, { method: 'DELETE', headers: { 'x-admin-token': token } })
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  async function deleteAll() {
    if (!window.confirm('Удалить все уведомления у всех пользователей?')) return
    await Promise.all(notifs.map(n => fetch(`${API}/api/admin/notifications/${n.id}`, { method: 'DELETE', headers: { 'x-admin-token': token } })))
    setNotifs([])
  }

  const filtered = notifs.filter(n =>
    !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.body.toLowerCase().includes(search.toLowerCase())
  )

  const previewNotif = previewId ? notifs.find(n => n.id === previewId) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Top bar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setShowForm(v => !v)}
          style={{ ...S.btnPrimary, background: showForm ? '#4f46e5' : '#6366f1', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          Новое уведомление
        </button>
        <div style={{ flex: 1 }} />
        {notifs.length > 0 && (
          <>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск…" style={{ ...S.input, width: 200 }} />
            <button onClick={load} style={S.btnGhost}>↺</button>
            <button onClick={deleteAll} style={S.btnDanger}>🗑 Удалить все ({notifs.length})</button>
          </>
        )}
      </div>

      {/* Send form */}
      {showForm && (
        <div style={{ background: '#0c0c14', border: '1px solid #1e1e2a', borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#fff', fontWeight: 700 }}>Новое уведомление</h3>
          <form onSubmit={sendNotif} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Заголовок *" required style={S.input} />
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Текст уведомления *" required rows={3} style={S.textarea} />
            <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="URL изображения (необязательно)" style={S.input} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input value={actionLabel} onChange={e => setActionLabel(e.target.value)} placeholder="Текст кнопки" style={S.input} />
              <input value={actionUrl} onChange={e => setActionUrl(e.target.value)} placeholder="URL кнопки" style={S.input} />
            </div>

            {/* Live preview */}
            {(title || body) && (
              <div style={{ background: '#080810', border: '1px solid #1e1e2a', borderRadius: 10, padding: 14, marginTop: 4 }}>
                <div style={{ fontSize: 10, color: '#333', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Предпросмотр</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  {imageUrl && <img src={imageUrl} alt="" style={{ width: 42, height: 42, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#ccc' }}>{title || '—'}</div>
                    <div style={{ fontSize: 12, color: '#555', marginTop: 4, whiteSpace: 'pre-wrap' }}>{body}</div>
                    {actionLabel && <button style={{ marginTop: 8, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, padding: '4px 12px', color: '#818cf8', fontSize: 11, cursor: 'default', fontFamily: 'inherit' }}>{actionLabel}</button>}
                  </div>
                </div>
              </div>
            )}

            {sendMsg && <div style={{ fontSize: 13, color: sendMsg.startsWith('✓') ? '#22c55e' : '#ef4444' }}>{sendMsg}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ ...S.btnGhost }}>Отмена</button>
              <button type="submit" disabled={sending || !title.trim() || !body.trim()} style={{ ...S.btnPrimary, opacity: sending ? 0.6 : 1 }}>{sending ? 'Отправка…' : `Отправить всем`}</button>
            </div>
          </form>
        </div>
      )}

      {/* Notifications list */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#333' }}>Загрузка…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#2a2a3a', fontSize: 14 }}>
          {search ? 'Ничего не найдено' : 'Уведомлений нет'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ color: '#333', fontSize: 12, marginBottom: 4 }}>Всего: {notifs.length}</div>
          {filtered.map(n => (
            <div key={n.id} style={{ background: '#0c0c14', border: '1px solid #141420', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start', transition: 'border-color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#1e1e2a')} onMouseLeave={e => (e.currentTarget.style.borderColor = '#141420')}>

              {n.imageUrl && <img src={n.imageUrl} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#ddd' }}>{n.title}</div>
                  {n._count && (
                    <span style={{ fontSize: 10, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '1px 7px', color: '#6366f1' }}>
                      {n._count.reads} прочитали
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#555', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>{n.body}</div>
                {n.actionLabel && (
                  <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 6, padding: '3px 10px' }}>
                    <span style={{ fontSize: 11, color: '#818cf8', fontWeight: 600 }}>{n.actionLabel}</span>
                    {n.actionUrl && <span style={{ fontSize: 10, color: '#444' }}>→ {n.actionUrl}</span>}
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#2a2a3a', marginTop: 8 }}>{fmtDate(n.createdAt)}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, alignItems: 'flex-end' }}>
                <button onClick={() => setPreviewId(previewId === n.id ? null : n.id)} style={{ ...S.btnGhost, fontSize: 11 }}>
                  {previewId === n.id ? 'Скрыть' : 'Детали'}
                </button>
                <button onClick={() => deleteNotif(n.id)} style={S.btnDanger}>Удалить</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewNotif && (
        <div onClick={() => setPreviewId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0c0c14', border: '1px solid #1e1e2a', borderRadius: 20, padding: 28, width: 440, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 24px 60px rgba(0,0,0,0.8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 15, color: '#fff', fontWeight: 700 }}>Просмотр уведомления</h2>
              <button onClick={() => setPreviewId(null)} style={{ background: 'none', border: 'none', color: '#444', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            {previewNotif.imageUrl && <img src={previewNotif.imageUrl} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 10 }} />}
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{previewNotif.title}</div>
            <div style={{ fontSize: 13, color: '#888', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{previewNotif.body}</div>
            {previewNotif.actionLabel && (
              <div>
                <button style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, padding: '6px 16px', color: '#818cf8', fontSize: 13, cursor: 'default', fontFamily: 'inherit' }}>{previewNotif.actionLabel}</button>
                {previewNotif.actionUrl && <div style={{ fontSize: 11, color: '#333', marginTop: 4 }}>{previewNotif.actionUrl}</div>}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: '#0a0a12', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, color: '#2a2a3a', textTransform: 'uppercase', marginBottom: 3 }}>Отправлено</div>
                <div style={{ fontSize: 12, color: '#666' }}>{fmtDate(previewNotif.createdAt)}</div>
              </div>
              <div style={{ background: '#0a0a12', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, color: '#2a2a3a', textTransform: 'uppercase', marginBottom: 3 }}>Прочитали</div>
                <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 700 }}>{previewNotif._count?.reads ?? '—'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setPreviewId(null)} style={{ ...S.btnGhost, flex: 1 }}>Закрыть</button>
              <button onClick={() => { deleteNotif(previewNotif.id); setPreviewId(null) }} style={{ ...S.btnDanger, flex: 1, padding: '9px 0' }}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: VISITORS
// ═══════════════════════════════════════════════════════════════════════════════
function VisitorsTab({ token }: { token: string }) {
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [loading, setLoading]   = useState(false)
  const [total, setTotal]       = useState(0)
  const [onlineNow, setOnlineNow] = useState(0)
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
  const [pages, setPages]       = useState(1)

  const load = useCallback(async (pg = 1, q = '') => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pg), limit: '50', ...(q ? { search: q } : {}) })
      const r = await fetch(`${API}/api/admin/visitors?${params}`, { headers: { 'x-admin-token': token } })
      if (!r.ok) return
      const d = await r.json()
      setVisitors(d.visitors || [])
      setTotal(d.total || 0)
      setPages(d.pages || 1)
      setOnlineNow(d.onlineNow || 0)
    } catch { } finally { setLoading(false) }
  }, [token])

  useEffect(() => { load(1, '') }, [load])

  const platformIcon = (p: string | null) => {
    if (!p) return '?'
    if (p === 'win32')  return '🪟'
    if (p === 'darwin') return '🍎'
    return '🐧'
  }

  const filtered = search
    ? visitors.filter(v => v.visitorId.includes(search) || (v.platform || '').includes(search) || (v.appVersion || '').includes(search))
    : visitors

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'Всего посетителей', val: total, color: '#6366f1' },
          { label: 'Онлайн сейчас',     val: onlineNow, color: '#22c55e' },
        ].map(s => (
          <div key={s.label} style={{ background: '#0c0c14', border: '1px solid #141420', borderRadius: 12, padding: '12px 20px', minWidth: 140 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, letterSpacing: -1, lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: 11, color: '#333', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>{s.label}</div>
          </div>
        ))}
        <div style={{ background: '#0c0c14', border: '1px solid #141420', borderRadius: 12, padding: '12px 20px', flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, color: '#333', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Описание</div>
          <div style={{ fontSize: 12, color: '#444', lineHeight: 1.6 }}>
            Анонимные пользователи, которые запустили приложение без входа в аккаунт.
            Идентификатор сохраняется локально в устройстве.
          </div>
        </div>
      </div>

      {/* Search + refresh */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load(1, search) } }}
          placeholder="Поиск по ID, платформе, версии…" style={{ ...S.input, flex: 1 }} />
        <button onClick={() => { setPage(1); load(1, search) }} style={S.btnPrimary}>Найти</button>
        <button onClick={() => load(page, search)} style={S.btnGhost}>↺</button>
      </div>

      {/* Table */}
      <div style={S.card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #141420', background: '#0a0a12' }}>
                {['', 'Visitor ID', 'Платформа', 'Версия', 'Первый визит', 'Последний визит', 'Сессий', 'Сервисов'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#2a2a3a', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#333' }}>Загрузка…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: '#2a2a3a', fontSize: 14 }}>Посетителей пока нет</td></tr>
              )}
              {filtered.map(v => (
                <tr key={v.id} style={{ borderBottom: '1px solid #0f0f18' }}>
                  <td style={{ padding: '10px 6px 10px 14px' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: v.online ? '#22c55e' : 'transparent', border: v.online ? 'none' : '1px solid #222' }} title={v.online ? 'Онлайн' : 'Офлайн'} />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#374151,#1f2937)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>👤</div>
                      <div>
                        <div style={{ color: '#888', fontSize: 11, fontFamily: 'monospace' }}>{v.visitorId.slice(0, 8)}…</div>
                        <div style={{ color: '#2a2a3a', fontSize: 10 }}>анонимный</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#666', fontSize: 16 }}>
                    <span title={v.platform || '—'}>{platformIcon(v.platform)}</span>
                    <span style={{ fontSize: 11, color: '#333', marginLeft: 6 }}>{v.platform || '—'}</span>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#555', fontSize: 11, fontFamily: 'monospace' }}>v{v.appVersion || '?'}</td>
                  <td style={{ padding: '10px 14px', color: '#2a2a3a', fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(v.firstSeenAt)}</td>
                  <td style={{ padding: '10px 14px', color: '#444', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtRelative(v.lastSeenAt)}</td>
                  <td style={{ padding: '10px 14px', color: '#555', textAlign: 'center' }}>{v.sessions}</td>
                  <td style={{ padding: '10px 14px', color: '#555', textAlign: 'center' }}>{v.messengersCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <span style={{ color: '#2a2a3a', fontSize: 12 }}>Итого: {total}</span>
          {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => { setPage(p); load(p, search) }}
              style={{ background: p === page ? '#6366f1' : '#0c0c14', border: `1px solid ${p === page ? '#6366f1' : '#141420'}`, borderRadius: 6, padding: '4px 12px', color: p === page ? '#fff' : '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null)
  const [tab, setTab]     = useState<'users' | 'notifications' | 'visitors'>('users')

  useEffect(() => { const t = sessionStorage.getItem(SESSION_KEY); if (t) setToken(t) }, [])

  function logout() { setToken(null); sessionStorage.removeItem(SESSION_KEY) }

  if (!token) return <LoginScreen onAuth={t => setToken(t)} />

  const tabs: { key: typeof tab; label: string; icon: string }[] = [
    { key: 'users',         label: 'Пользователи', icon: '👥' },
    { key: 'notifications', label: 'Уведомления',  icon: '🔔' },
    { key: 'visitors',      label: 'Посетители',   icon: '👁' },
  ]

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>⚙</div>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Centrio Admin</span>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 24, background: '#0a0a12', border: '1px solid #141420', borderRadius: 10, padding: '3px' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ background: tab === t.key ? '#6366f1' : 'transparent', color: tab === t.key ? '#fff' : '#444', border: 'none', borderRadius: 7, padding: '6px 16px', fontSize: 13, fontWeight: tab === t.key ? 700 : 400, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />
        <button onClick={logout} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '6px 14px', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Выйти</button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '24px 20px 0' }}>
        {tab === 'users'         && <UsersTab         token={token} />}
        {tab === 'notifications' && <NotificationsTab token={token} />}
        {tab === 'visitors'      && <VisitorsTab      token={token} />}
      </div>
    </div>
  )
}
