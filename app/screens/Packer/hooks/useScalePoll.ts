import { useEffect } from "react";
import type { Lot } from "../types";

interface UseScalePollParams {
  lot: Lot;
  // Non-Latex
  scalePendingPL: boolean;
  scaleApproved: boolean;
  setScaleApproved: (v: boolean) => void;
  setScalePendingPL: (v: boolean) => void;
  setScaleApprovedBy?: (v: string) => void;
  setScalePendingPLFalse?: () => void; // reset เมื่อ PL reject
  // Latex (Manual + Auto submitted/approved together as one pair)
  latexScalePending: boolean;
  latexScaleApproved: boolean;
  setLatexScaleApproved: (v: boolean) => void;
  setLatexScalePending: (v: boolean) => void;
}

export function useScalePoll({
  lot,
  scalePendingPL,
  scaleApproved,
  setScaleApproved,
  setScalePendingPL,
  setScaleApprovedBy,
  latexScalePending,
  latexScaleApproved,
  setLatexScaleApproved,
  setLatexScalePending,
}: UseScalePollParams) {
  // Poll for non-Latex scale approval
  useEffect(() => {
    if (lot.dept === "Latex") return;
    if (!scalePendingPL || scaleApproved) return;
    const interval = setInterval(async () => {
      try {
        // เช็ค lot status ก่อน — ถ้า PL reject จะกลับมาเป็น in_progress
        const lotRes = await fetch(`/api/lots/${lot.id}`);
        if (lotRes.ok) {
          const lotData = await lotRes.json();
          if (
            lotData.detail_status === "in_progress" ||
            lotData.status === "in_progress"
          ) {
            // PL rejected scale — reset ให้ Packer ทำ scale ใหม่
            setScalePendingPL(false);
            setScaleApproved(false);
            clearInterval(interval);
            return;
          }
        }

        const res = await fetch(
          `/api/scale-verifications?production_detail_id=${lot.id}`,
        );
        if (!res.ok) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list = (await res.json()) as any[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyApproved =
          Array.isArray(list) &&
          list.some(
            (v: any) => v.is_locked === true || v.pl_approved_at !== null,
          );
        if (anyApproved) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const approvedRecord = list.find((v: any) => v.pl_approved_at);
          if (approvedRecord?.pl_approver?.full_name)
            setScaleApprovedBy?.(approvedRecord.pl_approver.full_name);
          setScaleApproved(true);
          setScalePendingPL(false);
          clearInterval(interval);
        }
      } catch (err) {
        console.error("[Packer Poll] error:", err);
      }
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scalePendingPL, scaleApproved, lot.id]);

  // Poll for Latex scale approval (Manual round_no=1 + Auto round_no=2, approved as one pair)
  useEffect(() => {
    if (lot.dept !== "Latex") return;
    if (!latexScalePending || latexScaleApproved) return;
    const interval = setInterval(async () => {
      try {
        // เช็ค lot status ก่อน — ถ้า PL reject จะกลับมาเป็น in_progress
        const lotRes = await fetch(`/api/lots/${lot.id}`);
        if (lotRes.ok) {
          const lotData = await lotRes.json();
          if (
            lotData.detail_status === "in_progress" ||
            lotData.status === "in_progress"
          ) {
            // PL rejected scale — reset ให้ Packer ทำ scale ใหม่ทั้งคู่ (Manual + Auto)
            setLatexScalePending(false);
            setLatexScaleApproved(false);
            clearInterval(interval);
            return;
          }
        }

        const res = await fetch(
          `/api/scale-verifications?production_detail_id=${lot.id}`,
        );
        if (!res.ok) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list = (await res.json()) as any[];
        if (!Array.isArray(list)) return;
        // ทั้ง Manual (round_no=1) และ Auto (round_no=2) ต้องถูก approve พร้อมกัน
        const v1Approved = list.some(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (v: any) =>
            v.round_no === 1 &&
            (v.is_locked === true || v.pl_approved_at !== null),
        );
        const v2Approved = list.some(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (v: any) =>
            v.round_no === 2 &&
            (v.is_locked === true || v.pl_approved_at !== null),
        );
        if (v1Approved && v2Approved) {
          setLatexScaleApproved(true);
          setLatexScalePending(false);
        }
      } catch (err) {
        console.error("[Packer Scale] poll error:", err);
      }
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latexScalePending, latexScaleApproved, lot.id]);
}
