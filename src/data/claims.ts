// 回款认领与核销：银行流水 → 自动认领建议 → 人工确认 → 拆分核销
// 业务口径（与「按账单登记收款」互补，真实财务的主路径）：
//   ① 银行先到来一笔流水（付款方 + 金额），财务未必知道对应哪笔账单；
//   ② 系统按「付款方 ≈ 客户名（模糊匹配）」列出该客户未收讫账单，金额默认未收余额，可改（拆分/部分认领）；
//   ③ 确认后逐笔调用 receivables.addPayment 完成核销（状态流转 / 复机工单 / 通知全部复用），
//      一笔流水可拆到多笔账单，一笔账单也可由多笔流水累计核销。
// 流水状态：未认领（claimed=0）→ 部分认领 → 已核销（claimed ≥ 金额）；红冲不物理删，留痕。
import { useSyncExternalStore } from "react";
import { persistable } from "@/data/persist";
import { demoNow } from "@/data/settings";
import { notify } from "@/data/notices";
import { RECEIVABLES, PAYMENTS, addPayment, invBalance } from "@/data/receivables";

export interface BankFlow {
  id: string;              // BF-2026-xxxx
  at: string;              // 到账时间
  payer: string;           // 付款方（银行账户户名）
  amount: number;
  method: "银行转账" | "承兑汇票" | "现金" | "其他";
  referenceNo?: string;    // 银行流水号
  status: "未认领" | "部分认领" | "已核销";
  claimed: number;         // 已认领合计
  note?: string;
}
export interface ClaimAlloc {
  id: string;              // CA-2026-xxxx
  flowId: string;
  invNo: string;
  customer: string;
  amount: number;
  at: string;
  payNo: string;           // 生成的收款登记单号
}

export const BANK_FLOWS: BankFlow[] = persistable("bankFlows", () => [
  { id: "BF-2026-0001", at: "2026-11-02 10:18", payer: "云启数据科技有限公司", amount: 50000, method: "银行转账", referenceNo: "BK202611020031", status: "未认领", claimed: 0, note: "附言：10 月账期" },
  { id: "BF-2026-0002", at: "2026-11-03 14:52", payer: "恒信证券股份有限公司", amount: 30400, method: "银行转账", referenceNo: "BK202611030087", status: "未认领", claimed: 0 },
  { id: "BF-2026-0003", at: "2026-11-05 09:05", payer: "中海贸易有限公司", amount: 12800, method: "银行转账", referenceNo: "BK202611050012", status: "未认领", claimed: 0, note: "与 10 月账单等额" },
  { id: "BF-2026-0004", at: "2026-10-14 10:20", payer: "中海贸易有限公司", amount: 12800, method: "银行转账", referenceNo: "BK202610140088", status: "已核销", claimed: 12800, note: "历史流水（系统上线前到账）" },
]);
export const CLAIM_ALLOCS: ClaimAlloc[] = persistable("claimAllocs", () => [
  { id: "CA-2026-0001", flowId: "BF-2026-0004", invNo: "INV-2026-0881", customer: "中海贸易", amount: 12800, at: "2026-10-14 10:26", payNo: "PAY-2026-0201" },
]);

let version = 0;
const listeners = new Set<() => void>();
const bump = () => {
  version += 1;
  listeners.forEach((fn) => fn());
};
export const useClaims = (): number =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version
  );

// 流水号 / 认领分配单号计数（box 持久化，快照捕获引用）
const seqBox = persistable("claims.seq", () => ({ flow: 5, alloc: 2 }));

const flowById = (id: string) => BANK_FLOWS.find((f) => f.id === id);

/** ① 登记银行流水（出纳网银导出 / 手工录入） */
export function addBankFlow(data: Omit<BankFlow, "id" | "status" | "claimed">) {
  const flow: BankFlow = { ...data, id: `BF-2026-${String(seqBox.flow++).padStart(4, "0")}`, status: "未认领", claimed: 0 };
  BANK_FLOWS.unshift(flow);
  notify({ level: "blue", group: "财务", title: "银行流水到账", text: `${data.payer} ¥${data.amount.toLocaleString("zh-CN")}（${data.method}${data.referenceNo ? ` · ${data.referenceNo}` : ""}），待认领`, to: "/finance/claims", roles: ["财务"] });
  bump();
  return flow.id;
}

/** ② 自动认领建议：付款方模糊匹配客户 → 该客户未收讫账单（按应收日期升序），金额默认未收余额 */
export function autoMatch(flowId: string): { invNo: string; customer: string; balance: number; dueDate: string; score: number }[] {
  const f = flowById(flowId);
  if (!f) return [];
  const norm = (s: string) => s.replace(/(有限公司|股份有限公司|有限责任公司|公司|集团)/g, "").trim();
  const key = norm(f.payer);
  return RECEIVABLES
    .filter((r) => invBalance(r) > 0 && r.status !== "坏账")
    .map((r) => {
      const c = r.customer;
      const hit = c === f.payer || norm(c) === key || key.includes(norm(c)) || norm(c).includes(key);
      return { invNo: r.invNo, customer: c, balance: invBalance(r), dueDate: r.dueDate, score: hit ? 2 : 0 };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** ③ 确认认领（支持拆分：多笔账单、金额可改）→ 逐笔 addPayment 核销 */
export function claimFlow(flowId: string, allocs: { invNo: string; amount: number }[], by = "陈静（财务）"): string | null {
  const f = flowById(flowId);
  if (!f) return "流水不存在";
  if (!allocs.length) return "请至少选择一笔账单";
  const remain = f.amount - f.claimed;
  const total = allocs.reduce((s, a) => s + a.amount, 0);
  if (!(total > 0)) return "认领金额必须大于 0";
  if (total > remain) return `认领合计 ¥${total.toLocaleString("zh-CN")} 超过流水剩余可认领 ¥${remain.toLocaleString("zh-CN")}`;
  for (const a of allocs) {
    const inv = RECEIVABLES.find((r) => r.invNo === a.invNo);
    if (!inv) return `账单 ${a.invNo} 不存在`;
    if (a.amount > invBalance(inv)) return `${a.invNo} 认领金额超过未收余额 ¥${invBalance(inv).toLocaleString("zh-CN")}`;
  }
  // 逐笔核销（复用 addPayment：状态流转 / 足额复机 / 通知全链路）
  for (const a of allocs) {
    const inv = RECEIVABLES.find((r) => r.invNo === a.invNo)!;
    const err = addPayment({ invNo: a.invNo, customer: inv.customer, amount: a.amount, paidAt: demoNow(), method: f.method === "现金" ? "现金" : "银行转账", referenceNo: f.referenceNo, payerAccount: f.payer });
    if (err) return err;
    const payNo = PAYMENTS[0]?.payNo ?? ""; // addPayment 内部 unshift：最新一条即本次登记
    CLAIM_ALLOCS.unshift({ id: `CA-2026-${String(seqBox.alloc++).padStart(4, "0")}`, flowId, invNo: a.invNo, customer: inv.customer, amount: a.amount, at: demoNow(), payNo });
  }
  f.claimed += total;
  f.status = f.claimed >= f.amount ? "已核销" : "部分认领";
  notify({ level: f.status === "已核销" ? "green" : "blue", group: "财务", title: `流水${f.status === "已核销" ? "核销完成" : "部分认领"}`, text: `${f.payer} ¥${total.toLocaleString("zh-CN")} → ${allocs.length} 笔账单（${f.id} · 经办 ${by}）`, to: "/finance/claims", roles: ["财务"] });
  bump();
  return null;
}

/** 该流水的认领明细 */
export const allocsOf = (flowId: string) => CLAIM_ALLOCS.filter((a) => a.flowId === flowId);
