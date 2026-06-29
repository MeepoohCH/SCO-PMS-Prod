import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const roleFilter = searchParams.get('role')   // e.g. 'packer'
    const deptFilter = searchParams.get('dept')    // e.g. 'PUF'

    const users = await prisma.users.findMany({
      where: {
        is_active: true,
        ...(roleFilter && {
          user_roles: {
            some: { role: { role_name: roleFilter } },
          },
        }),
      },
      select: {
        id: true,
        full_name: true,
        username: true,
        allowed_depts: true,
      },
      orderBy: { full_name: 'asc' },
    })

    // Dept filtering done in JS since allowed_depts is a comma-separated string column.
    // 'all' means the user covers every dept.
    const filtered = deptFilter
      ? users.filter(u => {
          const depts = String(u.allowed_depts || 'all').split(',').map(d => d.trim())
          return depts.includes('all') || depts.includes(deptFilter)
        })
      : users

    console.log('[GET /api/users/names] role:', roleFilter, 'dept:', deptFilter, 'count:', filtered.length)
    return NextResponse.json(filtered.map(u => ({ id: u.id, full_name: u.full_name, username: u.username })))
  } catch (err) {
    console.error('[GET /api/users/names]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
