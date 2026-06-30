import { safeLog } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// In-memory stores (cleared on server restart — acceptable for dev OTP flow)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const otpStore     = new Map<string, { otp: string; expires: Date }>()

function checkRateLimit(username: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(username)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(username, { count: 1, resetAt: now + 15 * 60 * 1000 })
    return true
  }
  if (entry.count >= 3) return false
  entry.count++
  return true
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { username: string }
    const { username } = body

    if (!username) {
      return NextResponse.json({ error: 'username is required' }, { status: 400 })
    }

    if (!checkRateLimit(username)) {
      return NextResponse.json(
        { error: 'ส่งคำขอมากเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' },
        { status: 429 },
      )
    }

    const user = await prisma.users.findUnique({ where: { username } })
    if (!user) {
      // Avoid username enumeration — return success regardless
      return NextResponse.json({ message: 'OTP sent', expires_in: '15m' })
    }

    const otp     = String(Math.floor(100000 + Math.random() * 900000))
    const expires = new Date(Date.now() + 15 * 60 * 1000)

    otpStore.set(username, { otp, expires })

    // TODO: Replace with real email/LINE Notify in production
    console.log('[forgot-password] OTP issued for', safeLog(username))

    return NextResponse.json({ message: 'OTP sent', expires_in: '15m', dev_otp: otp })
  } catch (err) {
    console.error('[POST /api/auth/forgot-password]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export { otpStore }
