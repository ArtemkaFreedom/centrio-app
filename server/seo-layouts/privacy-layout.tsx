import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Политика конфиденциальности',
  description:
    'Политика конфиденциальности Centrio. Как мы собираем, используем и защищаем ваши данные.',
  robots: { index: true, follow: false },
  alternates: { canonical: 'https://centrio.me/privacy' },
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
