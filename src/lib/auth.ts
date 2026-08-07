import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { verifySync as totpVerifySync } from 'otplib'
import { prisma } from './prisma'
import { checkLoginRateLimit, resetLoginRateLimit } from './rateLimit'
import { log } from './audit'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 4 * 60 * 60 },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Senha',    type: 'password' },
        totp:     { label: 'Código',   type: 'text' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null

        // Rate limit por IP (usa email como fallback)
        const forwarded = (req.headers?.['x-forwarded-for'] as string) ?? ''
        const ip = forwarded.split(',')[0].trim() || credentials.email
        const rl = checkLoginRateLimit(ip)

        if (!rl.allowed) {
          const mins = Math.ceil((rl.retryAfterMs ?? BLOCK_MS) / 60000)
          throw new Error(`RATE_LIMIT:${mins}`)
        }

        const user = await prisma.user.findUnique({ where: { email: credentials.email } })

        if (!user || !user.active) {
          // Conta tentativa mesmo para usuário inválido (evita enumeração)
          return null
        }

        const passwordMatch = await bcrypt.compare(credentials.password, user.password)
        if (!passwordMatch) return null

        // MFA — apenas para admins/gerentes com MFA habilitado
        if ((user.role === 'ADMIN' || user.role === 'GERENTE') && user.mfaEnabled && user.mfaSecret) {
          const code = credentials.totp?.trim()
          if (!code) {
            // Senha correta mas MFA ainda não fornecido
            throw new Error('MFA_REQUIRED')
          }
          const result = totpVerifySync({ token: code, secret: user.mfaSecret })
          if (!result.valid) {
            throw new Error('MFA_INVALID')
          }
        }

        // Login OK — limpa rate limit e loga
        resetLoginRateLimit(ip)
        await log({
          userId: user.id, userName: user.name, userRole: user.role,
          action: 'LOGIN', entity: 'Sessão', entityName: user.email, ip,
        })

        const managedUnits = await prisma.userUnit.findMany({
          where: { userId: user.id },
          select: { unitId: true },
        })
        const unitIds = managedUnits.map(u => u.unitId)

        return {
          id:                 user.id,
          name:               user.name,
          email:              user.email,
          role:               user.role,
          unitId:             user.unitId,
          unitIds:            unitIds.length ? unitIds : (user.unitId ? [user.unitId] : []),
          mustChangePassword: user.mustChangePassword,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id                 = user.id
        token.role               = (user as any).role
        token.unitId             = (user as any).unitId
        token.unitIds            = (user as any).unitIds ?? []
        token.mustChangePassword = (user as any).mustChangePassword
        token.actualRole = token.role
        if (token.role === 'GERENTE') token.role = 'ADMIN'
      } else if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where:  { id: token.id as string },
            select: {
              name: true, role: true, unitId: true, active: true,
              avatarUrl: true, mfaEnabled: true, mustChangePassword: true,
              managedUnits: { select: { unitId: true } },
            },
          })
          if (dbUser && dbUser.active) {
            const unitIds = dbUser.managedUnits.map((u: { unitId: string }) => u.unitId)
            token.name               = dbUser.name
            token.role               = dbUser.role
            token.unitId             = dbUser.unitId
            token.unitIds            = unitIds.length ? unitIds : (dbUser.unitId ? [dbUser.unitId] : [])
            token.avatarUrl          = dbUser.avatarUrl
            token.mfaEnabled         = dbUser.mfaEnabled
            token.mustChangePassword = dbUser.mustChangePassword
            token.actualRole = token.role
            if (token.role === 'GERENTE') token.role = 'ADMIN'
          }
        } catch {
          // mantém valores do token se banco não responder
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id         = token.id as string
        session.user.name       = token.name as string
        session.user.role       = token.role as string
        session.user.actualRole = (token.actualRole as string) ?? (token.role as string)
        session.user.unitId     = token.unitId as string | null
        session.user.unitIds    = (token.unitIds as string[]) ?? []
        session.user.avatarUrl          = token.avatarUrl as string | null
        session.user.mfaEnabled         = token.mfaEnabled as boolean
        session.user.mustChangePassword = token.mustChangePassword as boolean
      }
      return session
    },
  },
  events: {
    async signOut({ token }) {
      if (token?.id) {
        await log({
          userId: token.id as string,
          userName: token.name as string,
          userRole: token.role as string,
          action: 'LOGOUT', entity: 'Sessão', entityName: token.email as string,
        })
      }
    },
  },
}

const BLOCK_MS = 15 * 60 * 1000

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: string
      actualRole: string
      unitId?: string | null
      unitIds: string[]
      avatarUrl?: string | null
      mfaEnabled?: boolean
      mustChangePassword?: boolean
    }
  }
}
