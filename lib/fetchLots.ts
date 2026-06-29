import { cleanDate, formatTime } from './utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function flattenLot(l: any) {
  const ibc = l.production_detail_ibc
  return {
    ...l,
    product:             l.product?.product_name || l.product_name || l.product || '',
    customer:            l.customer?.country_label || l.customer_name || l.customer || '',
    country_label:       l.country_label ?? l.customer?.country_label ?? null,
    blender:             l.plan?.blender?.code || l.blender_code || l.blender || '',
    packing_date:        cleanDate(l.operation_date || l.packing_date),
    drumming_start:      formatTime(l.lot_drumming_start || l.drumming_start),
    drumming_end:        formatTime(l.lot_drumming_end || l.drumming_end),
    status:              l.detail_status || l.status || 'draft',
    target_mt:           l.target_amount_mt || l.target_mt || 0,
    dept:                l.dept || l.product?.dept || l.plan?.form_type || '',
    lot:                 l.lot_no || l.lot || '',
    actual_mt:           l.actual_pallet_count || 0,
    export_on_pallet:    l.export_on_pallet       ?? null,
    empty_tank:          l.empty_tank             ?? null,
    flush_blender:       l.flush_blender           ?? null,
    label_no_start:      l.label_no_start          ?? null,
    label_no_end:        l.label_no_end            ?? null,
    drum_serial_start:   l.label_no_start          ?? null,
    drum_serial_end:     l.label_no_end            ?? null,
    label_count:         l.label_count             ?? null,
    label_pkg_type:      l.label_pkg_type          ?? null,
    planned_pallets:     l.planned_pallets          ?? null,
    cut_off_date:        l.cut_off_date             ?? null,
    packaging:           typeof l.packaging_type === 'object' && l.packaging_type !== null
      ? (l.packaging_type as any)?.name ?? null
      : typeof l.packaging === 'object' && l.packaging !== null
        ? (l.packaging as any)?.name ?? null
        : l.packaging ?? null,
    ibc_operator_name:   ibc?.operator_name     ?? l.ibc_operator_name    ?? null,
    ibc_quality_status:  ibc?.quality_status_lab ?? l.ibc_quality_status   ?? null,
    ibc_residue_kg:      ibc?.residue_kg         ?? l.ibc_residue_kg       ?? null,
    ibc_empty_before_kg: ibc?.empty_before_kg    ?? l.ibc_empty_before_kg  ?? null,
    ibc_with_product_kg: ibc?.with_product_kg    ?? l.ibc_with_product_kg  ?? null,
    ibc_product_net_kg:  ibc?.product_net_kg     ?? l.ibc_product_net_kg   ?? null,
    special_comm:        l.special_comm ?? null,
    plan_special_comm:   null,
    plan_id:             l.plan_id           ?? (l.plan as any)?.id          ?? null,
    plan_created_by:     l.plan_created_by   ?? (l.plan as any)?.creator?.full_name ?? null,
    plan_updated_by:     l.plan_updated_by   ?? (l.plan as any)?.updater?.full_name ?? null,
  }
}

export async function fetchAndFlattenLots() {
  const res = await fetch('/api/lots')
  if (!res.ok) return []
  const data = await res.json()
  if (!Array.isArray(data)) return []
  return data.map(flattenLot)
}
