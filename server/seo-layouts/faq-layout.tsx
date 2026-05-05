import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Вопросы и ответы — FAQ',
  description:
    'Часто задаваемые вопросы о Centrio: как установить, как настроить мессенджеры, облачная синхронизация, VPN, подписка Pro и многое другое.',
  keywords: [
    'centrio faq', 'centrio вопросы', 'как установить centrio',
    'centrio поддержка', 'centrio помощь',
  ],
  alternates: { canonical: 'https://centrio.me/faq' },
  openGraph: {
    title: 'FAQ — Часто задаваемые вопросы о Centrio',
    description: 'Ответы на популярные вопросы об установке, настройке и функциях Centrio.',
    url: 'https://centrio.me/faq',
  },
}

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
