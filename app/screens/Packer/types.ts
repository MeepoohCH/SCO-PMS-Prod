import type { DeptKey, LotStatus } from '@/app/components/constants'

export type { DeptKey, LotStatus }

export type AutosaveStatus = 'saving' | 'saved' | null

export type PauseTypeKey = 'paused_shift_end' | 'paused_issue' | 'paused_emergency'

export interface Lot {
  id: number;
  dept: DeptKey;
  product: string;
  lot: string;
  packing_date: string;
  status: LotStatus;
  pauseReason?: string;
  target_mt: number;
  blender?: string;
  label_count?: number;
  label_no_start?: number;
  label_no_end?: number;
  country_label?: string;
  customer?: string;
  packaging?: string;
  planned_pallets: number;
  done_pallets: number;
  actual_mt?: number;
  reject_remark?: string | null;
  plan_change_notified?: boolean;
  plan_changed_at?: string;
  current_pk_step?: number;
  fixSection?: string | null;
  fixPallet?: number | null;
  scale_pending_pl?: boolean;
  scale_data?: Record<string, unknown>;
  scale_type?: string;
  scale_weight?: number | string;
  recal?: string;
  scale_verifications?: {
    id: number;
    pl_approved_by?: number | null;
    pl_approver?: {
      id: number;
      full_name: string;
    } | null;
  }[];
  // IBC
  ibc_quality_status?: string;
  ibc_residue_kg?: string;
  ibc_empty_before_kg?: string;
  ibc_full_kg?: string;
  cut_off_date?: string;
  // Latex
  latex_empty_tank_kg?: string;
  // Plan extras
  special_comm?: string;
}

export interface RecheckEntry {
  no: number
  wt: string
  pass: boolean
  failReason?: string
}

export interface Session {
  no: number;
  recheck: RecheckEntry[];
  startTime: string;
  pass: boolean;
  wt?: string;
  ok?: boolean;
  preChk45?: Record<number, string>;
  sampleType?: string;
}

export interface DowntimeLog {
  start?: string
  end?: string
  type: string
  reason?: string
  newOperator?: string | null
}

export interface MduVals {
  w?: string
  recalib?: string
  drumSet?: string
  drumSetCustom?: string
  customTolerance?: string
}

export interface ApiChecklistItem {
  id: number
  form_type: string
  phase: 'pre' | 'post'
  item_label: string
  response_type: string
  select_options: string[] | null
  is_required: boolean
  is_active: boolean
}
