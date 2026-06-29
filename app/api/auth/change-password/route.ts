import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { current_password, new_password } = await req.json() as {
      current_password?: string
      new_password:      string
    }

    if (!new_password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (new_password.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
    }

    const user = await prisma.users.findUnique({
      where:  { id: Number(session.user.id) },
      select: { password_hash: true },
    })

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Verify current password only when provided (force-change flow omits it)
    if (current_password) {
      const passwordMatch = await bcrypt.compare(current_password, user.password_hash)
      if (!passwordMatch) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      }
    }

    const newHash = await bcrypt.hash(new_password, 12)

    console.log('[POST /api/auth/change-password] changing password for user:', session.user.id)
    await prisma.users.update({
      where: { id: Number(session.user.id) },
      data: {
        password_hash:        newHash,
        must_change_password: false,
        updated_at:           new Date(),
      },
    })
    console.log('[POST /api/auth/change-password] setting must_change_password = false')

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/auth/change-password]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
