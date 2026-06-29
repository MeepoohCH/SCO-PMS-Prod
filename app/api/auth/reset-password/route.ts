import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { otpStore } from '../forgot-password/route'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { username: string; otp: string; new_password: string }
    const { username, otp, new_password } = body

    if (!username || !otp || !new_password) {
      return NextResponse.json({ error: 'username, otp, and new_password are required' }, { status: 400 })
    }

    if (new_password.length < 8) {
      return NextResponse.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 400 })
    }
    if (!/[A-Z]/.test(new_password)) {
      return NextResponse.json({ error: 'รหัสผ่านต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว' }, { status: 400 })
    }
    if (!/[0-9]/.test(new_password)) {
      return NextResponse.json({ error: 'รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว' }, { status: 400 })
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(new_password)) {
      return NextResponse.json({ error: 'รหัสผ่านต้องมีอักขระพิเศษอย่างน้อย 1 ตัว เช่น !@#$' }, { status: 400 })
    }

    const user = await prisma.users.findUnique({ where: { username } })
    if (!user) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 })
    }

    const record = otpStore.get(username)
    if (!record || record.otp !== otp || record.expires < new Date()) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 })
    }

    const password_hash = await bcrypt.hash(new_password, 12)

    await prisma.users.update({
      where: { id: user.id },
      data: {
        password_hash,
        must_change_password: false,
        updated_at:           new Date(),
      },
    })

    // Invalidate OTP
    otpStore.delete(username)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/auth/reset-password]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
