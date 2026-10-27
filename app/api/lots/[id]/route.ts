import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const sanitizeLog = (str: unknown) => String(str).replace(/[\n\r]/g, "_");

function mapLot<T extends Record<string, unknown>>(lot: T) {
  const ibc = lot.production_detail_ibc as
    | Record<string, unknown>
    | null
    | undefined;

  const plan = (lot as any).plan as Record<string, unknown> | null | undefined;
  const product = lot.product as Record<string, unknown> | null | undefined;

  return {
    ...lot,
    status: lot.detail_status,
    target_mt: lot.target_amount_mt,
    done_pallets: lot.actual_pallet_count,
    packing_date: lot.operation_date,
    drumming_start: lot.lot_drumming_start,
    drumming_end: lot.lot_drumming_end,
    gmid: product?.gmid ?? null,
    operator_name: ibc?.operator_name ?? null,
    quality_status: ibc?.quality_status_lab ?? null,
    ibc_operator_name: ibc?.operator_name ?? null,
    ibc_quality_status: ibc?.quality_status_lab ?? null,
    ibc_residue_kg: ibc?.residue_kg ?? null,
    ibc_empty_before_kg: ibc?.empty_before_kg ?? null,
    ibc_with_product_kg: ibc?.with_product_kg ?? null,
    ibc_product_net_kg: ibc?.product_net_kg ?? null,
    plan_id: (plan as any)?.id ?? null,
    plan_created_by: (plan as any)?.creator?.full_name ?? null,
    plan_updated_by: (plan as any)?.updater?.full_name ?? null,
    plan_special_comm: null,
    special_comm: lot.special_comm ?? null,
    label_no_start: lot.label_no_start ?? null,
    label_no_end: lot.label_no_end ?? null,
    drum_serial_start: lot.label_no_start ?? null,
    drum_serial_end: lot.label_no_end ?? null,
    label_count: lot.label_count ?? null,
    label_pkg_type: lot.label_pkg_type ?? null,
  };
}

async function validFk(
  table: "customers" | "packaging_types" | "products",
  val: unknown,
): Promise<number | null> {
  if (val == null) return null;
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  const exists = await (prisma[table] as any).findUnique({
    where: { id: n },
    select: { id: true },
  });
  return exists ? n : null;
}

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const safeId = sanitizeLog(id);
    const detailId = Number(id);

    if (!Number.isFinite(detailId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    console.log(`[GET /api/lots/${safeId}] fetching...`);

    // =========================================================
    // 1. MAIN
    // =========================================================

    const mainLot = await prisma.production_details.findUnique({
      where: { id: detailId },
      include: {
        product: true,
        customer: true,
        packaging_type: true,

        plan: {
          include: {
            blender: true,
            creator: {
              select: {
                id: true,
                full_name: true,
              },
            },
            updater: {
              select: {
                id: true,
                full_name: true,
              },
            },
          },
        },

        production_detail_ibc: true,
        latex_drumming_data: true,

        recorder: {
          select: {
            id: true,
            full_name: true,
          },
        },

        drumming_sessions: {
          include: {
            recheck_weight_logs: true,
          },
        },

        scale_verifications: true,

        checklist_responses: {
          include: {
            checklist_item: true,
          },
        },

        approval_logs: {
          include: {
            actor: {
              select: {
                id: true,
                full_name: true,
              },
            },
          },
          orderBy: {
            created_at: "asc",
          },
        },
      },
    });

    // =========================================================
    // 2. ถ้าเจอใน MAIN → ใช้ของเดิม
    // =========================================================

    if (mainLot) {
      console.log(`[GET /api/lots/${safeId}] found in MAIN`);

      const allLotsForRanking = await prisma.production_details.findMany({
        select: {
          id: true,
        },
        orderBy: {
          id: "asc",
        },
      });

      const rank = allLotsForRanking.findIndex((l) => l.id === mainLot.id) + 1;

      return NextResponse.json({
        ...mapLot(mainLot as unknown as Record<string, unknown>),
        display_no: rank > 0 ? rank : null,
        data_source: "main",
      });
    }

    // =========================================================
    // 3. ไม่เจอ Main → หา ARCHIVE
    // =========================================================

    const archiveLot = await prisma.production_details_archive.findUnique({
      where: {
        id: detailId,
      },
    });

    console.log(`[GET /api/lots/${safeId}] found in ARCHIVE:`, !!archiveLot);

    if (!archiveLot) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // =========================================================
    // 4. Master Data
    // =========================================================

    const [product, customer, packagingType, recorder, planArchive] =
      await Promise.all([
        archiveLot.product_id
          ? prisma.products.findUnique({
              where: {
                id: archiveLot.product_id,
              },
            })
          : null,

        archiveLot.customer_id
          ? prisma.customers.findUnique({
              where: {
                id: archiveLot.customer_id,
              },
            })
          : null,

        archiveLot.packaging_type_id
          ? prisma.packaging_types.findUnique({
              where: {
                id: archiveLot.packaging_type_id,
              },
            })
          : null,

        archiveLot.recorded_by
          ? prisma.users.findUnique({
              where: {
                id: archiveLot.recorded_by,
              },
              select: {
                id: true,
                full_name: true,
              },
            })
          : null,

        prisma.production_plans_archive.findUnique({
          where: {
            id: archiveLot.plan_id,
          },
        }),
      ]);

    // =========================================================
    // 5. Plan + Master Data
    // =========================================================

    let plan = null;

    if (planArchive) {
      const [blender, creator, updater] = await Promise.all([
        planArchive.blender_id
          ? prisma.blenders.findUnique({
              where: {
                id: planArchive.blender_id,
              },
            })
          : null,

        planArchive.created_by
          ? prisma.users.findUnique({
              where: {
                id: planArchive.created_by,
              },
              select: {
                id: true,
                full_name: true,
              },
            })
          : null,

        planArchive.updated_by
          ? prisma.users.findUnique({
              where: {
                id: planArchive.updated_by,
              },
              select: {
                id: true,
                full_name: true,
              },
            })
          : null,
      ]);

      plan = {
        ...planArchive,
        blender,
        creator,
        updater,
      };
    }

    // =========================================================
    // 6. IBC
    // =========================================================

    const ibc = await prisma.production_detail_ibc_archive.findUnique({
      where: {
        production_detail_id: detailId,
      },
    });

    // =========================================================
    // 7. Latex
    // =========================================================

    const latex = await prisma.latex_drumming_data_archive.findUnique({
      where: {
        production_detail_id: detailId,
      },
    });

    // =========================================================
    // 8. Drumming Sessions
    // =========================================================

    const sessions = await prisma.drumming_sessions_archive.findMany({
      where: {
        production_detail_id: detailId,
      },
      orderBy: {
        session_no: "asc",
      },
    });

    // Recheck ของแต่ละ Session
    const sessionIds = sessions.map((session) => session.id);

    const recheckLogs =
      sessionIds.length > 0
        ? await prisma.recheck_weight_logs_archive.findMany({
            where: {
              drumming_session_id: {
                in: sessionIds,
              },
            },
            orderBy: [
              {
                pallet_no: "asc",
              },
              {
                attempt_no: "asc",
              },
            ],
          })
        : [];

    const recheckMap = new Map<number, typeof recheckLogs>();

    for (const log of recheckLogs) {
      const existing = recheckMap.get(log.drumming_session_id) ?? [];

      existing.push(log);
      recheckMap.set(log.drumming_session_id, existing);
    }

    const drummingSessions = sessions.map((session) => ({
      ...session,

      recheck_weight_logs: recheckMap.get(session.id) ?? [],
    }));

    // =========================================================
    // 9. Scale Verification
    // =========================================================

    const scaleVerifications =
      await prisma.scale_verifications_archive.findMany({
        where: {
          production_detail_id: detailId,
        },
        orderBy: {
          round_no: "asc",
        },
      });

    // =========================================================
    // 10. Checklist
    // =========================================================

    const checklistResponses =
      await prisma.checklist_responses_archive.findMany({
        where: {
          production_detail_id: detailId,
        },
        orderBy: [
          {
            phase: "asc",
          },
          {
            pallet_no: "asc",
          },
        ],
      });

    const checklistItemIds = [
      ...new Set(
        checklistResponses.map((response) => response.checklist_item_id),
      ),
    ];

    const checklistItems =
      checklistItemIds.length > 0
        ? await prisma.checklist_items.findMany({
            where: {
              id: {
                in: checklistItemIds,
              },
            },
          })
        : [];

    const checklistItemMap = new Map(
      checklistItems.map((item) => [item.id, item]),
    );

    const mappedChecklistResponses = checklistResponses.map((response) => ({
      ...response,
      checklist_item: checklistItemMap.get(response.checklist_item_id) ?? null,
    }));

    // =========================================================
    // 11. Downtime
    // =========================================================

    const downtimeLogs = await prisma.downtime_logs_archive.findMany({
      where: {
        production_detail_id: detailId,
      },
      orderBy: {
        start_time: "asc",
      },
    });

    // =========================================================
    // 12. Approval Logs + Actor
    // =========================================================

    const approvalLogs = await prisma.approval_logs_archive.findMany({
      where: {
        production_detail_id: detailId,
      },
      orderBy: {
        created_at: "asc",
      },
    });

    const actorIds = [...new Set(approvalLogs.map((log) => log.actor_id))];

    const actors =
      actorIds.length > 0
        ? await prisma.users.findMany({
            where: {
              id: {
                in: actorIds,
              },
            },
            select: {
              id: true,
              full_name: true,
            },
          })
        : [];

    const actorMap = new Map(actors.map((actor) => [actor.id, actor]));

    const mappedApprovalLogs = approvalLogs.map((log) => ({
      ...log,
      actor: actorMap.get(log.actor_id) ?? null,
    }));

    // =========================================================
    // 13. สร้าง Object ให้หน้าบ้านใช้รูปแบบเดียวกับ MAIN
    // =========================================================

    const archiveLotForResponse = {
      ...archiveLot,

      product,
      customer,
      packaging_type: packagingType,

      plan,

      production_detail_ibc: ibc,
      latex_drumming_data: latex,

      recorder,

      drumming_sessions: drummingSessions,

      scale_verifications: scaleVerifications,

      checklist_responses: mappedChecklistResponses,

      downtime_logs: downtimeLogs,

      approval_logs: mappedApprovalLogs,
    };

    // =========================================================
    // 14. Ranking
    // =========================================================

    const [mainCount, archiveOlderIds] = await Promise.all([
      prisma.production_details.count({
        where: {
          id: {
            lt: detailId,
          },
        },
      }),

      prisma.production_details_archive.count({
        where: {
          id: {
            lt: detailId,
          },
        },
      }),
    ]);

    const rank = mainCount + archiveOlderIds + 1;

    // =========================================================
    // 15. Response
    // =========================================================

    return NextResponse.json({
      ...mapLot(archiveLotForResponse as unknown as Record<string, unknown>),

      display_no: rank,
      data_source: "archive",
    });
  } catch (err) {
    console.error("[GET /api/lots/[id]]", err);

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const safeId = sanitizeLog(id);

    const existing = await prisma.production_details.findUnique({
      where: { id: Number(id) },
    });
    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await req.json()) as Record<string, unknown>;

    // ป้องกัน Log Injection โดยการ sanitize ข้อมูลก่อนนำไปพิมพ์ Log
    const safeBodyLog = sanitizeLog(JSON.stringify(body));
    console.log(`[PATCH /api/lots/${safeId}] body payload: ${safeBodyLog}`);

    const isAdmin = hasRole(session.user.roles, "admin");

    const {
      target_mt,
      target_amount_mt,
      done_pallets,
      packing_date,
      operation_date,
      drumming_start,
      drumming_end,
      cut_off_date,
      lot_no,
      product_id,
      customer_id,
      packaging_type_id,
      country_label,
      flush_blender,
      detail_status,
      planned_pallets,
      current_pk_step,
      label_no_start,
      label_no_end,
      label_count,
      label_pkg_type,
      label_remark,
      flush_kg,
      purge_kg,
      drain_kg,
      container_drum,
      container_tote,
      cap_large,
      cap_small,
      actual_drum_count,
      actual_tote_count,
      batch_size_kg,
      empty_drum_wt,
      draft_note,
      special_comm,
      operator_name,
      quality_status,
      ibc_residue_kg,
      ibc_empty_before_kg,
      ibc_with_product_kg,
      ibc_product_net_kg,
      pl_remark,
      export_on_pallet,
      empty_tank,
    } = body;

    let resolvedProductId: number | null | undefined = product_id as
      | number
      | null
      | undefined;
    const product_name = body.product_name as string | undefined;
    if (resolvedProductId == null && product_name?.trim()) {
      const dept = (body.dept as string) || existing.dept || undefined;
      const existingProduct = await prisma.products.findFirst({
        where: {
          product_name: product_name.trim(),
          ...(dept && { dept: dept as any }),
        },
      });
      if (existingProduct) {
        resolvedProductId = existingProduct.id;
      } else {
        const newProduct = await prisma.products.create({
          data: {
            product_name: product_name.trim(),
            dept: dept as any,
            is_active: true,
          },
        });
        resolvedProductId = newProduct.id;
        console.log(
          `[PATCH /api/lots/${safeId}] auto-created product ID: ${newProduct.id}`,
        );
      }
    }

    const safeProductId =
      resolvedProductId !== undefined
        ? await validFk("products", resolvedProductId)
        : undefined;
    const safeCustomerId =
      customer_id !== undefined
        ? await validFk("customers", customer_id)
        : undefined;
    const safePackagingTypeId =
      packaging_type_id !== undefined
        ? await validFk("packaging_types", packaging_type_id)
        : undefined;
    const todayThai = new Date(Date.now() + 7 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    await prisma.production_details.update({
      where: { id: Number(id) },
      data: {
        ...(lot_no !== undefined && { lot_no: lot_no as string }),
        ...(safeProductId !== undefined && { product_id: safeProductId }),
        ...(safeCustomerId !== undefined && { customer_id: safeCustomerId }),
        ...(safePackagingTypeId !== undefined && {
          packaging_type_id: safePackagingTypeId,
        }),
        ...(country_label !== undefined && {
          country_label: country_label as string,
        }),
        ...(flush_blender !== undefined && {
          flush_blender: flush_blender as string,
        }),
        ...((target_amount_mt ?? target_mt) !== undefined && {
          target_amount_mt: target_amount_mt ?? target_mt,
        }),
        ...(done_pallets !== undefined && {
          actual_pallet_count:
            done_pallets === "" || done_pallets === null
              ? null
              : Number(done_pallets),
        }),
        ...((operation_date ?? packing_date) !== undefined && {
          operation_date:
            (operation_date ?? packing_date)
              ? new Date((operation_date ?? packing_date) as string)
              : null,
        }),
        ...(cut_off_date !== undefined && {
          cut_off_date: cut_off_date ? new Date(cut_off_date as string) : null,
        }),
        ...(drumming_start !== undefined && {
          lot_drumming_start: drumming_start
            ? new Date(drumming_start as string)
            : null,
        }),
        ...(drumming_end !== undefined && {
          lot_drumming_end: drumming_end
            ? new Date(drumming_end as string)
            : null,
        }),
        ...(detail_status !== undefined &&
          isAdmin && { detail_status: detail_status as never }),
        ...(planned_pallets !== undefined && {
          planned_pallets:
            planned_pallets === "" || planned_pallets === null
              ? null
              : Number(planned_pallets),
        }),
        ...(current_pk_step !== undefined && {
          current_pk_step:
            current_pk_step === "" || current_pk_step === null
              ? null
              : Number(current_pk_step),
        }),
        ...(label_no_start !== undefined && { label_no_start }),
        ...(label_no_end !== undefined && { label_no_end }),
        ...(label_count !== undefined && {
          label_count:
            label_count === "" || label_count === null
              ? null
              : Number(label_count),
        }),
        ...(label_pkg_type !== undefined && { label_pkg_type }),
        ...(label_remark !== undefined && { label_remark }),
        ...(flush_kg !== undefined && { flush_kg }),
        ...(purge_kg !== undefined && { purge_kg }),
        ...(drain_kg !== undefined && { drain_kg }),
        ...(container_drum !== undefined && {
          container_drum:
            container_drum === "" || container_drum === null
              ? null
              : Number(container_drum),
        }),
        ...(container_tote !== undefined && {
          container_tote:
            container_tote === "" || container_tote === null
              ? null
              : Number(container_tote),
        }),
        ...(cap_large !== undefined && {
          cap_large:
            cap_large === "" || cap_large === null ? null : Number(cap_large),
        }),
        ...(cap_small !== undefined && {
          cap_small:
            cap_small === "" || cap_small === null ? null : Number(cap_small),
        }),
        ...(actual_drum_count !== undefined && {
          actual_drum_count:
            actual_drum_count === "" || actual_drum_count === null
              ? null
              : Number(actual_drum_count),
        }),
        ...(actual_tote_count !== undefined && {
          actual_tote_count:
            actual_tote_count === "" || actual_tote_count === null
              ? null
              : Number(actual_tote_count),
        }),
        ...(batch_size_kg !== undefined && { batch_size_kg }),
        ...(empty_drum_wt !== undefined && { empty_drum_wt }),
        ...(draft_note !== undefined && { draft_note }),
        ...(special_comm !== undefined && { special_comm }),
        ...(body.label_check !== undefined && {
          label_check: body.label_check,
        }),
        ...(body.mdu_machine !== undefined && {
          mdu_machine: body.mdu_machine,
        }),
        ...(body.drum_set !== undefined && { drum_set: body.drum_set }),
        ...(body.recalibration !== undefined && {
          recalibration: body.recalibration,
        }),
        ...(body.sample_type !== undefined && {
          sample_type: body.sample_type,
        }),
        ...(pl_remark !== undefined && { pl_remark }),
        ...(export_on_pallet !== undefined && {
          export_on_pallet: Boolean(export_on_pallet),
        }),
        ...(empty_tank !== undefined && { empty_tank: Boolean(empty_tank) }),
        ...(body.lot_drumming_start !== undefined && {
          lot_drumming_start: body.lot_drumming_start
            ? new Date(
                String(body.lot_drumming_start).includes("T")
                  ? String(body.lot_drumming_start)
                  : `${todayThai}T${body.lot_drumming_start}:00+07:00`,
              )
            : null,
        }),
        ...(body.lot_drumming_end !== undefined && {
          lot_drumming_end: body.lot_drumming_end
            ? new Date(
                String(body.lot_drumming_end).includes("T")
                  ? String(body.lot_drumming_end)
                  : `${todayThai}T${body.lot_drumming_end}:00+07:00`,
              )
            : null,
        }),
        ...(body.actual_pallet_count !== undefined && {
          actual_pallet_count: body.actual_pallet_count,
        }),
        ...(body.operators_json !== undefined && {
          operators_json: body.operators_json,
        }),
        updated_at: new Date(),
      } as any,
    });

    const ibcFields = {
      operator_name,
      quality_status,
      ibc_residue_kg,
      ibc_empty_before_kg,
      ibc_with_product_kg,
      ibc_product_net_kg,
    };
    const hasIbc = Object.values(ibcFields).some((v) => v !== undefined);
    if (hasIbc) {
      const ibcData = {
        ...(operator_name !== undefined && {
          operator_name: operator_name as string,
        }),
        ...(quality_status !== undefined && {
          quality_status_lab: quality_status as string,
        }),
        ...(ibc_residue_kg !== undefined && {
          residue_kg: ibc_residue_kg ? String(ibc_residue_kg) : null,
        }),
        ...(ibc_empty_before_kg !== undefined && {
          empty_before_kg: Number(ibc_empty_before_kg),
        }),
        ...(ibc_with_product_kg !== undefined && {
          with_product_kg: Number(ibc_with_product_kg),
        }),
        ...(ibc_product_net_kg !== undefined && {
          product_net_kg: Number(ibc_product_net_kg),
        }),
        updated_at: new Date(),
      };
      await prisma.production_detail_ibc.upsert({
        where: { production_detail_id: Number(id) },
        create: {
          production_detail_id: Number(id),
          created_at: new Date(),
          ...ibcData,
        },
        update: ibcData,
      });
    }

    const ibc_data_nested = body.ibc_data as
      | {
          operator_name?: string;
          quality_status?: string;
          ibc_residue_kg?: string;
          ibc_empty_before_kg?: string;
          ibc_with_product_kg?: string;
          ibc_product_net_kg?: string;
        }
      | undefined;
    if (ibc_data_nested) {
      const d = ibc_data_nested;
      const ibcPayload = {
        operator_name: d.operator_name ?? null,
        quality_status_lab: d.quality_status ?? null,
        residue_kg: d.ibc_residue_kg ? String(d.ibc_residue_kg) : null,
        empty_before_kg: d.ibc_empty_before_kg
          ? Number(d.ibc_empty_before_kg)
          : null,
        with_product_kg: d.ibc_with_product_kg
          ? Number(d.ibc_with_product_kg)
          : null,
        product_net_kg: d.ibc_product_net_kg
          ? Number(d.ibc_product_net_kg)
          : null,
        updated_at: new Date(),
      };
      await prisma.production_detail_ibc.upsert({
        where: { production_detail_id: Number(id) },
        create: {
          production_detail_id: Number(id),
          created_at: new Date(),
          ...ibcPayload,
        },
        update: ibcPayload,
      });
    }

    try {
      const detail = await prisma.production_details.findUnique({
        where: { id: Number(id) },
        select: { plan_id: true },
      });
      if (detail?.plan_id) {
        await prisma.production_plans.update({
          where: { id: detail.plan_id },
          data: {
            updated_by: Number(session.user.id),
            updated_at: new Date(),
          },
        });
      }
    } catch (e) {
      console.error(
        `[PATCH /api/lots/${safeId}] update plan updated_by failed`,
      );
    }

    const finalLotWithIbc = await prisma.production_details.findUnique({
      where: { id: Number(id) },
      include: {
        product: true,
        customer: true,
        packaging_type: true,
        plan: {
          include: {
            blender: true,
            creator: { select: { id: true, full_name: true } },
            updater: { select: { id: true, full_name: true } },
          },
        },
        production_detail_ibc: true,
      },
    });

    return NextResponse.json(
      mapLot(finalLotWithIbc as unknown as Record<string, unknown>),
    );
  } catch (err) {
    console.error("[PATCH /api/lots/[id]] error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id: idStr } = await params;
  const safeId = sanitizeLog(idStr);
  const id = Number(idStr);
  try {
    const session = await auth();
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasRole(session.user.roles, "sl", "admin"))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    console.log(`[DELETE /api/lots/${safeId}] starting...`);

    const detail = await prisma.production_details.findUnique({
      where: { id },
      select: { plan_id: true },
    });
    const planId = detail?.plan_id;

    await prisma.checklist_responses.deleteMany({
      where: { production_detail_id: id },
    });
    await prisma.downtime_logs.deleteMany({
      where: { production_detail_id: id },
    });
    await prisma.scale_verifications.deleteMany({
      where: { production_detail_id: id },
    });
    await prisma.approval_logs.deleteMany({
      where: { production_detail_id: id },
    });
    await prisma.production_detail_ibc.deleteMany({
      where: { production_detail_id: id },
    });
    await prisma.latex_drumming_data.deleteMany({
      where: { production_detail_id: id },
    });

    const sessions = await prisma.drumming_sessions.findMany({
      where: { production_detail_id: id },
      select: { id: true },
    });
    for (const s of sessions) {
      await prisma.recheck_weight_logs.deleteMany({
        where: { drumming_session_id: s.id },
      });
    }
    await prisma.drumming_sessions.deleteMany({
      where: { production_detail_id: id },
    });

    await prisma.production_details.delete({ where: { id } });
    console.log(`[DELETE /api/lots/${safeId}] lot deleted`);

    if (planId) {
      const remaining = await prisma.production_details.count({
        where: { plan_id: planId },
      });
      if (remaining === 0) {
        await prisma.production_plans.delete({ where: { id: planId } });
        console.log(`[DELETE /api/lots/${safeId}] empty plan deleted`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[DELETE /api/lots/${safeId}] error`);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
