// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeStr(val: unknown): string {
  if (val === null || val === undefined) return "-"
  if (typeof val === 'object') {
    return (val as any)?.name
      || (val as any)?.country_label
      || (val as any)?.product_name
      || "-"
  }
  return String(val)
}

function getContainerTypeLabel(packaging?: string): string {
  const pkg = (packaging || '').toLowerCase()
  if (pkg.includes('tote')) return 'Tote'
  if (pkg.includes('ibc'))  return 'IBC'
  return 'Drum'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildPlanFields(lot: Record<string, any>) {
  return [
    { l: "Product", v: safeStr(lot.product || lot.product_name) },
    { l: "Lot No.", v: safeStr(lot.lot || lot.lot_no) },
    { l: "Customer / Country Label", v: safeStr(lot.country_label || lot.customer) },
    { l: "Tank / Blender No.", v: safeStr(lot.blender) },
    { l: "Site Logistics (SL)", v: safeStr(lot.plan_created_by) },
    { l: "Packaging", v: safeStr(lot.packaging || lot.packaging_type) },
    { l: "Target Amount", v: lot.target_mt ? `${lot.target_mt} MT` : "-" },
    { l: "Planned Pallets", v: lot.planned_pallets ? `${lot.planned_pallets} pallets` : "-" },
    { l: "Operation Date (SL)", v: safeStr(lot.packing_date
      ? String(lot.packing_date).slice(0, 10).split('-').reverse().join('-')
      : "-") },
    { l: "Cut off Date", v: safeStr(lot.cut_off_date
      ? String(lot.cut_off_date).slice(0, 10).split('-').reverse().join('-')
      : "-") },
    { l: "Label No.", v: lot.label_no_start && lot.label_no_end
      ? `${lot.label_no_start} – ${lot.label_no_end}` : "-" },
    { l: "Label Count", v: lot.label_count ? `${lot.label_count} ใบ` : "-" },
    { l: `จำนวน ${getContainerTypeLabel(lot.packaging)} ที่ต้องใช้`, v: lot.label_count ? `${lot.label_count} ${getContainerTypeLabel(lot.packaging)}` : "-" },
    lot.dept === 'Latex'
      ? { l: "Empty Tank", v: lot.empty_tank ? "Yes" : "No" }
      : { l: "Export on Pallet", v: lot.export_on_pallet ? "Yes" : "No" },
    ...(!['Latex', 'IBC'].includes(lot.dept) ? [
      { l: "Flush Blender", v: safeStr(lot.flush_blender) },
    ] : []),
    ...(lot.dept === "IBC" ? [
      { l: "Operator Name",                   v: safeStr(lot.ibc_operator_name || lot.operator_name) },
      { l: "Quality Status",                  v: safeStr(lot.ibc_quality_status || lot.quality_status) },
      { l: "น้ำหนัก ที่ เศษ ใน IBC ที่",        v: lot.ibc_residue_kg ? `${lot.ibc_residue_kg}` : "-" },
      { l: "น้ำหนัก IBC เปล่าก่อนผลิต (KG)",    v: lot.ibc_empty_before_kg ? `${lot.ibc_empty_before_kg} kg` : "-" },
      { l: "น้ำหนัก IBC เปล่า + Product (KG)",  v: lot.ibc_with_product_kg ? `${lot.ibc_with_product_kg} kg` : "-" },
      { l: "น้ำหนัก Product (KG)",              v: lot.ibc_product_net_kg ? `${lot.ibc_product_net_kg} kg` : "-" },
    ] : []),
  ]
}
