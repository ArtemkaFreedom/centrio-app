import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Centrio vs Rambox: сравнение агрегаторов мессенджеров 2026',
  description: 'Подробное сравнение Centrio и Rambox — двух популярных агрегаторов мессенджеров. Цены, функции, производительность, поддерживаемые сервисы. Что выбрать в 2026 году?',
  alternates: { canonical: 'https://centrio.me/blog/vs-rambox' },
  openGraph: {
    title: 'Centrio vs Rambox 2026: полное сравнение',
    description: 'Centrio против Rambox — кто победит? Сравниваем цены, функции и производительность двух агрегаторов мессенджеров.',
    url: 'https://centrio.me/blog/vs-rambox',
    type: 'article',
  },
};

const WIN_DOWNLOAD = 'https://download.centrio.me/Centrio%20Setup%201.5.19.exe';

const tableData = [
  { feature: 'Бесплатный тариф', centrio: '✅ До 5 сервисов', rambox: '❌ Только пробный период' },
  { feature: 'Цена Pro/месяц', centrio: '✅ 199 ₽ (~2.2$)', rambox: '❌ $7 (650+ ₽)' },
  { feature: 'Цена Pro/год', centrio: '✅ 1 590 ₽ (~17.5$)', rambox: '❌ $84 (7 700+ ₽)' },
  { feature: 'Количество сервисов', centrio: '✅ 100+', rambox: '⚠️ 100+ (многие устарели)' },
  { feature: 'Windows', centrio: '✅', rambox: '✅' },
  { feature: 'macOS', centrio: '✅', rambox: '✅' },
  { feature: 'Linux', centrio: '✅', rambox: '✅' },
  { feature: 'Встроенный VPN', centrio: '✅ (VLESS, VMess, Trojan, SS, Hysteria2)', rambox: '❌ Нет' },
  { feature: 'Производительность (RAM)', centrio: '✅ ~180 МБ', rambox: '❌ ~350 МБ' },
  { feature: 'Время запуска', centrio: '✅ ~2 сек', rambox: '❌ ~5–8 сек' },
  { feature: 'Российские сервисы (VK, OK)', centrio: '✅', rambox: '⚠️ Частично' },
  { feature: 'Прокси на сервис', centrio: '✅', rambox: '✅ (только Pro)' },
  { feature: 'Облачная синхронизация', centrio: '✅ Pro', rambox: '✅ Pro' },
  { feature: 'Автообновление', centrio: '✅', rambox: '✅' },
  { feature: 'Русскоязычная поддержка', centrio: '✅', rambox: '❌' },
  { feature: 'Интерфейс на русском', centrio: '✅', rambox: '❌' },
];

export default function VsRamboxPage() {
  return (
    <>
      <SiteHeader />
      <div style={{ minHeight: '100vh', background: '#080810', color: '#fff', fontFamily: "'Inter', sans-serif" }}>

        <section style={{ maxWidth: 860, margin: '0 auto', padding: '60px 24px 50px', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 500, marginBottom: 20 }}>
            Сравнение · 2026
          </div>
          <h1 style={{ fontSize: 'clamp(28px,5vw,52px)', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.15, margin: '0 0 20px' }}>
            Centrio vs Rambox:<br />
            <span style={{ background: 'linear-gradient(90deg,#818cf8,#c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>какой агрегатор выбрать?</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 17, lineHeight: 1.7, maxWidth: 620, margin: '0 auto 16px' }}>
            Подробное сравнение двух популярных агрегаторов мессенджеров — по цене, производительности, функциям и поддержке российских сервисов.
          </p>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Обновлено: апрель 2026 · Время чтения: ~5 мин</p>
        </section>

        <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px 80px' }}>
          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 16, color: '#e2e8f0' }}>Обзор</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '24px' }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rambox</div>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.7, margin: 0 }}>
                  Rambox — один из пионеров жанра, существует с 2016 года. Поддерживает более 100 сервисов, работает на Windows, macOS и Linux. Однако высокая цена Pro-подписки (от $7/мес) и отсутствие русскоязычного интерфейса делают его менее привлекательным для российской аудитории.
                </p>
              </div>
              <div style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.1))', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 16, padding: '24px' }}>
                <div style={{ fontSize: 13, color: '#a5b4fc', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Centrio</div>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.7, margin: 0 }}>
                  Centrio — современный агрегатор мессенджеров, созданный с фокусом на русскоязычных пользователей. Полностью русский интерфейс, встроенный VPN, поддержка VK и других отечественных сервисов, более доступная цена Pro (199 ₽/мес) и лучшая производительность.
                </p>
              </div>
            </div>
          </section>

          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 24, color: '#e2e8f0' }}>Сравнительная таблица</h2>
            <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <th style={{ padding: '14px 20px', textAlign: 'left', color: 'rgba(255,255,255,0.5)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Параметр</th>
                    <th style={{ padding: '14px 20px', textAlign: 'center', color: '#a5b4fc', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Centrio</th>
                    <th style={{ padding: '14px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Rambox</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row, i) => (
                    <tr key={row.feature} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '13px 20px', color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{row.feature}</td>
                      <td style={{ padding: '13px 20px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 500 }}>{row.centrio}</td>
                      <td style={{ padding: '13px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.6)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{row.rambox}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 24, color: '#e2e8f0' }}>Ключевые отличия</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { title: '💰 Цена — главное преимущество Centrio', text: 'Rambox Pro стоит от $7 в месяц или $84 в год — это более 650 ₽ и 7 700 ₽ соответственно по текущему курсу. Centrio Pro обходится всего в 199 ₽/месяц или 1 590 ₽/год. Разница в 3–5 раз делает Centrio очевидным выбором для пользователей, которые ценят соотношение цены и качества.' },
                { title: '🔒 Встроенный VPN — уникальная функция Centrio', text: 'Centrio — единственный агрегатор мессенджеров со встроенным VPN. Поддерживаются протоколы VLESS, VMess, Trojan, Shadowsocks и Hysteria2. Подключение работает на уровне всего приложения. В Rambox встроенного VPN нет.' },
                { title: '⚡ Производительность — Centrio быстрее', text: 'В тестах на стандартном ПК с 8 ГБ ОЗУ Centrio потребляет около 180 МБ оперативной памяти при 5 открытых сервисах, тогда как Rambox — около 350 МБ. Время запуска Centrio составляет ~2 секунды против 5–8 секунд у Rambox. Это особенно ощутимо на офисных компьютерах.' },
                { title: '🇷🇺 Поддержка российских сервисов', text: 'Centrio с самого начала создавался с акцентом на русскоязычных пользователей. Встроена поддержка ВКонтакте, Одноклассников, Яндекс.Мессенджера, Авито и других отечественных платформ. В Rambox эти сервисы либо отсутствуют, либо работают нестабильно.' },
                { title: '🆓 Бесплатный тариф', text: 'Centrio предлагает полноценный бесплатный тариф с поддержкой до 5 сервисов без временных ограничений. Rambox не имеет бесплатного тарифа — доступен только ограниченный пробный период.' },
              ].map((item) => (
                <div key={item.title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 24px' }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#e2e8f0' }}>{item.title}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, lineHeight: 1.7, margin: 0 }}>{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 20, color: '#e2e8f0' }}>Производительность</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>
              Оба приложения основаны на Electron, однако различаются в оптимизации. Centrio использует более агрессивную стратегию управления памятью: неактивные вкладки «замораживаются» и не потребляют ресурсы процессора.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              {[
                { metric: 'RAM (5 сервисов)', centrio: '~180 МБ', rambox: '~350 МБ' },
                { metric: 'Запуск', centrio: '~2 сек', rambox: '5–8 сек' },
                { metric: 'CPU в простое', centrio: '< 1%', rambox: '2–4%' },
              ].map((m) => (
                <div key={m.metric} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px', textAlign: 'center' }}>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m.metric}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#a5b4fc', marginBottom: 4 }}>Centrio</div>
                      <div style={{ fontWeight: 700, color: '#4ade80' }}>{m.centrio}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Rambox</div>
                      <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>{m.rambox}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 20, color: '#e2e8f0' }}>Сравнение цен</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '28px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rambox Pro</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#f87171', marginBottom: 4 }}>$7<span style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>/мес</span></div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 16 }}>или $84/год (~7 700 ₽)</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Нет бесплатного тарифа</div>
              </div>
              <div style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.12))', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 16, padding: '28px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#a5b4fc', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Centrio Pro</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#4ade80', marginBottom: 4 }}>199 ₽<span style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>/мес</span></div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 16 }}>или 1 590 ₽/год</div>
                <div style={{ color: '#4ade80', fontSize: 13, fontWeight: 600 }}>✅ Бесплатный тариф навсегда</div>
              </div>
            </div>
          </section>

          <section style={{ marginBottom: 56 }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 20, color: '#e2e8f0' }}>Вердикт</h2>
            <div style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.1))', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 20, padding: '32px' }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, lineHeight: 1.8, marginBottom: 16 }}>
                Rambox — зрелый продукт с длинной историей и широкой поддержкой платформ. Если вам нужна кроссплатформенная поддержка — оба приложения справятся. Однако высокая цена, отсутствие русского интерфейса, повышенное потребление ресурсов и отсутствие встроенного VPN — серьёзные минусы.
              </p>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, lineHeight: 1.8, margin: 0 }}>
                <strong style={{ color: '#a5b4fc' }}>Centrio побеждает</strong> по цене (в 3–5 раз дешевле), производительности, встроенному VPN, поддержке российских сервисов и удобству для русскоязычных пользователей.
              </p>
            </div>
          </section>

          <section style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Попробуйте Centrio бесплатно</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 28 }}>Скачайте и убедитесь сами — без ограничений по времени.</p>
            <a
              href={WIN_DOWNLOAD}
              style={{
                display: 'inline-block', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
                borderRadius: 12, padding: '14px 36px', textDecoration: 'none', fontWeight: 700, fontSize: 16,
                boxShadow: '0 4px 20px rgba(99,102,241,0.4)'
              }}
            >
              ⬇ Скачать Centrio для Windows
            </a>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 12 }}>Версия 1.5.19 · Бесплатно · Windows 10/11 · macOS · Linux</p>
          </section>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
