import { NextRequest, NextResponse } from 'next/server'
import { auth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasRole(session.user.roles, "admin"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();

    // แยกค่าออกมาเพื่อตรวจสอบและแปลงประเภทข้อมูล
    const { country_label, is_active } = body;

    // สร้าง object สำหรับ update โดยแปลง is_active ถ้ามีส่งเข้ามา
    const dataToUpdate: any = {
      updated_at: new Date(),
    };

    if (country_label !== undefined) dataToUpdate.country_label = country_label;

    if (is_active !== undefined) {
      // แปลงเป็น boolean ถ้าเป็น string
      dataToUpdate.is_active =
        typeof is_active === "string"
          ? is_active === "true"
          : Boolean(is_active);
    }

    const updated = await prisma.customers.update({
      where: { id: Number(id) },
      data: dataToUpdate,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/customers/[id]] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasRole(session.user.roles, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    console.log('[DELETE /api/customers/' + id + '] deleting...')
    await prisma.customers.delete({ where: { id: Number(id) } })
    console.log('[DELETE /api/customers/' + id + '] done')
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/customers/[id]] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
