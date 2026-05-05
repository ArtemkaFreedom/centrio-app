'use client'

import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import Link from 'next/link'

export default function RefundPage() {
  return (
    <>
      <style>{`
        .refund-hero { padding: 64px 0 40px; text-align: center; }
        .refund-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.25); color: #60a5fa; border-radius: 20px; padding: 6px 16px; font-size: 13px; font-weight: 600; margin-bottom: 24px; }
        .refund-title { font-size: clamp(28px, 5vw, 44px); font-weight: 800; color: #fff; letter-spacing: -.03em; margin-bottom: 12px; }
        .refund-subtitle { font-size: 16px; color: rgba(255,255,255,0.45); max-width: 540px; margin: 0 auto; line-height: 1.6; }
        .refund-body { max-width: 760px; margin: 0 auto; padding: 0 24px 80px; }
        .refund-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; padding: 36px 40px; margin-bottom: 20px; }
        .refund-card h2 { font-size: 18px; font-weight: 700; color: #fff; margin: 0 0 16px; display: flex; align-items: center; gap: 10px; }
        .refund-card p, .refund-card li { font-size: 15px; color: rgba(255,255,255,0.55); line-height: 1.75; margin: 0 0 10px; }
        .refund-card ul { padding-left: 20px; margin: 10px 0; }
        .refund-card li { margin-bottom: 6px; }
        .refund-card strong { color: rgba(255,255,255,0.8); }
        .refund-tag { display: inline-block; background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.25); color: #4ade80; border-radius: 6px; padding: 2px 10px; font-size: 12px; font-weight: 600; margin-left: 4px; vertical-align: middle; }
        .refund-tag.orange { background: rgba(251,146,60,0.12); border-color: rgba(251,146,60,0.25); color: #fb923c; }
        .refund-contact { background: linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1)); border: 1px solid rgba(59,130,246,0.2); border-radius: 20px; padding: 32px 40px; text-align: center; }
        .refund-contact p { font-size: 15px; color: rgba(255,255,255,0.55); margin: 0 0 16px; line-height: 1.6; }
        .refund-contact a { color: #60a5fa; text-decoration: none; font-weight: 600; }
        .refund-contact a:hover { text-decoration: underline; }
        .refund-btn { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg,#1d4ed8,#3b82f6); color: #fff; font-weight: 700; font-size: 14px; padding: 11px 24px; border-radius: 10px; text-decoration: none; transition: all .22s; box-shadow: 0 4px 20px rgba(59,130,246,.35); }
        .refund-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 28px rgba(59,130,246,.5); }
        .divider { height: 1px; background: rgba(255,255,255,0.06); margin: 8px 0 20px; }
        @media (max-width: 600px) {
          .refund-card { padding: 24px 20px; }
          .refund-contact { padding: 24px 20px; }
        }
      `}</style>

      <SiteHeader />

      {/* Hero */}
      <div className="refund-hero">
        <div className="refund-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          Политика возврата
        </div>
        <h1 className="refund-title">Возврат средств</h1>
        <p className="refund-subtitle">Последнее обновление: апрель 2026 г.</p>
      </div>

      <div className="refund-body">

        {/* Annual refund */}
        <div className="refund-card">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Годовая подписка <span className="refund-tag">14 дней</span>
          </h2>
          <p>Мы предоставляем полный возврат средств за годовую подписку Centrio Pro в течение <strong>14 календарных дней</strong> с момента оплаты при соблюдении следующих условий:</p>
          <ul>
            <li>Запрос отправлен не позднее 14-го дня после оплаты</li>
            <li>Подписка не была активно использована (синхронизация, папки, более 3 сервисов)</li>
            <li>Не более одного возврата на аккаунт за 12 месяцев</li>
          </ul>
          <div className="divider" />
          <p style={{ margin: 0 }}>Возврат обрабатывается в течение <strong>5–10 рабочих дней</strong> и поступает на карту, с которой производилась оплата. Для крипто-платежей — возврат на указанный кошелёк.</p>
        </div>

        {/* Monthly refund */}
        <div className="refund-card">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Месячная подписка <span className="refund-tag orange">без возврата</span>
          </h2>
          <p>Месячные подписки <strong>не подлежат возврату</strong> после начала расчётного периода, так как доступ к Pro-функциям предоставляется немедленно после оплаты.</p>
          <p style={{ margin: 0 }}>
            Исключение: если вы оплатили подписку, но <strong>не получили доступ</strong> к Pro из-за технической ошибки на нашей стороне — обратитесь в поддержку, мы рассмотрим каждый случай индивидуально.
          </p>
        </div>

        {/* How to request */}
        <div className="refund-card">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Как запросить возврат
          </h2>
          <p>Для оформления возврата напишите нам:</p>
          <ul>
            <li>Email: <strong>support@centrio.me</strong></li>
            <li>Telegram: <strong>@centrioapp</strong></li>
          </ul>
          <p>В обращении укажите:</p>
          <ul>
            <li>Email аккаунта Centrio</li>
            <li>Дату и сумму платежа</li>
            <li>Причину возврата (необязательно, но поможет нам стать лучше)</li>
          </ul>
          <div className="divider" />
          <p style={{ margin: 0 }}>Время ответа: до <strong>24 часов</strong> для Pro-пользователей, до <strong>48 часов</strong> для остальных.</p>
        </div>

        {/* Crypto */}
        <div className="refund-card">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Крипто-платежи
          </h2>
          <p>Возврат по платежам в криптовалюте осуществляется в USDT (TRC-20) по курсу на момент оригинальной транзакции. Для возврата укажите адрес кошелька в обращении.</p>
          <p style={{ margin: 0 }}>Сетевые комиссии при возврате не компенсируются.</p>
        </div>

        {/* Contact CTA */}
        <div className="refund-contact">
          <p>Есть вопросы по возврату или другим темам?<br />Мы всегда рады помочь.</p>
          <a href="mailto:support@centrio.me" className="refund-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            support@centrio.me
          </a>
        </div>

        {/* Links */}
        <div style={{ marginTop: 32, display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/terms"   style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Условия использования</Link>
          <Link href="/privacy" style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Политика конфиденциальности</Link>
          <Link href="/pricing" style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Тарифы</Link>
        </div>
      </div>

      <SiteFooter />
    </>
  )
}
