import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { DeptEnum } from "@prisma/client";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const blenders = await prisma.blenders.findMany({
      orderBy: { code: "asc" },
    });
    return NextResponse.json(blenders);
  } catch (err) {
    console.error("[GET /api/blenders]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isAdmin = hasRole(session.user.roles, "admin");

    const body = (await req.json()) as {
      code: string;
      dept: string;
      capacity_mt?: number | string | null;
    };

    const { code, dept } = body;

    if (!code || !dept) {
      return NextResponse.json(
        { error: "code and dept are required" },
        { status: 400 },
      );
    }

    // Quick-create จากหน้างาน (SL ฯลฯ): non-admin สร้างได้แค่ code + dept
    // capacity_mt ถูกบังคับเป็น null เสมอสำหรับ non-admin — ต้องให้ Admin ไปตั้งค่าที่ถูกต้องทีหลัง
    // เฉพาะ admin เท่านั้นที่กำหนด capacity_mt ตอนสร้างได้เลย
    let parsedCapacity: number | null = null;
    if (isAdmin) {
      const capacity_mt = body.capacity_mt;
      parsedCapacity =
        capacity_mt === null || capacity_mt === undefined || capacity_mt === ""
          ? null
          : Number(capacity_mt);

      if (parsedCapacity !== null && Number.isNaN(parsedCapacity)) {
        return NextResponse.json(
          { error: "capacity_mt must be a number" },
          { status: 400 },
        );
      }
    }

    const blender = await prisma.blenders.create({
      data: {
        code,
        dept: dept as DeptEnum,
        capacity_mt: parsedCapacity,
        status: "active",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return NextResponse.json(blender, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      // Unique constraint บน code — เกิดได้บ่อยตอน quick-create เพราะไม่ได้เช็ค list ล่าสุดก่อนพิมพ์
      return NextResponse.json(
        { error: "Blender code นี้มีอยู่แล้วในระบบ" },
        { status: 409 },
      );
    }
    console.error("[POST /api/blenders]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
