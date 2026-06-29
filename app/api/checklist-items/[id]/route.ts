import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasRole(session.user.roles, "admin"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    console.log('[PATCH /api/checklist-items/' + id + '] body:', JSON.stringify(body))

    const data: Record<string, unknown> = {};
    if (body.form_type !== undefined) data.form_type = body.form_type;
    if (body.phase !== undefined) data.phase = body.phase;
    if (body.item_order !== undefined)
      data.item_order = Number(body.item_order);
    if (body.item_label !== undefined) data.item_label = body.item_label;
    if (body.response_type !== undefined)
      data.response_type = body.response_type;
    if (body.is_required !== undefined)
      data.is_required =
        body.is_required === true || body.is_required === "true";
    if (body.is_active !== undefined)
      data.is_active = body.is_active === true || body.is_active === "true";
    if (body.is_per_pallet !== undefined)
      data.is_per_pallet =
        body.is_per_pallet === true || body.is_per_pallet === "true";

    // Handle select_options: explicit value takes priority, fallback from response_type
    if (body.select_options !== undefined || body.response_type !== undefined) {
      let parsedOptions: string[] | undefined;
      if (body.select_options !== undefined) {
        if (Array.isArray(body.select_options)) {
          parsedOptions = body.select_options as string[];
        } else if (
          typeof body.select_options === "string" &&
          (body.select_options as string).trim()
        ) {
          try {
            parsedOptions = JSON.parse(body.select_options as string);
          } catch {
            parsedOptions = undefined;
          }
        }
      }
      // Fallback to defaults only if no explicit select_options were provided
      if (!parsedOptions || parsedOptions.length === 0) {
        const rt = (body.response_type ?? "") as string;
        parsedOptions =
          rt === "yes_no"
            ? ["Yes", "No"]
            : rt === "select"
              ? ["Yes", "No", "NA"]
              : undefined;
      }
      data.select_options = parsedOptions;
    }

    const updated = await prisma.checklist_items.update({
      where: { id: Number(id) },
      data,
    });
    console.log('[PATCH /api/checklist-items/' + id + '] updated ok')
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/checklist-items/[id]] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// app/api/checklist-items/[id]/route.ts
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasRole(session.user.roles, "admin"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    console.log('[DELETE /api/checklist-items/' + id + '] deleting...')

    await prisma.checklist_responses.deleteMany({
      where: { checklist_item_id: Number(id) },
    });

    await prisma.checklist_items.delete({
      where: { id: Number(id) },
    });

    console.log('[DELETE /api/checklist-items/' + id + '] done')
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      (err as { code?: string }).code === "P2025"
    ) {
      return NextResponse.json({ success: true });
    }
    console.error("[DELETE /api/checklist-items/[id]] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
