import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Usuário com senha temporária — força troca antes de qualquer coisa
    if (token?.mustChangePassword && pathname !== '/trocar-senha') {
      return NextResponse.redirect(new URL('/trocar-senha', req.url))
    }

    if (pathname.startsWith('/admin') && token?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/calendario', req.url))
    }

    // Superintendente só acessa: calendário, tarefas, vagas, candidatos, admissão, pareceres, colaboradores e evidências PCD
    if (token?.role === 'SUPERINTENDENT') {
      const allowed = ['/calendario', '/tarefas', '/vagas', '/candidatos', '/admissao', '/pareceres', '/colaboradores', '/indicadores/pcd/evidencias', '/perfil', '/trocar-senha']
      const isAllowed = allowed.some((p) => pathname === p || pathname.startsWith(p + '/'))
      if (!isAllowed) return NextResponse.redirect(new URL('/calendario', req.url))
    }

    // Testes: apenas ADMIN e ANALYST
    if (pathname === '/testes' || pathname.startsWith('/testes/')) {
      if (token?.role !== 'ADMIN' && token?.role !== 'ANALYST') {
        return NextResponse.redirect(new URL('/calendario', req.url))
      }
    }

    // Jurídico só visualiza: Controle de Vagas, Indicador PCD e Evidências PCD
    if (token?.role === 'JURIDICO') {
      const allowed = ['/vagas', '/indicadores/pcd', '/perfil', '/trocar-senha']
      const isAllowed = allowed.some((p) => pathname === p || pathname.startsWith(p + '/'))
      if (!isAllowed) return NextResponse.redirect(new URL('/indicadores/pcd', req.url))
    }

    // Analistas não têm acesso a indicadores, headcount e relatórios
    const analystBlocked = ['/indicadores', '/headcount', '/relatorios']
    if (token?.role === 'ANALYST' && analystBlocked.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
      return NextResponse.redirect(new URL('/calendario', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/calendario/:path*',
    '/tarefas/:path*',
    '/indicadores/:path*',
    '/headcount/:path*',
    '/relatorios/:path*',
    '/admin',
    '/admin/:path*',
    '/vagas',
    '/vagas/:path*',
    '/candidatos',
    '/candidatos/:path*',
    '/colaboradores',
    '/colaboradores/:path*',
    '/admissao',
    '/admissao/:path*',
    '/pareceres',
    '/pareceres/:path*',
    '/testes',
    '/testes/:path*',
    '/perfil',
    '/chamados',
    '/chamados/:path*',
    '/trocar-senha',
  ],
}
