import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Политика возврата | Centrio',
  description: 'Условия возврата средств за подписку Centrio Pro. 14-дневная гарантия возврата для годовых подписок.',
  alternates: { canonical: 'https://centrio.me/refund' },
}

export default function RefundLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
