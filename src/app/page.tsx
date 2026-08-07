import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function Home() {
  const session = await getServerSession(authOptions)
  if (session) {
    if (session.user.role === 'ADMIN') redirect('/dashboard')
    if (session.user.role === 'JURIDICO') redirect('/indicadores/pcd')
    redirect('/calendario')
  }
  redirect('/login')
}
