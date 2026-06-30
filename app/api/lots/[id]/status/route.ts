import { safeLog } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { DetailStatus, ApprovalAction } from '@prisma/client'

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft:            ['waiting',                                        'rejected'],
  waiting:          ['in_progress',                                    'rejected'],
  in_progress:      ['submitted', 'pl_review',
                     'paused_shift_end', 'paused_issue', 'paused_emergency', 'rejected'],
  pl_review:        ['in_progress',                                    'rejected'],
  paused_shift_end: ['in_progress',                                    'rejected'],
  paused_issue:     ['in_progress',                                    'rejected'],
  paused_emergency: ['in_progress',                                    'rejected'],
  submitted:        ['head_approved', 'completed',                     'rejected'],
  head_approved:    ['completed', 'sl_rejected',                       'rejected'],
  sl_rejected:      ['rejected'],
  completed:        [],
  rejected:         ['submitted'],
}

function resolveApprovalAction(
  fromStatus: string,
  toStatus: string,
  roles: string[],
): ApprovalAction | null {
  if (toStatus === 'sl_rejected') return 'rejected_by_sl'
  if (toStatus === 'rejected' && fromStatus === 'sl_rejected') return 'pl_acknowledged_reject'
  if (toStatus === 'rejected') return roles.includes('pl') ? 'rejected_by_pl' : 'rejected_by_sl'
  if ((fromStatus === 'in_progress' || fromStatus === 'pl_review') && toStatus === 'submitted') return 'pack_lead_approved'
  if (fromStatus === 'submitted'     && toStatus === 'head_approved') return 'submitted'
  if (fromStatus === 'submitted'     && toStatus === 'completed')     return 'completed'
  if (fromStatus === 'head_approved' && toStatus === 'completed')     return 'completed'
  return null
}

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json() as { status: string; reject_remark?: string; pl_remark?: string }
    const { status: newStatus, reject_remark, pl_remark } = body
    console.log('[PATCH /api/lots/' + safeLog(id) + '/status]', safeLog({ status: newStatus }))

    if (!newStatus) return NextResponse.json({ error: 'status is required' }, { status: 400 })

    const lot = await prisma.production_details.findUnique({ where: { id: Number(id) } })
    if (!lot) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const fromStatus = lot.detail_status as string
    const allowed    = VALID_TRANSITIONS[fromStatus] ?? []

    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `Cannot transition from '${fromStatus}' to '${newStatus}'` },
        { status: 400 },
      )
    }

    const roles          = Array.isArray(session.user.roles) ? session.user.roles : []
    const approvalAction = resolveApprovalAction(fromStatus, newStatus, roles)

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.production_details.update({
        where: { id: Number(id) },
        data: {
          detail_status: newStatus as DetailStatus,
          ...(newStatus === 'rejected'    && { reject_remark: reject_remark ?? null }),
          ...(newStatus === 'sl_rejected' && { reject_remark: reject_remark ?? null }),
          ...(newStatus === 'submitted'   && { submitted_at: new Date() }),
          ...(pl_remark !== undefined     && { pl_remark }),
          updated_at: new Date(),
        },
      })

      if (approvalAction) {
        await tx.approval_logs.create({
          data: {
            production_detail_id: Number(id),
            action:               approvalAction,
            from_status:          fromStatus,
            to_status:            newStatus,
            actor_id:             Number(session.user.id),
            remark:               reject_remark ?? null,
            created_at:           new Date(),
          },
        })
      }

      return result
    })

    console.log('[PATCH /api/lots/' + id + '/status] done:', updated.detail_status)
    return NextResponse.json({ id: updated.id, status: updated.detail_status })
  } catch (err) {
    console.error('[PATCH /api/lots/[id]/status]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
