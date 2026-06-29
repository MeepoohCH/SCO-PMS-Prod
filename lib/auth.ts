/**
 * lib/auth.ts — NextAuth v5 configuration
 * Credentials provider + JWT strategy (7-day session)
 *
 * role  → primary / currently active role (from last_active_role_id, falls back to first assigned)
 * roles → ALL roles assigned to this user (from user_roles table)
 */

import NextAuth, { type DefaultSession } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

// ── Type augmentation (NextAuth v5) ────────────────────────────
declare module 'next-auth' {
  interface User {
    username:              string
    full_name:             string
    role:                  string    
    roles:                 string[] 
    allowed_depts:         string    
    force_change_password: boolean
  }
  interface Session {
    user: {
      id:                    string
      username:              string
      full_name:             string
      role:                  string
      roles:                 string[]
      allowed_depts:         string
      force_change_password: boolean
    } & DefaultSession['user']
  }
}

// ── Auth config ────────────────────────────────────────────────
export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true, // required off-Vercel (Azure App Service) or NextAuth rejects the request host
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username', type: 'text'     },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        // 1. Find the user + last_active_role + auth_state
        const user = await prisma.users.findUnique({
          where:   { username: credentials.username as string },
          include: { last_active_role: true },
        })

        if (!user || !user.is_active) return null

        // 2. Verify password
        const ok = await bcrypt.compare(
          credentials.password as string,
          user.password_hash,
        )
        if (!ok) return null

        // 3. Fetch all roles assigned to this user (ground-truth)
        const userRoles = await prisma.user_roles.findMany({
          where:   { user_id: user.id },
          include: { role: true },
        })

        return {
          id:                    String(user.id),
          username:              user.username,
          full_name:             user.full_name,
          // Primary role: prefer last_active_role, fall back to first assigned role
          role:                  user.last_active_role?.role_name ?? userRoles[0]?.role.role_name ?? '',
          roles:                 userRoles.map(r => r.role.role_name),
          allowed_depts:         user.allowed_depts || 'all',
          force_change_password: user.must_change_password ?? false,
        }
      },
    }),
  ],

  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 }, // 7 days

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id                    = user.id
        token.username              = user.username
        token.full_name             = user.full_name
        token.role                  = user.role
        token.roles                 = user.roles
        token.allowed_depts         = user.allowed_depts
        token.force_change_password = user.force_change_password
      }
      // Re-fetch force_change_password from DB only when flagged or on initial login,
      // so admin changes are reflected promptly without a DB hit on every request.
      const shouldRefetch = token.force_change_password === true || Boolean(user)
      if (token.id && shouldRefetch) {
        try {
          const dbUser = await prisma.users.findUnique({
            where:  { id: Number(token.id) },
            select: { must_change_password: true },
          })
          token.force_change_password = dbUser?.must_change_password ?? false
        } catch (e) {
          console.error('[JWT] re-fetch failed:', e)
        }
      }
      return token
    },
    // token fields are typed 'unknown' without next-auth/jwt augmentation → cast explicitly
    session({ session, token }) {
      session.user.id                    = String(token.id        ?? '')
      session.user.username              = String(token.username  ?? '')
      session.user.full_name             = String(token.full_name ?? '')
      session.user.role                  = String(token.role      ?? '')
      session.user.roles                 = Array.isArray(token.roles) ? (token.roles as string[]) : []
      session.user.allowed_depts         = String(token.allowed_depts ?? 'all')
      session.user.force_change_password = Boolean(token.force_change_password ?? false)
      return session
    },
  },

  pages: { signIn: '/login' },
})

export function hasRole(role: unknown, ...check: string[]): boolean {
  const roles = Array.isArray(role)
    ? (role as string[])
    : String(role ?? '').split(',').map(r => r.trim()).filter(Boolean)
  return check.some(r => roles.includes(r))
}
