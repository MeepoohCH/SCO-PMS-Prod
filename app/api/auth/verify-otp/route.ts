import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { otpStore } from '../forgot-password/route'

// In-memory attempt counter: max 3 wrong attempts per username
const attemptMap = new Map<string, number>()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { username: string; otp: string }
    const { username, otp } = body

    if (!username || !otp) {
      return NextResponse.json({ error: 'username and otp are required' }, { status: 400 })
    }

    const user = await prisma.users.findUnique({ where: { username } })
    if (!user) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 })
    }

    // Check if locked out
    const attempts = attemptMap.get(username) ?? 0
    if (attempts >= 3) {
      otpStore.delete(username)
      attemptMap.delete(username)
      return NextResponse.json(
        { error: 'เกิน 3 ครั้ง OTP ถูกยกเลิก กรุณาขอ OTP ใหม่' },
        { status: 400 },
      )
    }

    const record = otpStore.get(username)
    if (!record || record.otp !== otp || record.expires < new Date()) {
      attemptMap.set(username, attempts + 1)
      const remaining = 3 - (attempts + 1)
      return NextResponse.json(
        { error: `OTP ไม่ถูกต้องหรือหมดอายุแล้ว (เหลือ ${remaining} ครั้ง)` },
        { status: 400 },
      )
    }

    // Success — clear attempt counter
    attemptMap.delete(username)
    return NextResponse.json({ valid: true, token: otp })
  } catch (err) {
    console.error('[POST /api/auth/verify-otp]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
