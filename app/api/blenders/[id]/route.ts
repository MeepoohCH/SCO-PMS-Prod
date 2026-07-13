import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasRole(session.user.roles, "admin"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    console.log("[PATCH /api/blenders/" + id + "] body:", JSON.stringify(body));

    const data: Record<string, unknown> = { updated_at: new Date() };
    if (body.code != null) data.code = body.code;
    if (body.dept != null) data.dept = body.dept;
    if (body.status != null) data.status = body.status;

    // capacity_mt เป็น optional — ต้องเช็คด้วย 'in' แทน != null
    // เพราะเดิมถ้า client ส่ง capacity_mt: null มา (เพื่อล้างค่า) เงื่อนไข != null
    // จะข้ามไปเฉยๆ ทำให้ล้างค่ากลับเป็น null ไม่ได้เลย
    if ("capacity_mt" in body) {
      const raw = body.capacity_mt;
      const parsedCapacity =
        raw === null || raw === "" || raw === undefined ? null : Number(raw);

      if (parsedCapacity !== null && Number.isNaN(parsedCapacity)) {
        return NextResponse.json(
          { error: "capacity_mt must be a number" },
          { status: 400 },
        );
      }
      data.capacity_mt = parsedCapacity;
    }

    const updated = await p.blenders.update({
      where: { id: Number(id) },
      data,
    });
    console.log("[PATCH /api/blenders/" + id + "] updated ok");
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/blenders/[id]] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasRole(session.user.roles, "admin"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    console.log("[DELETE /api/blenders/" + id + "] deleting...");
    await prisma.blenders.delete({ where: { id: Number(id) } });
    console.log("[DELETE /api/blenders/" + id + "] done");
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/blenders/[id]] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
