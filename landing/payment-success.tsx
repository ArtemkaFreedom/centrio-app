'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

const PLAN_LABELS: Record<string, string> = { month: '1 месяц', year: '1 год' }

function PaymentSuccessInner() {
  const params   = useSearchParams()
  const router   = useRouter()
  const plan     = params.get('plan') || 'month'
  const payId    = params.get('paymentId') || ''
  const { setUser } = useAuthStore()

  const [status, setStatus] = useState<'loading' | 'success' | 'pending' | 'error'>('loading')

  // Обновляем план в сторе из API (webhook уже успел обновить базу)
  async function refreshUser() {
    try {
      const { data } = await api.get('/api/user/profile')
      if (data?.id) setUser(data)
    } catch {}
  }

  useEffect(() => {
    async function verify() {
      try {
        if (payId) {
          const { data } = await api.get(`/api/payments/status/${payId}`)
          const ykStatus = data?.data?.ykStatus
          if (ykStatus === 'succeeded') { await refreshUser(); setStatus('success'); return }
          if (ykStatus === 'pending' || ykStatus === 'waiting_for_capture') { setStatus('pending'); return }
          setStatus('error'); return
        }
        // Нет paymentId — ЮКасса не всегда передаёт его в return_url
        await refreshUser()
        setStatus('success')
      } catch {
        await refreshUser()
        setStatus('success')
      }
    }
    verify()
  }, [payId]) // eslint-disable-line

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', -apple-system, sans-serif",
      color: '#fff',
      padding: 24
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24,
        padding: '48px 56px',
        maxWidth: 480,
        width: '100%',
        textAlign: 'center'
      }}>
        {status === 'loading' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 20 }}>⏳</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Проверяем платёж…</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>Подождите секунду</div>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'rgba(34,197,94,0.12)',
              border: '1px solid rgba(34,197,94,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36, margin: '0 auto 24px'
            }}>✓</div>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-.03em', marginBottom: 10 }}>
              Оплата прошла!
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
              Centrio Pro на <strong style={{ color: '#fff' }}>{PLAN_LABELS[plan]}</strong> активирован.<br />
              Все функции уже доступны в приложении.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => router.push('/dashboard')}
                style={{
                  background: 'linear-gradient(135deg,#2563eb,#3b82f6)',
                  color: '#fff', border: 'none', borderRadius: 12,
                  padding: '14px 28px', fontSize: 15, fontWeight: 700,
                  cursor: 'pointer', boxShadow: '0 4px 20px rgba(59,130,246,0.35)'
                }}
              >
                Перейти в личный кабинет →
              </button>
              <button
                onClick={() => router.push('/')}
                style={{
                  background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                  padding: '12px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer'
                }}
              >
                На главную
              </button>
            </div>
          </>
        )}

        {status === 'pending' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 20 }}>🕐</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Обрабатывается</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
              Платёж обрабатывается банком.<br />
              Обычно это занимает до 5 минут.<br />
              Подписка активируется автоматически.
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                background: 'rgba(255,255,255,0.08)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12,
                padding: '13px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer'
              }}
            >
              Перейти в личный кабинет
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 20 }}>❌</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Ошибка оплаты</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
              Платёж не был завершён.<br />
              Деньги не списаны. Попробуйте снова.
            </div>
            <button
              onClick={() => router.push('/pricing')}
              style={{
                background: 'linear-gradient(135deg,#2563eb,#3b82f6)',
                color: '#fff', border: 'none', borderRadius: 12,
                padding: '14px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer'
              }}
            >
              Попробовать снова
            </button>
          </>
        )}

        <div style={{ marginTop: 32, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          Оплата защищена · ЮKassa · ИП Козловский А.С.
        </div>
      </div>
    </div>
  )
}

export default function PaymentSuccess() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100vh', background:'#0a0a0f', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:40, height:40, border:'3px solid rgba(59,130,246,0.25)', borderTopColor:'#3b82f6', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <PaymentSuccessInner />
    </Suspense>
  )
}
