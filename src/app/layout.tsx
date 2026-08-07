import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from '@/components/providers/SessionProvider'
import { SettingsProvider } from '@/components/providers/SettingsProvider'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'People 360',
  description: 'People 360 — Plataforma de Gestão Estratégica de Pessoas',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <SessionProvider session={session}>
          <SettingsProvider>{children}</SettingsProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
