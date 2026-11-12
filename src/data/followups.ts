// 到期拆机商机确认 —— 合同到期退订 → 资源回收（拆机）完工后，自动生成待办给归属销售：
// 确认客户是否有后续合作商机并录入（有 → 直接建商机并回写关联；无 → 登记原因留痕）。
// 触发点在 lifecycle.executeRecover（拆机完工时刻），仅「合同到期」口径触发（欠费坏账/客户申请退订另有处置语境）。
import { useSyncExternalStore } from "react";
import { persistable } from "@/data/persist";
import { demoNow } from "@/data/settings";
import { notify } from "@/data/notices";
import { CUSTOMERS } from "@/data/customers";

export type FollowStatus = "待确认" | "已录商机" | "无后续";
export interface ExpireFollowup {
  fuNo: string;            // FU-2026-xxx
  rcNo: string; tmNo: string; subNo: string;
  customerId: string; customer: string; contractNo: string;
  originLine: string;      // 原订阅产品（拆机对象，如 国内精品网 50M）
  sales: string;           // 归属销售（客户档案带出）
  status: FollowStatus;
  oppId?: string;          // 已录商机 → 商机编号（客户 360 / 合同视图反查）
  noReason?: string;       // 无后续原因分类
  noNote?: string;
  createdAt: string; doneAt?: string;
}

export const FOLLOWUPS: ExpireFollowup[] = persistable("expireFollowups", () => [
  { fuNo: "FU-2026-001", rcNo: "RC-2026-002", tmNo: "TM-2026-002", subNo: "SUB-2026-0117",
    customerId: "CU-012", customer: "展鹏教育", contractNo: "HT-2026-0302", originLine: "国内精品网 50M",
    sales: "李骁", status: "待确认", createdAt: "2026-11-02 15:40" },
]);

// ---------- 轻量 store ----------
let version = 0;
const listeners = new Set<() => void>();
const bump = () => { version += 1; listeners.forEach((f) => f()); };
export function useFollowups(): number {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => version,
  );
}
export const getFollowups = () => FOLLOWUPS;
export const pendingFollowups = () => FOLLOWUPS.filter((f) => f.status === "待确认");
export const FOLLOW_OF_RC = (rcNo: string) => FOLLOWUPS.find((f) => f.rcNo === rcNo);

const fuSeq = persistable("followups.seq", () => ({ v: 2 }));

/** 回收（拆机）完工时生成确认任务（lifecycle.executeRecover 调用；仅合同到期口径） */
export function spawnFollowup(data: Omit<ExpireFollowup, "fuNo" | "status" | "createdAt">): string {
  const fuNo = `FU-2026-${String(fuSeq.v++).padStart(3, "0")}`;
  FOLLOWUPS.unshift({ ...data, fuNo, status: "待确认", createdAt: demoNow() });
  bump();
  notify({ level: "orange", group: "销售", title: "到期拆机客户待确认商机", text: `${data.customer}（${data.contractNo}，原 ${data.originLine}）已到期拆机，请确认是否有后续合作商机并录入`, to: "/opportunity" });
  return fuNo;
}

/** 有后续：销售录入商机后回写关联（oppId 由商机表单返回） */
export function confirmWithOpp(fuNo: string, oppId: string): string | null {
  const f = FOLLOWUPS.find((x) => x.fuNo === fuNo);
  if (!f || f.status !== "待确认") return "确认任务不存在或已处理";
  f.status = "已录商机"; f.oppId = oppId; f.doneAt = demoNow();
  bump();
  return null;
}

/** 无后续：登记原因分类 + 说明，留痕关闭 */
export function closeWithoutOpp(fuNo: string, reason: string, note: string): string | null {
  const f = FOLLOWUPS.find((x) => x.fuNo === fuNo);
  if (!f || f.status !== "待确认") return "确认任务不存在或已处理";
  if (!reason) return "请选择无后续的原因分类";
  f.status = "无后续"; f.noReason = reason; f.noNote = note.trim() || undefined; f.doneAt = demoNow();
  bump();
  return null;
}

/** 客户档案 → 归属销售（生成任务时指派） */
export const salesOfCustomer = (customerName: string) => CUSTOMERS.find((c) => c.name === customerName)?.sales ?? "";
