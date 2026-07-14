import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { PackagingCategory } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

const VALID_CATEGORIES = ["tote", "ibc", "isotank", "flexibag", "drum"];

// ค่ามาตรฐานตาม category — ใช้ตอนเปลี่ยน packaging_category ผ่าน PATCH นี้
// แล้ว client ไม่ได้ส่ง weight/pallet มาด้วย (Admin.tsx เองมี auto-fill ฝั่ง client
// อยู่แล้วตอนเปลี่ยน dropdown แต่ใส่ไว้ที่ server ด้วยเป็น safety net เผื่อ path อื่นเรียกตรงมา)
const PACKAGING_CATEGORY_DEFAULTS: Record<
  string,
  { standard_weight_kg: number; drums_per_pallet: number }
> = {
  drum: { standard_weight_kg: 210, drums_per_pallet: 4 },
  tote: { standard_weight_kg: 1000, drums_per_pallet: 1 },
};

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasRole(session.user.roles, "admin"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    console.log(
      "[PATCH /api/packaging-types/" + id + "] body:",
      JSON.stringify(body),
    );

    // Whitelist เฉพาะ field ที่แก้ได้ — ไม่ spread ...body ตรงๆ
    // เพราะ Admin.tsx ส่ง editing.row ทั้งก้อนมา (มี id, created_at ติดมาด้วย)
    // ถ้า spread ดิบๆ จะพยายาม update primary key ตัวเองโดยไม่ตั้งใจ
    const data: Record<string, unknown> = { updated_at: new Date() };

    if (body.name != null) data.name = body.name;

    if (body.packaging_category != null) {
      const category = String(body.packaging_category);
      if (!VALID_CATEGORIES.includes(category)) {
        return NextResponse.json(
          { error: "Invalid packaging_category" },
          { status: 400 },
        );
      }
      data.packaging_category = category as PackagingCategory;

      // เปลี่ยน category แล้ว client ไม่ได้ส่ง weight/pallet มาด้วย (ไม่มี key นี้ใน body เลย)
      // → ลองเติม default ให้ตาม category ใหม่ แต่เฉพาะตอนค่าปัจจุบันใน DB ยังว่างอยู่จริง
      // (กันไม่ให้ไปทับตัวเลขที่ Admin ตั้งใจกรอกไว้แล้วก่อนหน้า)
      if (!("standard_weight_kg" in body) && !("drums_per_pallet" in body)) {
        const defaults = PACKAGING_CATEGORY_DEFAULTS[category];
        if (defaults) {
          const current = await prisma.packaging_types.findUnique({
            where: { id: Number(id) },
            select: { standard_weight_kg: true, drums_per_pallet: true },
          });
          if (current && current.standard_weight_kg == null) {
            data.standard_weight_kg = new Prisma.Decimal(
              defaults.standard_weight_kg,
            );
          }
          if (current && current.drums_per_pallet == null) {
            data.drums_per_pallet = defaults.drums_per_pallet;
          }
        }
      }
    }

    if ("standard_weight_kg" in body) {
      const raw = body.standard_weight_kg;
      if (raw === null || raw === "") {
        data.standard_weight_kg = null;
      } else {
        const parsed = parseFloat(String(raw));
        if (Number.isNaN(parsed)) {
          return NextResponse.json(
            { error: "standard_weight_kg must be a number" },
            { status: 400 },
          );
        }
        data.standard_weight_kg = new Prisma.Decimal(parsed);
      }
    }

    if ("drums_per_pallet" in body) {
      const raw = body.drums_per_pallet;
      if (raw === null || raw === "") {
        data.drums_per_pallet = null;
      } else {
        const parsed = parseInt(String(raw));
        if (Number.isNaN(parsed)) {
          return NextResponse.json(
            { error: "drums_per_pallet must be a number" },
            { status: 400 },
          );
        }
        data.drums_per_pallet = parsed;
      }
    }

    if (body.is_active != null) data.is_active = Boolean(body.is_active);

    const updated = await prisma.packaging_types.update({
      where: { id: Number(id) },
      data,
    });
    console.log("[PATCH /api/packaging-types/" + id + "] updated ok");
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/packaging-types/[id]] error:", err);
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
    console.log("[DELETE /api/packaging-types/" + id + "] deleting...");
    await prisma.packaging_types.delete({ where: { id: Number(id) } });
    console.log("[DELETE /api/packaging-types/" + id + "] done");
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/packaging-types/[id]] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
