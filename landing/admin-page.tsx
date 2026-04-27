'use client'

import { useState, useEffect, useCallback } from 'react'

const API         = process.env.NEXT_PUBLIC_API_URL || 'https://api.centrio.me'
const SESSION_KEY = 'centrio_admin_token'

interface AdminUser {
  id: string
  email: string
  name: string | null
  avatar: string | null
  plan: 'FREE' | 'PRO' | 'TEAM'
  planExpiresAt: string | null
  isActive: boolean
  isAdmin: boolean
  lastSeenAt: string | null
  createdAt: string
  online: boolean
  provider: string
  messengers: number
  folders: number
  sessions: number
}

interface Stats {
  total: number
  free: number
  pro: number
  team: number
  onlineNow: number
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
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
  return (
    <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 20, ...style }}>
      {plan}
    </span>
  )
}

// ─── Экран входа (TOTP) ───────────────────────────────────────────────────────
function LoginScreen({ onAuth }: { onAuth: (token: string) => void }) {
  const [code, setCode]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    if (code.length < 6) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/api/admin/verify-totp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code: code.trim() })
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Неверный код'); setCode(''); return }
      sessionStorage.setItem(SESSION_KEY, d.token)
      onAuth(d.token)
    } finally { setLoading(false) }
  }

  const box: React.CSSProperties = {
    background: '#111', border: '1px solid #1e1e1e', borderRadius: 20,
    padding: 40, width: 380, display: 'flex', flexDirection: 'column', gap: 20,
    boxShadow: '0 24px 60px rgba(0,0,0,0.6)'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080810', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={box}>
        {/* Logo */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2))', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 16px' }}>⚙</div>
          <h1 style={{ color: '#fff', margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>Centrio Admin</h1>
          <p style={{ color: '#444', margin: '8px 0 0', fontSize: 13 }}>Введите код из Google Authenticator</p>
        </div>

        <form onSubmit={verify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000 000"
              maxLength={6}
              autoFocus
              style={{
                width: '100%', background: '#0d0d14', border: `1.5px solid ${code.length === 6 ? '#6366f1' : '#1e1e1e'}`,
                borderRadius: 12, padding: '16px 0', color: '#fff', fontSize: 32,
                fontWeight: 800, letterSpacing: 14, textAlign: 'center',
                outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box',
                transition: 'border-color 0.2s'
              }}
            />
            <div style={{ position: 'absolute', bottom: 0, left: 0, height: 2, borderRadius: '0 0 12px 12px', background: '#6366f1', width: `${(code.length / 6) * 100}%`, transition: 'width 0.1s' }} />
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || code.length < 6}
            style={{ background: code.length === 6 ? '#6366f1' : '#1a1a22', color: code.length === 6 ? '#fff' : '#444', border: 'none', borderRadius: 12, padding: '13px 0', fontSize: 15, fontWeight: 700, cursor: code.length === 6 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all 0.2s' }}>
            {loading ? 'Проверка…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Основная панель ──────────────────────────────────────────────────────────
export default function AdminPage() {
  const [token, setToken]       = useState<string | null>(null)
  const [users, setUsers]       = useState<AdminUser[]>([])
  const [stats, setStats]       = useState<Stats | null>(null)
  const [loading, setLoading]   = useState(false)
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
  const [pages, setPages]       = useState(1)
  const [total, setTotal]       = useState(0)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [editPlan, setEditPlan] = useState('FREE')
  const [editExp, setEditExp]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState('')

  useEffect(() => {
    const t = sessionStorage.getItem(SESSION_KEY)
    if (t) setToken(t)
  }, [])

  const load = useCallback(async (pg = 1, q = '', tk?: string) => {
    const t = tk || token
    if (!t) return
    setLoading(true)
    try {
      const params  = new URLSearchParams({ page: String(pg), limit: '50', ...(q ? { search: q } : {}) })
      const headers = { 'x-admin-token': t }
      const [ur, sr] = await Promise.all([
        fetch(`${API}/api/admin/users?${params}`, { headers }),
        fetch(`${API}/api/admin/stats`,            { headers })
      ])
      if (ur.status === 403) { setToken(null); sessionStorage.removeItem(SESSION_KEY); return }
      const ud = await ur.json()
      const sd = await sr.json()
      setUsers(ud.users || [])
      setTotal(ud.total  || 0)
      setPages(ud.pages  || 1)
      setStats(sd)
    } finally { setLoading(false) }
  }, [token])

  useEffect(() => { if (token) load(1, '', token) }, [token, load])

  function handleAuth(t: string) { setToken(t); load(1, '', t) }
  function logout() { setToken(null); sessionStorage.removeItem(SESSION_KEY) }

  async function savePlan() {
    if (!editUser || !token) return
    setSaving(true); setMsg('')
    try {
      const body: Record<string, string> = { plan: editPlan }
      if (editPlan !== 'FREE' && editExp) body.planExpiresAt = editExp
      const res = await fetch(`${API}/api/admin/users/${editUser.id}/plan`, {
        method:  'PATCH',
        headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body)
      })
      const d = await res.json()
      if (res.ok) {
        setMsg('✓ Сохранено')
        setUsers(prev => prev.map(u => u.id === editUser.id
          ? { ...u, plan: d.user.plan, planExpiresAt: d.user.planExpiresAt }
          : u
        ))
        setTimeout(() => { setEditUser(null); setMsg('') }, 1200)
      } else {
        setMsg('❌ ' + (d.error || 'Ошибка'))
      }
    } finally { setSaving(false) }
  }

  async function toggleActive(u: AdminUser) {
    if (!token) return
    await fetch(`${API}/api/admin/users/${u.id}/active`, {
      method:  'PATCH',
      headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ isActive: !u.isActive })
    })
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isActive: !x.isActive } : x))
  }

  if (!token) return <LoginScreen onAuth={handleAuth} />

  // ─── Панель ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#080810', color: '#e2e2e2', fontFamily: 'Inter, sans-serif', paddingBottom: 48 }}>

      {/* Header */}
      <div style={{ background: '#0c0c14', borderBottom: '1px solid #141420', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>⚙</div>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Centrio Admin</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => load(page, search)}
          style={{ background: '#141420', border: '1px solid #1e1e2a', borderRadius: 8, padding: '6px 14px', color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          ↺
        </button>
        <button onClick={logout}
          style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '6px 14px', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          Выйти
        </button>
      </div>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '24px 20px 0' }}>

        {/* Stats */}
        {stats && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Всего',   val: stats.total,     color: '#6366f1' },
              { label: 'FREE',    val: stats.free,      color: '#555'    },
              { label: 'PRO',     val: stats.pro,       color: '#0ea5e9' },
              { label: 'TEAM',    val: stats.team,      color: '#818cf8' },
              { label: 'Онлайн', val: stats.onlineNow, color: '#22c55e' },
            ].map(s => (
              <div key={s.label} style={{ background: '#0c0c14', border: '1px solid #141420', borderRadius: 12, padding: '12px 20px', minWidth: 110 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: s.color, letterSpacing: -1, lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 11, color: '#333', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load(1, search) } }}
            placeholder="Поиск по email или имени…"
            style={{ flex: 1, background: '#0c0c14', border: '1px solid #141420', borderRadius: 8, padding: '9px 14px', color: '#e2e2e2', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
          />
          <button onClick={() => { setPage(1); load(1, search) }}
            style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Найти
          </button>
        </div>

        {/* Table */}
        <div style={{ background: '#0c0c14', border: '1px solid #141420', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #141420', background: '#0a0a12' }}>
                  {['', 'Пользователь', 'План', 'Вход через', 'Последний визит', 'Мессенджеров', 'Зарег.', 'Действия'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#2a2a3a', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#333' }}>Загрузка…</td></tr>
                )}
                {!loading && users.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#333' }}>Нет пользователей</td></tr>
                )}
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #0f0f18', opacity: u.isActive ? 1 : 0.4 }}>
                    <td style={{ padding: '10px 6px 10px 14px' }}>
                      <div title={u.online ? 'Онлайн' : 'Офлайн'} style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: u.online ? '#22c55e' : 'transparent',
                        border: u.online ? 'none' : '1px solid #222'
                      }} />
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {u.avatar
                          ? <img src={u.avatar} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
                          : <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                              {(u.name || u.email).charAt(0).toUpperCase()}
                            </div>
                        }
                        <div>
                          <div style={{ color: '#ccc', fontWeight: 500 }}>{u.name || '—'}</div>
                          <div style={{ color: '#333', fontSize: 11 }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }}><PlanBadge plan={u.plan} /></td>
                    <td style={{ padding: '10px 14px', color: '#555', whiteSpace: 'nowrap' }}>{u.provider}</td>
                    <td style={{ padding: '10px 14px', color: '#444', whiteSpace: 'nowrap', fontSize: 12 }}>{fmtRelative(u.lastSeenAt)}</td>
                    <td style={{ padding: '10px 14px', color: '#444', textAlign: 'center' }}>{u.messengers}</td>
                    <td style={{ padding: '10px 14px', color: '#2a2a3a', whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(u.createdAt).split(',')[0]}</td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => { setEditUser(u); setEditPlan(u.plan); setEditExp(u.planExpiresAt ? u.planExpiresAt.slice(0, 10) : ''); setMsg('') }}
                          style={{ background: '#141420', border: '1px solid #1e1e2a', borderRadius: 6, padding: '4px 10px', color: '#aaa', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Изм. план
                        </button>
                        <button
                          onClick={() => toggleActive(u)}
                          style={{ background: 'transparent', border: `1px solid ${u.isActive ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`, borderRadius: 6, padding: '4px 10px', color: u.isActive ? '#ef4444' : '#22c55e', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {u.isActive ? 'Блок' : 'Разблок'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, justifyContent: 'center' }}>
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

      {/* Edit plan modal */}
      {editUser && (
        <div onClick={() => setEditUser(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#0c0c14', border: '1px solid #1e1e2a', borderRadius: 20, padding: 28, width: 360, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>
            <h2 style={{ margin: 0, fontSize: 16, color: '#fff', fontWeight: 700 }}>Изменить план</h2>
            <div>
              <div style={{ color: '#bbb', fontWeight: 500 }}>{editUser.name || '—'}</div>
              <div style={{ color: '#333', fontSize: 12 }}>{editUser.email}</div>
            </div>

            <div>
              <label style={{ color: '#333', fontSize: 11, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>План</label>
              <select value={editPlan} onChange={e => setEditPlan(e.target.value)}
                style={{ width: '100%', background: '#141420', border: '1px solid #1e1e2a', borderRadius: 8, padding: '9px 12px', color: '#e2e2e2', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}>
                <option value="FREE">FREE</option>
                <option value="PRO">PRO</option>
                <option value="TEAM">TEAM</option>
              </select>
            </div>

            {editPlan !== 'FREE' && (
              <div>
                <label style={{ color: '#333', fontSize: 11, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Действует до</label>
                <input type="date" value={editExp} onChange={e => setEditExp(e.target.value)}
                  style={{ width: '100%', background: '#141420', border: '1px solid #1e1e2a', borderRadius: 8, padding: '9px 12px', color: '#e2e2e2', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                <p style={{ color: '#2a2a3a', fontSize: 11, margin: '4px 0 0' }}>Пусто — автоматически +1 год</p>
              </div>
            )}

            {msg && <p style={{ margin: 0, fontSize: 13, color: msg.startsWith('✓') ? '#22c55e' : '#ef4444' }}>{msg}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setEditUser(null)}
                style={{ flex: 1, background: 'transparent', border: '1px solid #1e1e2a', borderRadius: 8, padding: '9px 0', color: '#444', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Отмена
              </button>
              <button onClick={savePlan} disabled={saving}
                style={{ flex: 2, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
