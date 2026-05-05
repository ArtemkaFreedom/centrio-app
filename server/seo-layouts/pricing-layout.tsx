import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Цены и тарифы — Free, Pro, Team',
  description:
    'Centrio Free — навсегда бесплатно. Pro от 199 ₽/мес: неограниченно мессенджеров, облачная синхронизация, папки. Оплата картой РФ, СБП или криптовалютой.',
  keywords: [
    'centrio цена', 'centrio pro', 'стоимость подписки',
    'мессенджер подписка', 'centrio бесплатно', 'centrio тарифы',
  ],
  alternates: { canonical: 'https://centrio.me/pricing' },
  openGraph: {
    title: 'Цены Centrio — Free навсегда, Pro от 199 ₽/мес',
    description: 'Выберите подходящий план. Free — бесплатно, Pro — полный доступ ко всем функциям.',
    url: 'https://centrio.me/pricing',
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
