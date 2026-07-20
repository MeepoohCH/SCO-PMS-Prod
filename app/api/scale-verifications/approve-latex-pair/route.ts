import { NextRequest, NextResponse } from 'next/server'
import { auth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { safeLog } from '@/lib/utils'   // ← เพิ่ม import

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!hasRole(session.user.roles, 'pl')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json() as { production_detail_id?: number }
    const { production_detail_id } = body
    if (!production_detail_id) {
      return NextResponse.json({ error: 'production_detail_id is required' }, { status: 400 })
    }

    const lot = await prisma.production_details.findUnique({
      where: { id: Number(production_detail_id) },
      select: { dept: true },
    })
    if (!lot) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (lot.dept !== 'Latex') {
      return NextResponse.json({ error: 'This endpoint only approves Latex scale verification pairs' }, { status: 400 })
    }

    const result = await prisma.scale_verifications.updateMany({
      where: {
        production_detail_id: Number(production_detail_id),
        pl_approved_at: null,
      },
      data: {
        pl_approved_by: Number(session.user.id),
        pl_approved_at: new Date(),
        is_locked:      true,
        locked_at:      new Date(),
      },
    })

   const safeLotId = String(production_detail_id).replace(/[\r\n]/g, '');

    console.log(`[POST /api/scale-verifications/approve-latex-pair] approved rows: ${result.count} for lot: ${safeLotId}`);
    return NextResponse.json({ approved: result.count });
  } catch (err) {
    
    const safeError = err instanceof Error ? err.message.replace(/[\r\n]/g, '') : 'Unknown error';
    console.error('[POST /api/scale-verifications/approve-latex-pair]', safeError);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}