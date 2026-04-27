'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';

const VERSION = '1.5.18';

const PLATFORMS = [
  {
    id: 'windows',
    name: 'Windows',
    href: '/download/windows',
    badge: 'Рекомендуем',
    desc: 'Windows 10 / 11 · 64-bit',
    size: '~95 МБ',
    ext: '.exe',
    color: '#3b82f6',
    colorDim: 'rgba(59,130,246,0.12)',
    colorBorder: 'rgba(59,130,246,0.25)',
    icon: (
      <svg width="52" height="52" viewBox="0 0 88 88" fill="none">
        <rect x="4"  y="4"  width="36" height="36" rx="4" fill="#3b82f6"/>
        <rect x="48" y="4"  width="36" height="36" rx="4" fill="#3b82f6"/>
        <rect x="4"  y="48" width="36" height="36" rx="4" fill="#3b82f6"/>
        <rect x="48" y="48" width="36" height="36" rx="4" fill="#3b82f6"/>
      </svg>
    ),
    steps: ['Скачайте .exe', 'Запустите установщик', 'Следуйте инструкциям'],
  },
  {
    id: 'macos',
    name: 'macOS',
    href: '/download/macos',
    badge: 'Intel + Apple Silicon',
    desc: 'macOS 12+ · x64 / arm64',
    size: '~110 МБ',
    ext: '.dmg',
    color: '#a78bfa',
    colorDim: 'rgba(167,139,250,0.1)',
    colorBorder: 'rgba(167,139,250,0.22)',
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C8.5 2 5.5 4 4 7c-1 2-1 4.5 0 7 1 2.2 2.5 4 4 5h.5c.5-.5 1-1.5 1.5-2.5.4-.8.8-1.5 2-1.5s1.6.7 2 1.5c.5 1 1 2 1.5 2.5H16c1.5-1 3-2.8 4-5 1-2.5 1-5 0-7-1.5-3-4.5-5-8-5z" fill="#a78bfa" opacity=".9"/>
        <path d="M12 2c1.5 0 2.5 1.5 2.5 3S13.5 8 12 8 9.5 6.5 9.5 5 10.5 2 12 2z" fill="#c4b5fd" opacity=".7"/>
      </svg>
    ),
    steps: ['Скачайте .dmg', 'Откройте и перетащите в Applications', 'Запустите Centrio'],
  },
  {
    id: 'linux',
    name: 'Linux',
    href: '/download/linux',
    badge: 'AppImage · deb',
    desc: 'Ubuntu, Debian, Fedora · 64-bit',
    size: '~110 МБ',
    ext: '.AppImage',
    color: '#34d399',
    colorDim: 'rgba(52,211,153,0.08)',
    colorBorder: 'rgba(52,211,153,0.2)',
    icon: (
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="none" stroke="#34d399" strokeWidth="1.5"/>
        <path d="M9 9c0-1.66 1.34-3 3-3s3 1.34 3 3c0 1.3-.83 2.4-2 2.83V15" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="12" cy="18" r="1" fill="#34d399"/>
        <path d="M4.5 8.5C3 10 2 11.9 2 14c0 4.42 3.58 8 8 8" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" opacity=".5"/>
        <path d="M19.5 8.5C21 10 22 11.9 22 14c0 4.42-3.58 8-8 8" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" opacity=".5"/>
      </svg>
    ),
    steps: ['Скачайте AppImage или .deb', 'Дайте права на запуск', 'Запустите приложение'],
  },
];

const FEATURES = [
  { icon: '⚡', title: 'Быстрый запуск', desc: 'Electron + оптимизированный рендерер' },
  { icon: '🔒', title: 'PIN-защита', desc: 'Блокировка при сворачивании' },
  { icon: '🌐', title: 'VPN встроен', desc: 'vmess, vless, trojan, shadowsocks' },
  { icon: '🔔', title: 'Уведомления', desc: 'Единая панель для всех мессенджеров' },
  { icon: '☁️', title: 'Облачная синхронизация', desc: 'Одна учётная запись на всех устройствах' },
  { icon: '🎨', title: 'Темы', desc: 'Тёмная, светлая, Midnight, Glass' },
];

export default function DownloadPage() {
  const [detected, setDetected] = useState<string | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/Win/i.test(ua))          setDetected('windows');
    else if (/Mac/i.test(ua))     setDetected('macos');
    else if (/Linux/i.test(ua))   setDetected('linux');
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#060a14', color: '#e2e2e2', fontFamily: "'Inter',-apple-system,sans-serif", overflowX: 'hidden' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse-glow { 0%,100%{opacity:.18} 50%{opacity:.38} }
        @keyframes float      { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes shimmer    { 0%{background-position:-200% center} 100%{background-position:200% center} }
        .glow-orb { position:absolute; border-radius:50%; filter:blur(130px); animation:pulse-glow 7s ease-in-out infinite; pointer-events:none; z-index:0; }
        .platform-card { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.08); border-radius:24px; padding:36px 32px; cursor:pointer; transition:all .3s cubic-bezier(.22,1,.36,1); position:relative; overflow:hidden; text-decoration:none; display:flex; flex-direction:column; }
        .platform-card:hover { transform:translateY(-4px); }
        .platform-card.detected { border-color:rgba(59,130,246,0.4); background:rgba(59,130,246,0.06); }
        .feat-card { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); border-radius:16px; padding:22px; transition:all .2s; }
        .feat-card:hover { background:rgba(255,255,255,0.04); border-color:rgba(255,255,255,0.12); }
        .nav-link { color:rgba(255,255,255,0.5); text-decoration:none; font-size:14px; font-weight:500; transition:color .2s; }
        .nav-link:hover { color:#fff; }
        .dl-btn { display:inline-flex; align-items:center; gap:8px; padding:11px 22px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; transition:all .2s; border:none; margin-top:auto; text-decoration:none; justify-content:center; }
        @media(max-width:860px) { .platforms-grid { grid-template-columns:1fr !important; } }
        @media(max-width:640px) { .feats-grid { grid-template-columns:1fr 1fr !important; } .nav-extras { display:none !important; } }
      `}</style>

      {/* Background glows */}
      <div className="glow-orb" style={{ width:700, height:700, background:'#1d4ed8', opacity:.12, top:-200, left:-200 }}/>
      <div className="glow-orb" style={{ width:500, height:500, background:'#7c3aed', opacity:.08, top:200, right:-150, animationDelay:'3s' }}/>
      <div className="glow-orb" style={{ width:400, height:400, background:'#059669', opacity:.06, bottom:100, left:'40%', animationDelay:'5s' }}/>

      {/* Nav */}
      <nav style={{ position:'sticky', top:0, zIndex:50, background:'rgba(6,10,20,0.85)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.07)', padding:'0 40px', display:'flex', alignItems:'center', height:64 }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
          <Image src="/logo.png" alt="Centrio" width={30} height={30} style={{ objectFit:'contain' }}/>
          <span style={{ fontSize:18, fontWeight:700, color:'#fff', letterSpacing:'-.02em' }}>Centrio</span>
        </Link>
        <div className="nav-extras" style={{ marginLeft:'auto', display:'flex', gap:28, alignItems:'center' }}>
          <a href="/faq"     className="nav-link">FAQ</a>
          <a href="/pricing" className="nav-link">Тарифы</a>
          <Link href="/dashboard" style={{ fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.7)', textDecoration:'none', padding:'8px 16px', borderRadius:9, background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.25)' }}>
            Личный кабинет
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ position:'relative', maxWidth:960, margin:'0 auto', padding:'88px 24px 56px', textAlign:'center', zIndex:1 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.25)', borderRadius:50, padding:'7px 18px', fontSize:13, fontWeight:500, color:'#60a5fa', marginBottom:28 }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:'#3b82f6', boxShadow:'0 0 8px #3b82f6', display:'inline-block' }}/>
          Версия {VERSION} · Свежий релиз
        </div>

        <h1 style={{ fontSize:'clamp(38px,6vw,68px)', fontWeight:900, letterSpacing:'-.03em', lineHeight:1.05, marginBottom:22, color:'#fff' }}>
          Скачать Centrio
        </h1>
        <p style={{ color:'rgba(255,255,255,0.45)', fontSize:18, lineHeight:1.8, maxWidth:560, margin:'0 auto 56px' }}>
          Выберите вашу операционную систему. Все платформы поддерживаются — Windows, macOS и Linux.
        </p>

        {/* Platform cards */}
        <div className="platforms-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20, textAlign:'left', position:'relative', zIndex:1 }}>
          {PLATFORMS.map(p => (
            <Link
              key={p.id}
              href={p.href}
              className={`platform-card${detected === p.id ? ' detected' : ''}`}
              style={{ '--card-color': p.color } as React.CSSProperties}
            >
              {/* Glow behind icon */}
              <div style={{ position:'absolute', top:-30, right:-30, width:160, height:160, borderRadius:'50%', background:p.color, opacity:.06, filter:'blur(40px)', pointerEvents:'none' }}/>

              {/* Detected badge */}
              {detected === p.id && (
                <div style={{ position:'absolute', top:16, right:16, background:p.colorDim, border:`1px solid ${p.colorBorder}`, borderRadius:30, padding:'3px 10px', fontSize:11, fontWeight:700, color:p.color, letterSpacing:'.04em' }}>
                  Ваша система
                </div>
              )}

              <div style={{ marginBottom:24, color:p.color }}>{p.icon}</div>

              <div style={{ fontSize:22, fontWeight:800, color:'#fff', letterSpacing:'-.02em', marginBottom:8 }}>
                {p.name}
                <span style={{ marginLeft:8, fontSize:12, fontWeight:600, padding:'3px 9px', borderRadius:30, background:p.colorDim, border:`1px solid ${p.colorBorder}`, color:p.color, verticalAlign:'middle' }}>
                  {p.ext}
                </span>
              </div>

              <div style={{ color:'rgba(255,255,255,0.4)', fontSize:13, marginBottom:6 }}>{p.desc}</div>
              <div style={{ color:'rgba(255,255,255,0.25)', fontSize:12, marginBottom:20 }}>{p.size} · {p.badge}</div>

              <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:28 }}>
                {p.steps.map((s, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:'rgba(255,255,255,0.5)' }}>
                    <span style={{ width:20, height:20, borderRadius:'50%', background:p.colorDim, border:`1px solid ${p.colorBorder}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:p.color, flexShrink:0 }}>{i+1}</span>
                    {s}
                  </div>
                ))}
              </div>

              <div className="dl-btn" style={{ background:`linear-gradient(135deg,${p.color}cc,${p.color})`, color:'#fff', boxShadow:`0 6px 24px ${p.color}40` }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Скачать для {p.name}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section style={{ maxWidth:960, margin:'0 auto 80px', padding:'0 24px', position:'relative', zIndex:1 }}>
        <h2 style={{ fontSize:26, fontWeight:800, color:'#fff', letterSpacing:'-.02em', marginBottom:32, textAlign:'center' }}>
          Всё что нужно — в одном приложении
        </h2>
        <div className="feats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
          {FEATURES.map((f, i) => (
            <div key={i} className="feat-card">
              <div style={{ fontSize:26, marginBottom:10 }}>{f.icon}</div>
              <div style={{ fontWeight:700, fontSize:15, color:'#fff', marginBottom:5 }}>{f.title}</div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,0.4)', lineHeight:1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Version info */}
      <section style={{ maxWidth:960, margin:'0 auto 80px', padding:'0 24px', position:'relative', zIndex:1 }}>
        <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:20, padding:'32px 36px', display:'flex', flexWrap:'wrap', gap:32, alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.3)', marginBottom:6, letterSpacing:'.05em', textTransform:'uppercase', fontWeight:600 }}>Последняя версия</div>
            <div style={{ fontSize:30, fontWeight:900, color:'#fff', letterSpacing:'-.03em' }}>v{VERSION}</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.3)', marginTop:4 }}>26 апреля 2026</div>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:16 }}>
            {[
              { label:'40+', sub:'мессенджеров' },
              { label:'7', sub:'языков' },
              { label:'4', sub:'темы оформления' },
              { label:'100%', sub:'бесплатно' },
            ].map((s,i) => (
              <div key={i} style={{ textAlign:'center', minWidth:80 }}>
                <div style={{ fontSize:24, fontWeight:900, color:'#fff', letterSpacing:'-.02em', background:'linear-gradient(135deg,#93c5fd,#60a5fa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>{s.label}</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.35)' }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop:'1px solid rgba(255,255,255,0.07)', padding:'28px 40px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Image src="/logo.png" alt="Centrio" width={20} height={20} style={{ objectFit:'contain' }}/>
          <span style={{ color:'rgba(255,255,255,0.3)', fontSize:13 }}>© 2026 Centrio. Все права защищены.</span>
        </div>
        <div style={{ display:'flex', gap:20 }}>
          <Link href="/privacy" style={{ color:'rgba(255,255,255,0.3)', textDecoration:'none', fontSize:13 }}>Конфиденциальность</Link>
          <Link href="/terms"   style={{ color:'rgba(255,255,255,0.3)', textDecoration:'none', fontSize:13 }}>Условия</Link>
          <Link href="/"        style={{ color:'rgba(255,255,255,0.3)', textDecoration:'none', fontSize:13 }}>Главная</Link>
        </div>
      </footer>
    </div>
  );
}
