import Image from 'next/image';
import Link from 'next/link';

export const metadata = {
  title: 'Условия использования — Centrio',
  description: 'Условия использования приложения Centrio.',
};

const pS: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', lineHeight: 1.8, fontSize: 15, marginBottom: 14 };
const ulS: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', lineHeight: 1.8, fontSize: 15, paddingLeft: 22, marginBottom: 14 };
const h2S: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 16, marginTop: 48, paddingBottom: 12, borderBottom: '1px solid rgba(59,130,246,0.15)', letterSpacing: '-.01em' };
const strongS: React.CSSProperties = { color: 'rgba(255,255,255,0.85)' };

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#060a14', color: '#e2e2e2', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background:#060a14; }
        .nav-link { color:rgba(255,255,255,0.5); text-decoration:none; font-size:14px; font-weight:500; transition:color .2s; }
        .nav-link:hover { color:#fff; }
        li { margin-bottom:4px; }
      `}</style>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,10,20,0.88)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 40px', display: 'flex', alignItems: 'center', height: 64 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <Image src="/logo.png" alt="Centrio" width={28} height={28} style={{ objectFit: 'contain' }} />
          <span style={{ fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-.02em' }}>Centrio</span>
        </Link>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 28 }}>
          <a href="/faq" className="nav-link">FAQ</a>
          <a href="/privacy" className="nav-link">Конфиденциальность</a>
        </div>
      </nav>

      <main style={{ maxWidth: 820, margin: '0 auto', padding: '64px 24px 96px' }}>
        {/* Header */}
        <div style={{ marginBottom: 52, paddingBottom: 32, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 50, padding: '5px 14px', fontSize: 12, fontWeight: 600, color: '#93c5fd', marginBottom: 20, letterSpacing: '.04em', textTransform: 'uppercase' }}>
            Правовые документы
          </div>
          <h1 style={{ fontSize: 'clamp(28px,4.5vw,46px)', fontWeight: 900, letterSpacing: '-.03em', marginBottom: 14, color: '#fff', lineHeight: 1.1 }}>
            Условия использования
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>
            Дата вступления в силу: <span style={{ color: 'rgba(255,255,255,0.55)' }}>1 января 2025 года</span>
          </p>
          <p style={{ ...pS, marginTop: 20, fontSize: 16 }}>
            Используя приложение Centrio, вы соглашаетесь с настоящими Условиями использования, заключёнными с <strong style={strongS}>ООО «Центрио»</strong>. Пожалуйста, внимательно прочитайте их перед использованием сервиса.
          </p>
        </div>

        {/* Content */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '36px 40px' }}>
          <h2 style={h2S}>1. Описание сервиса</h2>
          <p style={pS}>Centrio — это десктопное приложение (Windows), которое позволяет объединить несколько веб-версий мессенджеров и онлайн-сервисов в одном окне. Приложение работает как оболочка (container) над веб-приложениями третьих сторон.</p>

          <h2 style={h2S}>2. Регистрация и аккаунт</h2>
          <p style={pS}><strong style={strongS}>2.1</strong> Для использования облачной синхронизации (Pro) требуется аккаунт Centrio. Регистрация доступна через email или OAuth (Google, Яндекс).</p>
          <p style={pS}><strong style={strongS}>2.2</strong> Вы несёте ответственность за сохранность данных своего аккаунта и за все действия, совершённые под вашим аккаунтом.</p>
          <p style={pS}><strong style={strongS}>2.3</strong> Вы обязуетесь указать корректный email-адрес и своевременно обновлять его при изменении.</p>

          <h2 style={h2S}>3. Допустимое использование</h2>
          <p style={pS}>При использовании Centrio запрещается:</p>
          <ul style={ulS}>
            <li>Нарушать законы Российской Федерации или международное право</li>
            <li>Распространять вредоносное программное обеспечение</li>
            <li>Осуществлять несанкционированный доступ к системам третьих лиц</li>
            <li>Реверс-инжинирить или декомпилировать приложение</li>
            <li>Использовать приложение для рассылки спама или незаконной рекламы</li>
          </ul>

          <h2 style={h2S}>4. Подписка и оплата</h2>
          <p style={pS}><strong style={strongS}>4.1 Бесплатная версия</strong> позволяет подключить до 3 сервисов без временных ограничений.</p>
          <p style={pS}><strong style={strongS}>4.2 Centrio Pro</strong> предоставляет расширенный функционал по подписке (месячной или годовой). Стоимость указана на странице <Link href="/pricing" style={{ color: '#60a5fa' }}>centrio.me/pricing</Link>.</p>
          <p style={pS}><strong style={strongS}>4.3 Отмена подписки.</strong> Вы можете отменить подписку в любой момент. Оплаченный период истекает в конце текущего срока, новых списаний не будет.</p>
          <p style={pS}><strong style={strongS}>4.4 Возврат средств</strong> возможен в течение 7 дней с момента оплаты при обращении в поддержку.</p>

          <h2 style={h2S}>5. Интеллектуальная собственность</h2>
          <p style={pS}>Все права на приложение Centrio, его дизайн и логотип принадлежат ООО «Центрио». Использование наших товарных знаков без письменного разрешения запрещено.</p>
          <p style={pS}>Третьи стороны (мессенджеры, сервисы), отображаемые в Centrio, имеют собственные товарные знаки, которые принадлежат их правообладателям.</p>

          <h2 style={h2S}>6. Ограничение ответственности</h2>
          <p style={pS}>Centrio предоставляется «как есть» (as is). Мы не несём ответственности:</p>
          <ul style={ulS}>
            <li>За доступность и работу сторонних сервисов (Telegram, WhatsApp и др.)</li>
            <li>За потерю данных, вызванную действиями третьих лиц</li>
            <li>За косвенные убытки, упущенную выгоду</li>
          </ul>
          <p style={pS}>Наша ответственность ограничена суммой, уплаченной вами за подписку за последние 12 месяцев.</p>

          <h2 style={h2S}>7. Прекращение доступа</h2>
          <p style={pS}>Мы вправе приостановить или прекратить доступ к аккаунту при нарушении настоящих Условий. При этом оплаченная часть подписки возвращается пропорционально.</p>

          <h2 style={h2S}>8. Изменение условий</h2>
          <p style={pS}>Мы уведомим вас об изменениях не позднее чем за 7 дней по email или в приложении. Продолжение использования после вступления изменений в силу означает согласие с ними.</p>

          <h2 style={h2S}>9. Применимое право</h2>
          <p style={pS}>Настоящие Условия регулируются законодательством Российской Федерации. Споры решаются в судах общей юрисдикции по месту нахождения ООО «Центрио».</p>

          <h2 style={h2S}>10. Контакты</h2>
          <ul style={ulS}>
            <li>Email: <strong style={strongS}>support@centrio.me</strong></li>
            <li>Telegram: <strong style={strongS}>@centrioapp</strong></li>
            <li>Компания: <strong style={strongS}>ООО «Центрио»</strong></li>
          </ul>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '28px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image src="/logo.png" alt="Centrio" width={20} height={20} style={{ objectFit: 'contain' }} />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>© 2026 Centrio. Все права защищены.</span>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <Link href="/privacy" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontSize: 13 }}>Конфиденциальность</Link>
          <Link href="/faq" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontSize: 13 }}>FAQ</Link>
          <Link href="/" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontSize: 13 }}>Главная</Link>
        </div>
      </footer>
    </div>
  );
}
