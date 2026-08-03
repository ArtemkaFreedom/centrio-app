import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

const SITE_URL = 'https://centrio.me'
const OG_IMAGE = 'https://centrio.me/og-image.png'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Centrio — Все мессенджеры в одном окне',
    template: '%s | Centrio',
  },
  description:
    'Centrio — бесплатное десктопное приложение для Windows, macOS и Linux. Telegram, WhatsApp, Discord, VK, Slack, Notion и 100+ сервисов в одном окне. VPN, облачная синхронизация, папки.',
  keywords: [
    'мессенджер', 'агрегатор мессенджеров', 'все мессенджеры в одном',
    'telegram desktop', 'whatsapp desktop', 'discord', 'vk desktop',
    'centrio', 'centrio.me', 'приложение для мессенджеров',
    'мультимессенджер', 'messenger app', 'all messengers one window',
    'десктопное приложение', 'windows macos linux',
    'облачная синхронизация', 'vpn мессенджер',
  ],
  authors: [{ name: 'Centrio', url: SITE_URL }],
  creator: 'Centrio',
  publisher: 'Centrio',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
    ],
    apple: '/logo.png',
    shortcut: '/logo.png',
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Centrio',
    locale: 'ru_RU',
    title: 'Centrio — Все мессенджеры в одном окне',
    description:
      'Бесплатное приложение для Windows, macOS и Linux. Telegram, WhatsApp, Discord, VK и 100+ сервисов в одном окне.',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Centrio App' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Centrio — Все мессенджеры в одном окне',
    description: 'Telegram, WhatsApp, Discord, VK и 100+ сервисов. Бесплатно. Windows · macOS · Linux.',
    images: [OG_IMAGE],
  },
}

const JSONLD_ORG = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Centrio',
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  email: 'support@centrio.me',
  sameAs: [],
}

const JSONLD_APP = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Centrio',
  operatingSystem: 'Windows, macOS, Linux',
  applicationCategory: 'CommunicationApplication',
  description:
    'Centrio — десктопное приложение, объединяющее Telegram, WhatsApp, Discord, VK, Slack, Notion и 100+ сервисов в одном окне. Встроенный VPN, облачная синхронизация, папки.',
  url: SITE_URL,
  downloadUrl: `${SITE_URL}/download`,
  softwareVersion: '1.8.4',
  offers: [
    { '@type': 'Offer', price: '0', priceCurrency: 'RUB', name: 'Free' },
    { '@type': 'Offer', price: '199', priceCurrency: 'RUB', name: 'Pro (ежемесячно)' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <head>
        <link rel="canonical" href={SITE_URL} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD_ORG) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD_APP) }}
        />
      </head>
      <body className={inter.className} style={{ background: '#06060f', minHeight: '100vh' }}>
        {children}

        {/* Yandex.Metrika */}
        <Script id="ym-init" strategy="afterInteractive">{`
          (function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
          })(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=108785516','ym');
          ym(108785516,'init',{ssr:true,webvisor:true,clickmap:true,ecommerce:"dataLayer",referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});
        `}</Script>
        <noscript>
          <div><img src="https://mc.yandex.ru/watch/108785516" style={{position:'absolute',left:'-9999px'}} alt="" /></div>
        </noscript>
      </body>
    </html>
  )
}
