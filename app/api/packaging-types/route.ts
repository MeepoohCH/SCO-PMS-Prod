import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { PackagingCategory } from "@prisma/client";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const types = await prisma.packaging_types.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(types);
  } catch (err) {
    console.error("[GET /api/packaging-types]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Fallback auto-detect (เผื่อ client ไม่ได้ส่ง packaging_category มา)
// — ใช้ logic เดียวกับ Admin.tsx
function detectCategory(name: string): PackagingCategory {
  const n = name.toLowerCase();
  if (n.includes("tote")) return "tote" as PackagingCategory;
  if (n.includes("ibc")) return "ibc" as PackagingCategory;
  if (n.includes("isotank")) return "isotank" as PackagingCategory;
  if (n.includes("flexibag")) return "flexibag" as PackagingCategory;
  return "drum" as PackagingCategory;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isAdmin = hasRole(session.user.roles, "admin");

    const body = (await req.json()) as {
      name: string;
      packaging_category?: string;
      standard_weight_kg?: number;
      drums_per_pallet?: number;
    };

    const { name, packaging_category } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const category = packaging_category
      ? (packaging_category as PackagingCategory)
      : detectCategory(name);

    // Quick-create จากหน้างาน (SL ฯลฯ): non-admin สร้างได้แค่ name (+ auto-detect category)
    // standard_weight_kg / drums_per_pallet ปล่อยเป็นค่าว่าง/ค่าเริ่มต้นไปก่อน ให้ Admin
    // เข้าไปเติมค่าจริงทีหลัง — เฉพาะ admin เท่านั้นที่กำหนดตัวเลขพวกนี้ตอนสร้างได้เลย
    const standardWeight =
      isAdmin && body.standard_weight_kg != null
        ? new Prisma.Decimal(parseFloat(String(body.standard_weight_kg)) || 0)
        : null;
    const drumsPerPallet =
      isAdmin && body.drums_per_pallet != null
        ? parseInt(String(body.drums_per_pallet)) || null
        : null;

    const record = await prisma.packaging_types.create({
      data: {
        name,
        packaging_category: category,
        standard_weight_kg: standardWeight,
        drums_per_pallet: drumsPerPallet,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Packaging type ชื่อนี้มีอยู่แล้วในระบบ" },
        { status: 409 },
      );
    }
    console.error("[POST /api/packaging-types]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
