/**
 * app/page.tsx — root redirect
 * Middleware handles the actual redirect (unauthenticated → /login,
 * authenticated → role page). This page is the fallback in case
 * middleware does not catch the request.
 */

import { redirect } from 'next/navigation'
import { auth } from '../lib/auth'

const ROLE_ROUTES: Record<string, string> = {
  admin:  '/admin',
  sl:     '/sl',
  pl:     '/pl',
  packer: '/packer',
}

export default async function RootPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  redirect(ROLE_ROUTES[session.user.role] ?? '/login')
}
