import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const form_type = searchParams.get("form_type");
    const phase = searchParams.get("phase");

    const items = await prisma.checklist_items.findMany({
      where: {
        ...(phase && { phase: phase as "pre" | "post" }),
      },
      orderBy: { created_at: "asc" },
    });

    const filtered = form_type
      ? items.filter((i) =>
          i.form_type
            .split(",")
            .map((s) => s.trim())
            .includes(form_type),
        )
      : items;

    console.log('[GET /api/checklist-items] form_type:', form_type, 'phase:', phase, 'count:', filtered.length)
    return NextResponse.json(filtered);
  } catch (err) {
    console.error("[GET /api/checklist-items]", err);
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
    if (!hasRole(session.user.roles, "admin"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await req.json()) as {
      form_type: string;
      phase: string;
      item_label: string;
      response_type: string;
      select_options?: string | string[];
      is_required?: boolean | string;
    };

    const {
      form_type,
      phase,
      item_label,
      response_type,
      select_options,
      is_required = true,
    } = body;

    if (!form_type || !phase || !item_label || !response_type) {
      return NextResponse.json(
        {
          error: "form_type, phase, item_label and response_type are required",
        },
        { status: 400 },
      );
    }

    // Parse select_options — may arrive as JSON string or array from tag input
    let parsedOptions: string[] | undefined;
    if (Array.isArray(select_options)) {
      parsedOptions = select_options as string[];
    } else if (typeof select_options === "string" && select_options.trim()) {
      try {
        parsedOptions = JSON.parse(select_options);
      } catch {
        parsedOptions = undefined;
      }
    }
    // Fallback to sensible defaults only if Admin left it empty
    if (!parsedOptions || parsedOptions.length === 0) {
      parsedOptions =
        response_type === "yes_no"
          ? ["Yes", "No"]
          : response_type === "select"
            ? ["Yes", "No", "NA"]
            : undefined;
    }

    const created = await prisma.checklist_items.create({
      data: {
        form_type,
        phase: phase as "pre" | "post",
        item_label,
        response_type: response_type as "yes_no" | "select" | "text",
        select_options: parsedOptions,
        is_required: is_required === "true" || is_required === true,
        is_active: true,
        created_at: new Date(),
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("[POST /api/checklist-items]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
