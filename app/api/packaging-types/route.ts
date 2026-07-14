import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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

// ค่ามาตรฐานตาม category — ใช้ตอนฟอร์มที่เรียกไม่มีช่องให้กรอก weight/pallet เอง
// (เช่น SL quick-create) ต้อง auto-fill ให้แทน — เลข set เดียวกับที่ Admin.tsx ใช้
// (ฟอร์มไหนส่งค่ามาเองตรงๆ เช่น Admin full form ยังใช้ค่าที่ส่งมาอยู่ ไม่ถูก override ทับ)
const PACKAGING_CATEGORY_DEFAULTS: Record<
  string,
  { standard_weight_kg: number; drums_per_pallet: number }
> = {
  drum: { standard_weight_kg: 210, drums_per_pallet: 4 },
  tote: { standard_weight_kg: 1000, drums_per_pallet: 1 },
};

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    let standardWeight: Prisma.Decimal | null;
    let drumsPerPallet: number | null;

    // เดิมเช็คจาก role (isAdmin) เพื่อเดาว่า request มาจากฟอร์มไหน แต่พังตอน account
    // มีหลาย role พร้อมกัน (เช่น admin ที่ก็มี role sl ด้วย) เพราะ isAdmin จะ true ตาม role จริง
    // ทั้งที่ตอนนั้นกำลังใช้ flow แบบ SL quick-create (ไม่มีช่องกรอกเลข) อยู่
    //
    // เปลี่ยนมาเช็คจาก "request ส่งค่ามาจริงไหม" แทน — ไม่พึ่ง role เลย ทำงานถูกไม่ว่า
    // account จะมีกี่ role ก็ตาม: ฟอร์มไหนส่งเลขมาก็ใช้ตามนั้น, ฟอร์มไหนไม่ส่งมา (ไม่มีช่องให้กรอก)
    // ก็ใช้ default ตาม category แทน
    const weightProvided = body.standard_weight_kg != null;
    const palletProvided = body.drums_per_pallet != null;

    if (weightProvided || palletProvided) {
      // ฟอร์มส่งค่ามาให้ตรงๆ (เช่น Admin full form) — ใช้ตามที่ส่งมา ไม่ auto-fill ทับ
      standardWeight = weightProvided
        ? new Prisma.Decimal(parseFloat(String(body.standard_weight_kg)) || 0)
        : null;
      drumsPerPallet = palletProvided
        ? parseInt(String(body.drums_per_pallet)) || null
        : null;
    } else {
      // ไม่มีช่องให้กรอกเลขเลย (เช่น SL quick-create) — พึ่ง default ตาม category แทน
      // ถ้า category ไม่มี default กำหนดไว้ (ibc/isotank/flexibag) ปล่อย null ให้ Admin เติมทีหลัง
      const defaults = PACKAGING_CATEGORY_DEFAULTS[category as string];
      standardWeight = defaults
        ? new Prisma.Decimal(defaults.standard_weight_kg)
        : null;
      drumsPerPallet = defaults ? defaults.drums_per_pallet : null;
    }

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
