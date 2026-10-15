import { NextRequest, NextResponse } from 'next/server'
import { auth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    const production_detail_id = searchParams.get("production_detail_id");

    const detailId = Number(production_detail_id);

    // =========================
    // MAIN
    // =========================
    const mainSessions = await prisma.drumming_sessions.findMany({
      where: {
        ...(production_detail_id && {
          production_detail_id: detailId,
        }),
      },
      orderBy: {
        started_at: "asc",
      },
    });

    if (mainSessions.length > 0) {
      return NextResponse.json(mainSessions);
    }

    // =========================
    // ARCHIVE
    // =========================
    const archiveSessions = await prisma.drumming_sessions_archive.findMany({
      where: {
        production_detail_id: detailId,
      },
      orderBy: {
        started_at: "asc",
      },
    });

    return NextResponse.json(archiveSessions);
  } catch (err) {
    console.error("[GET /api/drumming-sessions]", err);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!hasRole(session.user.roles, 'packer')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json() as {
      production_detail_id: number
      session_no: number
    }

    const { production_detail_id, session_no } = body

    if (!production_detail_id || !session_no) {
      return NextResponse.json({ error: 'production_detail_id and session_no are required' }, { status: 400 })
    }

  const detailId = Number(production_detail_id);
  const sessionNo = Number(session_no);

  if (!Number.isInteger(detailId) || detailId <= 0) {
    return NextResponse.json({ error: "Invalid production_detail_id" }, { status: 400 });
  }

  if (!Number.isInteger(sessionNo) || sessionNo <= 0) {
    return NextResponse.json({ error: "Invalid session_no" }, { status: 400 });
  }

  // ตรวจว่ามี pallet/session นี้อยู่แล้วหรือยัง
  const existing = await prisma.drumming_sessions.findFirst({
    where: {
      production_detail_id: detailId,
      session_no: sessionNo,
    },
  });

  if (existing) {
    // ถ้า frontend ยิงซ้ำ ไม่สร้าง record ใหม่
    return NextResponse.json(existing, { status: 200 });
  }

  const record = await prisma.drumming_sessions.create({
    data: {
      production_detail_id: detailId,
      session_no: sessionNo,
      operator_id: Number(session.user.id),
      started_at: new Date(),
      session_status: "in_progress",
      created_at: new Date(),
    },
  });

  return NextResponse.json(record, { status: 201 });
  } catch (err) {
    console.error('[POST /api/drumming-sessions]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
