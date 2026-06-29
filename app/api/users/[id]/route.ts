import { NextRequest, NextResponse } from 'next/server'
import { auth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const random = Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
  return `DOW-${random}`
}


type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasRole(session.user.roles, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    console.log('[PATCH /api/users/' + id + '] starting...')

    const existing = await prisma.users.findUnique({ where: { id: Number(id) } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json() as {
      full_name?:       string
      pack_lead_id?:    number | null
      is_active?:       boolean
      dept?:            string
      allowed_depts?:   string
      roles?:           string[]
      reset_password?:  boolean
      manual_password?: string
      action?:          string
    }

    console.log('[PATCH /api/users/' + id + '] body:', JSON.stringify(body))

    if (body.action === 'reset_password' || body.reset_password === true) {
      const isManual = !!body.manual_password
      const plainPassword = isManual ? body.manual_password! : generateTempPassword()
      const hashedPassword = await bcrypt.hash(plainPassword, 10)

      await prisma.users.update({
        where: { id: Number(id) },
        data: {
          password_hash:        hashedPassword,
          must_change_password: !isManual,
          updated_at:           new Date(),
        },
      })

      console.log('[PATCH /api/users/' + id + '] password reset ok, manual:', isManual)
      return NextResponse.json({
        success:       true,
        temp_password: isManual ? null : plainPassword,
        is_manual:     isManual,
      })
    }

    const { roles, ...fields } = body

    await prisma.$transaction(async tx => {
      const user = await tx.users.update({
        where: { id: Number(id) },
        data: {
          ...(fields.full_name !== undefined && {
            full_name: fields.full_name,
          }),
          ...(fields.pack_lead_id !== undefined && {
            pack_lead_id:
              fields.pack_lead_id === null || (fields.pack_lead_id as unknown) === ""
                ? null
                : Number(fields.pack_lead_id),
          }),
          ...(fields.is_active !== undefined && {
            is_active: fields.is_active,
          }),
          ...(fields.dept !== undefined && { dept: fields.dept }),
          ...(fields.allowed_depts !== undefined && {
            allowed_depts: fields.allowed_depts,
          }),
          updated_at: new Date(),
        },
      });

      if (roles !== undefined) {
        await tx.user_roles.deleteMany({ where: { user_id: Number(id) } })
        if (roles.length > 0) {
          const roleRows = await tx.roles.findMany({ where: { role_name: { in: roles } } })
          await tx.user_roles.createMany({
            data: roleRows.map(r => ({
              user_id:    Number(id),
              role_id:    r.id,
              granted_by: Number(session.user.id),
              granted_at: new Date(),
            })),
            skipDuplicates: true,
          })
        }
      }

      return user
    })

    const updatedUser = await prisma.users.findUnique({
      where: { id: Number(id) },
      include: {
        user_roles: {
          include: { role: true }
        }
      }
    })

    console.log('[PATCH /api/users/' + id + '] updated ok')
    return NextResponse.json({
      ...updatedUser,
      password_hash: undefined,
      roles: updatedUser?.user_roles
        .map(ur => ur.role?.role_name || '')
        .filter(Boolean)
        .join(','),
      allowed_depts: updatedUser?.allowed_depts || 'all',
    })
  } catch (err) {
    console.error('[PATCH /api/users/[id]] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasRole(session.user.roles, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    console.log('[DELETE /api/users/' + id + '] deleting...')

    const existing = await prisma.users.findUnique({ where: { id: Number(id) } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.$transaction(async tx => {
      await tx.user_roles.deleteMany({ where: { user_id: Number(id) } })
      await tx.users.delete({ where: { id: Number(id) } })
    })

    console.log('[DELETE /api/users/' + id + '] done')
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/users/[id]] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
