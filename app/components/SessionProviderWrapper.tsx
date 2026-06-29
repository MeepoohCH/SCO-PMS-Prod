'use client'

/**
 * app/components/SessionProviderWrapper.tsx
 *
 * Thin client-side wrapper so we can use SessionProvider inside the
 * Server Component root layout (layout.tsx).
 *
 * SessionProvider makes useSession() available to every client
 * component in the tree — including Navbar.tsx.
 */

import { SessionProvider } from 'next-auth/react'

export default function SessionProviderWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return <SessionProvider>{children}</SessionProvider>
}
