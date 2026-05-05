import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata: Metadata = {
  title: 'Centrio — Все мессенджеры в одном окне',
  description: 'Бесплатное приложение для Windows, macOS и Linux. Telegram, WhatsApp, Discord, VK и любые другие сервисы — в одном окне.',
  keywords: 'мессенджер, telegram, whatsapp, discord, vk, агрегатор, приложение',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'Centrio — Все мессенджеры в одном окне',
    description: 'Бесплатное приложение. Все мессенджеры в одном удобном окне.',
    type: 'website',
    locale: 'ru_RU',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={inter.className} style={{background:'#080810'}}>
        {children}
      </body>
    </html>
  )
}
