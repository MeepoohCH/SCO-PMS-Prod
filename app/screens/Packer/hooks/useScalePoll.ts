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
  // Latex round 1
  latexScale1Pending: boolean;
  latexScale1Approved: boolean;
  setLatexScale1Approved: (v: boolean) => void;
  setLatexScale1Pending: (v: boolean) => void;
  // Latex round 2
  latexScale2Pending: boolean;
  latexScale2Approved: boolean;
  setLatexScale2Approved: (v: boolean) => void;
  setLatexScale2Pending: (v: boolean) => void;
}

export function useScalePoll({
  lot,
  scalePendingPL,
  scaleApproved,
  setScaleApproved,
  setScalePendingPL,
  setScaleApprovedBy,
  latexScale1Pending,
  latexScale1Approved,
  setLatexScale1Approved,
  setLatexScale1Pending,
  latexScale2Pending,
  latexScale2Approved,
  setLatexScale2Approved,
  setLatexScale2Pending,
}: UseScalePollParams) {
  // Poll for non-Latex scale approval
  useEffect(() => {
    if (lot.dept === "Latex") return;
    if (!scalePendingPL || scaleApproved) return;
    const interval = setInterval(async () => {
      try {
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

  // Poll for Latex scale approval
  useEffect(() => {
    if (lot.dept !== "Latex") return;
    const r1Poll = latexScale1Pending && !latexScale1Approved;
    const r2Poll = latexScale2Pending && !latexScale2Approved;
    if (!r1Poll && !r2Poll) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/scale-verifications?production_detail_id=${lot.id}`,
        );
        if (!res.ok) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list = (await res.json()) as any[];
        if (!Array.isArray(list)) return;
        if (r1Poll) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const v1Approved = list.some(
            (v: any) =>
              v.round_no === 1 &&
              (v.is_locked === true || v.pl_approved_at !== null),
          );
          if (v1Approved) {
            setLatexScale1Approved(true);
            setLatexScale1Pending(false);
          }
        }
        if (r2Poll) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const v2Approved = list.some(
            (v: any) =>
              v.round_no === 2 &&
              (v.is_locked === true || v.pl_approved_at !== null),
          );
          if (v2Approved) {
            setLatexScale2Approved(true);
            setLatexScale2Pending(false);
          }
        }
      } catch (err) {
        console.error("[Packer Scale] poll error:", err);
      }
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    latexScale1Pending,
    latexScale1Approved,
    latexScale2Pending,
    latexScale2Approved,
    lot.id,
  ]);
}
