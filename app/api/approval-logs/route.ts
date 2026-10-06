import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const production_detail_id = searchParams.get("production_detail_id");

  if (!production_detail_id) {
    return NextResponse.json([]);
  }

  const detailId = Number(production_detail_id);

  // Main ก่อน
  const mainLogs = await prisma.approval_logs.findMany({
    where: {
      production_detail_id: detailId,
    },
    include: {
      actor: {
        select: {
          full_name: true,
          username: true,
        },
      },
    },
    orderBy: {
      created_at: "asc",
    },
  });

  if (mainLogs.length > 0) {
    return NextResponse.json(mainLogs);
  }

  // Archive
  const archiveLogs = await prisma.approval_logs_archive.findMany({
    where: {
      production_detail_id: detailId,
    },
    orderBy: {
      created_at: "asc",
    },
  });

  // actor_id ยังชี้ไป users เดิม
  const actorIds = [...new Set(archiveLogs.map((log) => log.actor_id))];

  const actors = await prisma.users.findMany({
    where: {
      id: {
        in: actorIds,
      },
    },
    select: {
      id: true,
      full_name: true,
      username: true,
    },
  });

  const actorMap = new Map(actors.map((actor) => [actor.id, actor]));

  const logs = archiveLogs.map((log) => ({
    ...log,
    actor: actorMap.get(log.actor_id) ?? null,
  }));

  return NextResponse.json(logs);
}