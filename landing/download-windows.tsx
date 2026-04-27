'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

const VERSION = '1.5.3';
const WIN_DOWNLOAD = `https://download.centrio.me/Centrio%20Setup%20${VERSION}.exe`;

export default function DownloadWindowsPage() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    setDownloading(true);
    window.location.href = WIN_DOWNLOAD;
    setTimeout(() => setDownloading(false), 3000);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#060a14', color: '#e2e2e2', fontFamily: "'Inter', -apple-system, sans-serif", overflowX: 'hidden' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060a14; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes pulse-glow { 0%,100%{opacity:.2} 50%{opacity:.45} }
        .glow-orb { position:absolute; border-radius:50%; filter:blur(120px); animation:pulse-glow 6s ease-in-out infinite; pointer-events:none; }
        .glass-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:20px; backdrop-filter:blur(8px); }
        .step-num { width:44px; height:44px; border-radius:50%; background:linear-gradient(135deg,#1d4ed8,#3b82f6); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:17px; color:#fff; flex-shrink:0; box-shadow:0 4px 20px rgba(59,130,246,0.4); }
        .req-item { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:18px 20px; display:flex; flex-direction:column; gap:6px; }
        .nav-link { color:rgba(255,255,255,0.5); text-decoration:none; font-size:14px; font-weight:500; transition:color .2s; }
        .nav-link:hover { color:#fff; }
        @media(max-width:640px){
          .reqs-grid { grid-template-columns:1fr 1fr !important; }
          .nav-extras { display:none !important; }
        }
      `}</style>

      {/* Background glows */}
      <div className="glow-orb" style={{ width: 600, height: 600, background: '#1d4ed8', opacity: .1, top: -200, left: -150 }} />
      <div className="glow-orb" style={{ width: 400, height: 400, background: '#3b82f6', opacity: .07, top: 100, right: -100, animationDelay: '3s' }} />

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(6,10,20,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 40px', display: 'flex', alignItems: 'center', height: 64 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <Image src="/logo.png" alt="Centrio" width={30} height={30} style={{ objectFit: 'contain' }} />
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-.02em' }}>Centrio</span>
        </Link>
        <div className="nav-extras" style={{ marginLeft: 'auto', display: 'flex', gap: 28, alignItems: 'center' }}>
          <a href="/faq" className="nav-link">FAQ</a>
          <a href="/pricing" className="nav-link">Тарифы</a>
          <Link href="/dashboard" style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', textDecoration: 'none', padding: '8px 16px', borderRadius: 9, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', transition: 'all .2s' }}>
            Личный кабинет
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ position: 'relative', maxWidth: 820, margin: '0 auto', padding: '80px 24px 60px', textAlign: 'center' }}>
        {/* Windows icon */}
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 88, height: 88, borderRadius: 22, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', marginBottom: 32, boxShadow: '0 8px 32px rgba(59,130,246,0.15)' }}>
          <svg width="44" height="44" viewBox="0 0 88 88" fill="none">
            <rect x="4" y="4" width="36" height="36" rx="3" fill="#3b82f6" opacity=".9"/>
            <rect x="48" y="4" width="36" height="36" rx="3" fill="#3b82f6" opacity=".9"/>
            <rect x="4" y="48" width="36" height="36" rx="3" fill="#3b82f6" opacity=".9"/>
            <rect x="48" y="48" width="36" height="36" rx="3" fill="#3b82f6" opacity=".9"/>
          </svg>
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 50, padding: '6px 16px', fontSize: 13, fontWeight: 500, color: '#60a5fa', marginBottom: 24 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 8px #3b82f6', display: 'inline-block' }} />
          Windows · Версия {VERSION}
        </div>

        <h1 style={{ fontSize: 'clamp(34px,5.5vw,58px)', fontWeight: 900, letterSpacing: '-.03em', lineHeight: 1.1, marginBottom: 20, color: '#fff' }}>
          Скачать Centrio<br />
          <span style={{ background: 'linear-gradient(135deg,#93c5fd,#3b82f6,#38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>для Windows</span>
        </h1>

        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 17, lineHeight: 1.8, marginBottom: 44, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
          Все мессенджеры в одном окне. Telegram, WhatsApp, Discord, VK и&nbsp;100+ других сервисов — без лишних вкладок браузера.
        </p>

        <button
          onClick={handleDownload}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: downloading ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg,#1d4ed8,#3b82f6)',
            color: '#fff', border: 'none', borderRadius: 14, padding: '16px 40px',
            fontSize: 16, fontWeight: 700, cursor: 'pointer', transition: 'all 0.25s',
            boxShadow: downloading ? 'none' : '0 6px 32px rgba(59,130,246,0.5)',
            letterSpacing: '-.01em'
          }}
          onMouseEnter={e => { if (!downloading) { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 12px 48px rgba(59,130,246,0.65)'; } }}
          onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=downloading?'none':'0 6px 32px rgba(59,130,246,0.5)'; }}
        >
          {downloading ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              Загрузка начинается...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Скачать .exe — бесплатно
            </>
          )}
        </button>

        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, marginTop: 14 }}>
          Версия {VERSION} · ~85 МБ · Windows 10/11 · 64-bit
        </p>
      </section>

      {/* System Requirements */}
      <section style={{ maxWidth: 820, margin: '0 auto 60px', padding: '0 24px' }}>
        <div className="glass-card" style={{ padding: '36px 40px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 28, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            Системные требования
          </h2>
          <div className="reqs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            {[
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/></svg>, label: 'ОС', value: 'Windows 10/11' },
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>, label: 'Архитектура', value: '64-bit (x64)' },
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>, label: 'RAM', value: 'от 200 МБ' },
              { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>, label: 'Место', value: 'от 150 МБ' },
            ].map((r, i) => (
              <div key={i} className="req-item">
                {r.icon}
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase' }}>{r.label}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{r.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Installation Steps */}
      <section style={{ maxWidth: 820, margin: '0 auto 60px', padding: '0 24px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 28, color: '#fff', letterSpacing: '-.02em' }}>Установка за 4 шага</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { title: 'Скачайте установщик', desc: 'Нажмите кнопку выше — файл Centrio Setup.exe будет загружен автоматически (~85 МБ).' },
            { title: 'Запустите .exe файл', desc: 'Дважды щёлкните по скачанному файлу. Если Windows SmartScreen предупредит — нажмите «Запустить в любом случае».' },
            { title: 'Следуйте инструкциям', desc: 'Выберите папку установки или оставьте по умолчанию. Нажмите «Установить».' },
            { title: 'Запустите Centrio', desc: 'После установки приложение запустится автоматически. Добавьте мессенджеры и наслаждайтесь!' },
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 18, alignItems: 'flex-start', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '20px 24px', transition: 'all .25s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(59,130,246,0.3)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(59,130,246,0.05)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'; }}>
              <div className="step-num">{i + 1}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 5, color: '#fff' }}>{step.title}</div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.65 }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 820, margin: '0 auto 80px', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(29,78,216,0.12) 0%, rgba(59,130,246,0.08) 100%)', border: '1px solid rgba(59,130,246,0.22)', borderRadius: 22, padding: '48px 32px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.12), transparent 60%)', pointerEvents: 'none' }} />
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.8" style={{ marginBottom: 16 }}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12, color: '#fff', letterSpacing: '-.02em' }}>Остались вопросы?</h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: 28, lineHeight: 1.7, maxWidth: 420, margin: '0 auto 28px' }}>
            Загляните в наш FAQ — ответы на самые частые вопросы об установке и настройке.
          </p>
          <Link href="/faq" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.35)', borderRadius: 12, padding: '12px 28px', textDecoration: 'none', fontWeight: 600, fontSize: 15, transition: 'all .2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background='rgba(59,130,246,0.25)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background='rgba(59,130,246,0.15)'; }}>
            Перейти в FAQ
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '28px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image src="/logo.png" alt="Centrio" width={20} height={20} style={{ objectFit: 'contain' }} />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>© 2026 Centrio. Все права защищены.</span>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <Link href="/privacy" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontSize: 13 }}>Конфиденциальность</Link>
          <Link href="/terms" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontSize: 13 }}>Условия</Link>
          <Link href="/" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontSize: 13 }}>Главная</Link>
        </div>
      </footer>
    </div>
  );
}
