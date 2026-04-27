import Image from 'next/image';
import Link from 'next/link';

export const metadata = {
  title: 'Политика конфиденциальности — Centrio',
  description: 'Политика конфиденциальности приложения Centrio. Как мы собираем, используем и защищаем ваши данные.',
};

const pS: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', lineHeight: 1.8, fontSize: 15, marginBottom: 14 };
const ulS: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', lineHeight: 1.8, fontSize: 15, paddingLeft: 22, marginBottom: 14 };
const h2S: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 16, marginTop: 48, paddingBottom: 12, borderBottom: '1px solid rgba(59,130,246,0.15)', letterSpacing: '-.01em' };
const strongS: React.CSSProperties = { color: 'rgba(255,255,255,0.85)' };

export default function PrivacyPage() {
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
          <a href="/terms" className="nav-link">Условия</a>
        </div>
      </nav>

      <main style={{ maxWidth: 820, margin: '0 auto', padding: '64px 24px 96px' }}>
        {/* Header */}
        <div style={{ marginBottom: 52, paddingBottom: 32, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 50, padding: '5px 14px', fontSize: 12, fontWeight: 600, color: '#93c5fd', marginBottom: 20, letterSpacing: '.04em', textTransform: 'uppercase' }}>
            Правовые документы
          </div>
          <h1 style={{ fontSize: 'clamp(28px,4.5vw,46px)', fontWeight: 900, letterSpacing: '-.03em', marginBottom: 14, color: '#fff', lineHeight: 1.1 }}>
            Политика конфиденциальности
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>
            Дата вступления в силу: <span style={{ color: 'rgba(255,255,255,0.55)' }}>1 января 2025 года</span>
          </p>
          <p style={{ ...pS, marginTop: 20, fontSize: 16 }}>
            Настоящая Политика описывает, как <strong style={strongS}>ООО «Центрио»</strong> (далее — «Centrio», «мы») собирает, использует и защищает информацию при использовании приложения Centrio и связанных сервисов.
          </p>
        </div>

        {/* Content */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '36px 40px' }}>
          <h2 style={h2S}>1. Какие данные мы собираем</h2>
          <p style={pS}><strong style={strongS}>1.1 Данные аккаунта.</strong> При регистрации или входе через Google / Яндекс OAuth мы получаем адрес электронной почты, имя пользователя и аватар. Пароли не хранятся — аутентификация выполняется через защищённые OAuth-протоколы.</p>
          <p style={pS}><strong style={strongS}>1.2 Данные об использовании:</strong></p>
          <ul style={ulS}>
            <li>Список подключённых сервисов (названия, без содержимого переписок)</li>
            <li>Время последнего входа</li>
            <li>Статус подписки и дата оформления</li>
            <li>Версия приложения и история обновлений</li>
          </ul>
          <p style={pS}><strong style={strongS}>1.3 Технические данные.</strong> IP-адрес и User-Agent — для защиты от злоупотреблений. Не используются для профилирования.</p>
          <p style={pS}><strong style={strongS}>1.4 Данные синхронизации (Pro).</strong> Список мессенджеров, настройки тем, порядок вкладок — в зашифрованном виде.</p>
          <p style={pS}><strong style={strongS}>1.5 Что мы НЕ собираем.</strong> Содержимое переписок, пароли от мессенджеров, файлы с устройства, данные о платёжных картах.</p>

          <h2 style={h2S}>2. Как мы используем данные</h2>
          <ul style={ulS}>
            <li>Аутентификация и управление аккаунтом</li>
            <li>Предоставление функций облачной синхронизации (Pro)</li>
            <li>Отправка технических уведомлений об обновлениях</li>
            <li>Защита от несанкционированного доступа</li>
            <li>Улучшение приложения на основе агрегированной статистики</li>
          </ul>
          <p style={pS}>Мы не продаём ваши данные и не передаём их рекламным сетям.</p>

          <h2 style={h2S}>3. Хранение и безопасность</h2>
          <p style={pS}><strong style={strongS}>3.1 Серверы</strong> расположены в Европейском союзе.</p>
          <p style={pS}><strong style={strongS}>3.2 Шифрование.</strong> Все данные передаются по HTTPS/TLS. Синхронизированные данные хранятся в зашифрованном виде.</p>
          <p style={pS}><strong style={strongS}>3.3 Локальные данные.</strong> Сеансы мессенджеров хранятся на вашем устройстве в изолированном хранилище. У нас нет к ним доступа.</p>
          <p style={pS}><strong style={strongS}>3.4 Меры защиты:</strong></p>
          <ul style={ulS}>
            <li>Двухфакторная аутентификация для административных панелей</li>
            <li>JWT-токены с автоматическим обновлением</li>
            <li>Принцип минимальных привилегий для сотрудников</li>
          </ul>

          <h2 style={h2S}>4. Передача данных третьим лицам</h2>
          <p style={pS}>Мы не продаём и не передаём личные данные третьим лицам, кроме:</p>
          <ul style={ulS}>
            <li><strong style={strongS}>OAuth-провайдеры</strong> (Google, Яндекс) — только для аутентификации</li>
            <li><strong style={strongS}>Платёжные провайдеры</strong> — обработка платежей через сертифицированных партнёров</li>
            <li><strong style={strongS}>Требования закона</strong> — по официальному запросу уполномоченных органов</li>
          </ul>

          <h2 style={h2S}>5. Ваши права</h2>
          <ul style={ulS}>
            <li><strong style={strongS}>Доступ:</strong> получить копию ваших данных</li>
            <li><strong style={strongS}>Исправление:</strong> обновить неточные данные в профиле</li>
            <li><strong style={strongS}>Удаление:</strong> запросить удаление аккаунта и всех данных</li>
            <li><strong style={strongS}>Портативность:</strong> экспортировать данные в машиночитаемом формате</li>
            <li><strong style={strongS}>Отзыв согласия:</strong> прекратить синхронизацию в настройках</li>
          </ul>
          <p style={pS}>Для реализации прав: <strong style={strongS}>support@centrio.me</strong></p>

          <h2 style={h2S}>6. Cookie</h2>
          <p style={pS}>Электронное приложение Centrio не использует cookie. Веб-сайт centrio.me использует только технически необходимые cookie для поддержки сессии.</p>

          <h2 style={h2S}>7. Дети</h2>
          <p style={pS}>Сервис не предназначен для лиц младше 13 лет. Если нам стало известно о сборе данных ребёнка — мы немедленно удаляем их.</p>

          <h2 style={h2S}>8. Изменения политики</h2>
          <p style={pS}>При существенных изменениях мы уведомим вас по email и через уведомление в приложении не менее чем за 7 дней до вступления в силу.</p>

          <h2 style={h2S}>9. Контакты</h2>
          <p style={pS}>По вопросам обработки данных обращайтесь:</p>
          <ul style={ulS}>
            <li>Email: <strong style={strongS}>privacy@centrio.me</strong></li>
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
          <Link href="/terms" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontSize: 13 }}>Условия использования</Link>
          <Link href="/faq" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontSize: 13 }}>FAQ</Link>
          <Link href="/" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontSize: 13 }}>Главная</Link>
        </div>
      </footer>
    </div>
  );
}
