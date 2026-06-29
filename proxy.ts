/**
 * middleware.ts — Role-based route protection (multi-role aware)
 *
 * A user with multiple roles can navigate to ANY of their allowed paths.
 * Unmatched paths redirect to the primary role's page.
 *
 * Also forwards x-pathname header (used by legacy server-component checks).
 *
 *   /login   → public
 *   /admin   → roles containing 'admin'
 *   /sl      → roles containing 'sl'
 *   /pl      → roles containing 'pl'
 *   /packer  → roles containing 'packer'
 */

import { auth } from './lib/auth'
import { NextResponse } from 'next/server'

const ROLE_ROUTES: Record<string, string> = {
  admin:  '/admin',
  sl:     '/sl',
  pl:     '/pl',
  packer: '/packer',
}

export default auth((req) => {
  const { pathname } = req.nextUrl

  // Forward pathname as request header so any server component can read it
  function nextWithPathname() {
    const headers = new Headers(req.headers)
    headers.set('x-pathname', pathname)
    return NextResponse.next({ request: { headers } })
  }

  // ── Public: login + change-password ───────────────────────
  if (pathname.startsWith('/login') ||
      pathname.startsWith('/change-password')) {
    return nextWithPathname()
  }

  // ── Require authentication ─────────────────────────────────
  const session = req.auth
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const role  = session.user.role  as string
  const roles = Array.isArray(session.user.roles)
    ? (session.user.roles as string[])
    : [role]

  // Paths this user is allowed to visit (one per assigned role)
  const allowedPaths = roles.map(r => ROLE_ROUTES[r]).filter(Boolean)

  if (allowedPaths.length === 0) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Allow if pathname falls under ANY of the user's role paths
  const isAllowed = allowedPaths.some(p => pathname.startsWith(p))

  if (!isAllowed) {
    // Redirect to primary role's home (or first allowed path as fallback)
    const primaryPath = ROLE_ROUTES[role] ?? allowedPaths[0]
    return NextResponse.redirect(new URL(primaryPath, req.url))
  }

  return nextWithPathname()
})

// export const config = {
//   matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
// }
export const config = {
  matcher: [
    // ป้องกันแค่ page routes ไม่ใช่ API routes
    '/((?!api|_next/static|_next/image|favicon.ico|login|change-password).*)',
  ],
}