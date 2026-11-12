// 付款申请单（应付侧）—— 向供应商付款的唯一入口：申请 → 统一审批引擎（付款申请单 · 提交）→ 审批通过 = 待付款 → 财务执行付款 = 已付款
// 口径：
//   - 申请即锁额：审批中 / 待付款的申请单金额计入「在途付款」，避免重复申请同一笔账单
//   - 关联来源：可挂供应商账单（月结类）/ 采购单（一次性货款），全程留痕；不强制（如预付款可空）
//   - 付款主体 = 哪个分子公司账户出钱（主体与印章主数据），与采购合同抬头口径一致
//   - 未命中启用审批流（停用 / 触发条件不满足）→ 申请直接生效为「待付款」，与核算 / 采购 / 坏账同口径
import { useSyncExternalStore } from "react";
import { persistable } from "@/data/persist";
import { demoNow } from "@/data/settings";
import { notify } from "@/data/notices";
import { submitForApproval, registerDocWriteBack, ensureInstance, INSTANCE_OF_DOC } from "@/data/approvalFlow";
import { currentUser } from "@/data/users";

export type PayReqStatus = "待审批" | "待付款" | "已付款" | "已驳回";
export type PayType = "采购货款" | "账期月结" | "预付款" | "押金/保证金" | "其他";
export type PayMethod = "银行转账" | "承兑汇票" | "其他";

export interface PayRequest {
  prNo: string;             // PAY-2026-xxx
  supplier: string;         // 收款供应商
  amount: number;           // 申请金额（元）
  payType: PayType;
  payMethod: PayMethod;
  payerEntity: string;      // 付款主体（分子公司账户，主体主数据 id）
  accountName: string;      // 收款户名
  accountNo: string;        // 收款账号
  bankName?: string;        // 开户行
  sourceBillNos?: string[]; // 关联供应商账单（月结类）
  poNo?: string;            // 关联采购单（一次性货款）
  contractNo?: string;      // 关联采购合同
  expectPayDate: string;    // 期望付款日
  reason: string;           // 付款事由
  applicant: string;        // 申请人
  dept: string;             // 申请部门
  status: PayReqStatus;
  version: number;          // 驳回重提 +1，留痕
  rejectReason?: string;
  createdAt: string;
  paidAt?: string;          // 财务执行付款时间
  payer?: string;           // 付款经办人
}

// ---------- 预置数据 ----------
export const PAY_REQUESTS: PayRequest[] = persistable("payRequests", () => [
  {
    prNo: "PAY-2026-001", supplier: "华为渠道-上海XX", amount: 9718, payType: "采购货款", payMethod: "银行转账",
    payerEntity: "ENT-HQ", accountName: "上海XX信息科技有限公司", accountNo: "6222 0102 **** 8801", bankName: "工商银行上海分行",
    poNo: "PO-2026-052", expectPayDate: "2026-11-15", reason: "CPE 采购货款（PO-2026-052，验收合格后支付）",
    applicant: "许晟熙", dept: "业务支撑部", status: "待付款", version: 1, createdAt: "2026-11-10 14:20",
  },
  {
    prNo: "PAY-2026-002", supplier: "上海电信", amount: 45000, payType: "账期月结", payMethod: "银行转账",
    payerEntity: "ENT-HQ", accountName: "中国电信股份有限公司上海分公司", accountNo: "4546 7800 **** 2210", bankName: "招商银行上海分行",
    sourceBillNos: ["HY-2026-1014"], contractNo: "CT-2026-018", expectPayDate: "2026-10-25", reason: "BGP 电信出口月租（2026-10 账期）",
    applicant: "许晟熙", dept: "业务支撑部", status: "已付款", version: 1, createdAt: "2026-10-20 09:00",
    paidAt: "2026-10-25 10:12", payer: "陈静（财务）",
  },
]);

// ---------- 轻量 store ----------
let version = 0;
const listeners = new Set<() => void>();
const bump = () => { version += 1; listeners.forEach((fn) => fn()); };
export function usePayRequests(): number {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => version,
  );
}
export const getPayRequests = () => PAY_REQUESTS;
export const PR_BY_NO = (no: string) => PAY_REQUESTS.find((p) => p.prNo === no);

const seqBox = persistable("payRequests.seq", () => ({ v: 3 }));
export const fmtMoney = (n: number) => n.toLocaleString("zh-CN");

// 该账单是否已有在途（审批中 / 待付款）付款申请 —— 防止同一账单重复申请付款
export const billInFlight = (billId: string) =>
  PAY_REQUESTS.some((p) => (p.status === "待审批" || p.status === "待付款") && (p.sourceBillNos ?? []).includes(billId));

/** 申请占款合计（审批中 + 待付款）：付款排期参考 */
export const inFlightAmount = () =>
  PAY_REQUESTS.filter((p) => p.status === "待审批" || p.status === "待付款").reduce((s, p) => s + p.amount, 0);

// ---------- 提交申请（走统一审批引擎；未命中直接生效为待付款） ----------
export function submitPayRequest(data: Omit<PayRequest, "prNo" | "status" | "version" | "createdAt">): string | null {
  if (!data.supplier.trim()) return "请填写收款供应商";
  if (!(data.amount > 0)) return "申请金额须大于 0";
  if (!data.accountName.trim() || !data.accountNo.trim()) return "请填写收款户名与账号";
  if (!data.reason.trim()) return "请填写付款事由";
  if (!data.expectPayDate) return "请选择期望付款日";
  const prNo = `PAY-2026-${String(seqBox.v++).padStart(3, "0")}`;
  PAY_REQUESTS.unshift({ ...data, prNo, status: "待审批", version: 1, createdAt: demoNow() });
  const { hit } = submitForApproval("付款申请单 · 提交", prNo, `${data.supplier} · ¥${fmtMoney(data.amount)}`, { amount: data.amount }, data.applicant);
  if (!hit) {
    const pr = PR_BY_NO(prNo)!;
    pr.status = "待付款";
    notify({ level: "blue", group: "采购", title: "付款申请直接生效", text: `${prNo}（${data.supplier} · ¥${fmtMoney(data.amount)}）未命中启用审批流，已进入待付款`, to: "/pay-requests" });
  }
  bump();
  return null;
}

// 驳回后修改重新提交：版本 +1，重新走引擎
export function resubmitPayRequest(prNo: string): string | null {
  const pr = PR_BY_NO(prNo);
  if (!pr || pr.status !== "已驳回") return "仅已驳回的申请可重新提交";
  pr.version += 1;
  pr.status = "待审批";
  pr.rejectReason = undefined;
  const { hit } = submitForApproval("付款申请单 · 提交", prNo, `${pr.supplier} · ¥${fmtMoney(pr.amount)}`, { amount: pr.amount }, currentUser()?.name ?? pr.applicant);
  if (!hit) { pr.status = "待付款"; }
  bump();
  return null;
}

// 财务执行付款（待付款 → 已付款）
export function markPayRequestPaid(prNo: string, by?: string): string | null {
  const pr = PR_BY_NO(prNo);
  if (!pr || pr.status !== "待付款") return "仅待付款的申请可执行付款";
  pr.status = "已付款";
  pr.paidAt = demoNow();
  pr.payer = by ?? `${currentUser()?.name ?? "财务"}（财务）`;
  notify({ level: "green", group: "采购", title: "付款已执行", text: `${prNo}（${pr.supplier} · ¥${fmtMoney(pr.amount)}）已由 ${pr.payer} 完成付款`, to: "/pay-requests" });
  bump();
  return null;
}

// ---------- A2 统一审批引擎挂接 ----------
// 审批结果写回：审批中 → 待审批（锁定）；已通过 → 待付款（财务执行）；已驳回 → 已驳回（版本 +1，留痕）
registerDocWriteBack("付款申请单 · 提交", (docId, status, comment) => {
  const pr = PR_BY_NO(docId);
  if (!pr) return;
  if (status === "审批中") { pr.status = "待审批"; }
  else if (status === "已通过") {
    pr.status = "待付款";
    notify({ level: "green", group: "采购", title: "付款申请审批通过", text: `${pr.prNo}（${pr.supplier} · ¥${fmtMoney(pr.amount)}）进入待付款，请财务按期望付款日 ${pr.expectPayDate} 执行`, to: "/pay-requests" });
  } else {
    pr.status = "已驳回"; pr.version += 1; pr.rejectReason = comment ?? "";
    notify({ level: "red", group: "采购", title: "付款申请被驳回", text: `${pr.prNo}（${pr.supplier}）被驳回（v${pr.version}）：${comment ?? ""}`, to: "/pay-requests" });
  }
  bump();
});
// 在途单回填：历史「待审批」且无审批实例的申请单，按现配置补建实例（停在末节点）
PAY_REQUESTS.filter((p) => p.status === "待审批" && !INSTANCE_OF_DOC(p.prNo)).forEach((p) => {
  ensureInstance("付款申请单 · 提交", p.prNo, `${p.supplier} · ¥${fmtMoney(p.amount)}`, { amount: p.amount });
});
// 兼容旧字段（无付款主体字段的快照，默认总部账户付款）
PAY_REQUESTS.forEach((p) => { if (!p.payerEntity) p.payerEntity = "ENT-HQ"; });
