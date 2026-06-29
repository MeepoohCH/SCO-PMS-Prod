import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const USER_SELECT = {
  id: true,
  username: true,
  full_name: true,
  pack_lead_id: true,
  is_active: true,
  dept: true,
  allowed_depts: true,
  must_change_password: true,
  created_at: true,
  updated_at: true,
  user_roles: { include: { role: true } },
} as const;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasRole(session.user.roles, "admin"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const users = await prisma.users.findMany({
      include: { user_roles: { include: { role: true } } },
      orderBy: { created_at: "desc" },
    });
    return NextResponse.json(
      users.map((u) => ({
        ...u,
        password_hash: undefined,
        roles: u.user_roles
          .map((ur) => ur.role?.role_name ?? String(ur.role_id))
          .join(","),
        allowed_depts: u.allowed_depts || "all",
      })),
    );
  } catch (err) {
    console.error("[GET /api/users]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const random = Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
  return `DOW-${random}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasRole(session.user.roles, "admin"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await req.json()) as {
      username: string;
      full_name: string;
      roles?: string[];
      dept?: string;
      allowed_depts?: string;
      pack_lead_id?: number | string | null;
    };

    const {
      username,
      full_name,
      roles = [],
      dept,
      allowed_depts,
      pack_lead_id,
    } = body;

    if (!username || !full_name) {
      return NextResponse.json(
        { error: "username and full_name are required" },
        { status: 400 },
      );
    }

    const tempPassword = generateTempPassword();
    const password_hash = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.users.create({
        data: {
          username,
          full_name,
          password_hash,
          is_active: true,
          dept: dept ?? "all",
          allowed_depts: allowed_depts ?? "all",
          pack_lead_id: pack_lead_id
            ? Number(pack_lead_id)
            : null,
          must_change_password: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        select: USER_SELECT,
      });

      if (roles.length > 0) {
        const roleRows = await tx.roles.findMany({
          where: { role_name: { in: roles } },
        });
        await tx.user_roles.createMany({
          data: roleRows.map((r) => ({
            user_id: created.id,
            role_id: r.id,
            granted_by: Number(session.user.id),
            granted_at: new Date(),
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    return NextResponse.json(
      { ...user, temp_password: tempPassword },
      { status: 201 },
    );
  } catch (err) {
    console.error("[POST /api/users]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
