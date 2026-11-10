// 运营商账单邮件导入：财务邮箱 → 解析附件 → 与采购合同基准自动核对 → 差异调整 → 生成供应商账单
// 真实环境的落地方式：IMAP/Exchange 定时轮询财务邮箱 → 按发件人域识别运营商 → 附件（Excel/PDF）模板化解析
//   → 账单行结构化（费用名称 / 合同号 / 电路编号 / 金额）→ 本模块的「解析 + 核对 + 差异调整」逻辑完全一致。
// 原型以预置邮件模拟收件箱；导入生成的账单走 bills.ts 同一台账（source=邮件导入，差异留痕）。
import { useSyncExternalStore } from "react";
import { persistable } from "@/data/persist";
import { demoNow } from "@/data/settings";
import { notify } from "@/data/notices";
import { bills } from "@/data/bills";
import { getContracts } from "@/data/purchase";
import { R1_ROWS, R2_ROWS, R3_ROWS, R4_ROWS } from "@/data/resources";

export interface EmailBillRow {
  lineNo: number;
  itemName: string;        // 账单行费用名称（附件原文）
  costItemKey: string;     // 解析规则：标的 → 费用归类（出口带宽 op1b / 线路与波道 op1a）
  resRef?: string;         // 账单上的电路/端口编号（解析自账单行）
  resMatched: boolean;     // 资源编号能否对上 R1~R4 档案
  contractNo?: string;     // 账单上的合同编号 → 对采购合同基准
  amount: number;          // 运营商账单金额
  // 导入结果（导入后回填）
  result?: { billId?: string; hold?: boolean; holdReason?: string };
}
export interface BillEmail {
  id: string;              // EM-2026-xxxx
  from: string;            // 运营商账单邮箱
  subject: string;
  receivedAt: string;
  supplier: string;        // 解析：运营商（发件人域 + 签名）
  period: string;          // 解析：账期
  attachName: string;      // 账单附件名
  status: "未导入" | "已导入" | "已忽略";
  rows: EmailBillRow[];
}

// 全库资源编号（电路/端口/设备查重）
const RES_IDS = new Set([...R1_ROWS, ...R2_ROWS, ...R3_ROWS, ...R4_ROWS].map((r) => r.id));

// ---------- 预置账单邮件（模拟财务邮箱收件箱；账期 2026-11） ----------
export const BILL_EMAILS: BillEmail[] = persistable("billEmails", () => [
  {
    id: "EM-2026-0001", from: "billing@sh.telecom.com.cn", subject: "【账单】上海电信 2026 年 11 月专线费用账单", receivedAt: "2026-11-05 09:12",
    supplier: "上海电信", period: "2026-11", attachName: "上海电信_202611_账单明细.xlsx", status: "未导入",
    rows: [
      { lineNo: 1, itemName: "BGP 出口带宽月租（1G · E-CT-1）", costItemKey: "op1b", resRef: "E-CT-1", resMatched: true, contractNo: "CT-2026-018", amount: 45000 },
      { lineNo: 2, itemName: "CN2 GIA 接入线路月租（100M · B-001）", costItemKey: "op1a", resRef: "B-001", resMatched: true, contractNo: "CT-2026-063", amount: 1000 },
    ],
  },
  {
    id: "EM-2026-0002", from: "bill@ctltrans.ct10000.com", subject: "中国电信长途传输 2026-11 波道租用费账单", receivedAt: "2026-11-06 15:40",
    supplier: "中国电信长途传输", period: "2026-11", attachName: "长途传输_2026年11月_波道账单.xlsx", status: "未导入",
    rows: [
      { lineNo: 1, itemName: "上海↔北京 OTN 波道月租（10G · B-201）", costItemKey: "op1a", resRef: "B-201", resMatched: true, contractNo: "OT-2026-009", amount: 6500 },
      { lineNo: 2, itemName: "上海↔广州 OTN 波道月租（10G · B-202）", costItemKey: "op1a", resRef: "B-202", resMatched: true, contractNo: "OT-2026-015", amount: 5200 },
    ],
  },
  {
    id: "EM-2026-0003", from: "billing@shanghai.unicom.cn", subject: "上海联通 2026年11月 169 出口租用费账单", receivedAt: "2026-11-07 10:05",
    supplier: "上海联通", period: "2026-11", attachName: "上海联通_202611_出口租用费.xlsx", status: "未导入",
    rows: [
      { lineNo: 1, itemName: "169 BGP 出口带宽月租（1G · I-102）", costItemKey: "op1b", resRef: "I-102", resMatched: true, contractNo: "CU-2026-033", amount: 40800 },
    ],
  },
]);

// ---------- 轻量 store ----------
let version = 0;
const listeners = new Set<() => void>();
const bump = () => {
  version += 1;
  listeners.forEach((fn) => fn());
};
export const useBillEmails = (): number =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version
  );

// ---------- 解析与核对 ----------
export interface RowCheck {
  expected?: number;       // 系统基准（采购合同价 / 整线月租）
  diff: number;            // 账单金额 − 基准
  diffPct: number;
  hasBase: boolean;        // 有无合同基准可比
}
/** 逐行核对：合同基准 + 资源编号 + 差异额（导入前实时计算，合同价更新即刻反映） */
export function checkRow(row: EmailBillRow): RowCheck {
  const c = row.contractNo ? getContracts().find((x) => x.id === row.contractNo) : undefined;
  const expected = c ? (c.monthlyCost ?? c.linePrice ?? c.unitPrice) : undefined;
  const diff = expected != null ? row.amount - expected : 0;
  return {
    expected,
    diff,
    diffPct: expected ? Math.round((diff / expected) * 1000) / 10 : 0,
    hasBase: expected != null,
  };
}
export const rowProblem = (row: EmailBillRow): "无基准" | "资源未匹配" | "超基准" | "低于基准" | null => {
  if (row.resRef && !RES_IDS.has(row.resRef)) return "资源未匹配";
  const ck = checkRow(row);
  if (!ck.hasBase) return "无基准";
  if (ck.diff > 0) return "超基准";
  if (ck.diff < 0) return "低于基准";
  return null;
};

// 账单号段与 bills.ts 独立（EM 导入的账单也进 HY 台账，号段共用 bills.seq 会破坏其闭包，故这里自维护）
const seqBox = persistable("billEmails.seq", () => ({ bill: 1019 }));

/** 导入：无差异行「导入即入账」；差异行按实入账（tag=差异 留痕）；暂挂行生成争议账单（待入账+tag=争议，待对账） */
export function importEmail(emailId: string, decisions: Record<number, "按实入账" | "暂挂">, holdReasons: Record<number, string>): string | null {
  const em = BILL_EMAILS.find((e) => e.id === emailId);
  if (!em) return "邮件不存在";
  if (em.status !== "未导入") return "该邮件已处理";
  const problems = em.rows.map((r) => ({ r, p: rowProblem(r) }));
  const needDecision = problems.filter((x) => x.p && x.p !== "低于基准");
  for (const { r } of needDecision) {
    if (!decisions[r.lineNo]) return `第 ${r.lineNo} 行（${r.itemName}）存在差异/无基准，请选择处理方式`;
  }
  let created = 0, direct = 0, diffCnt = 0, held = 0;
  for (const { r, p } of problems) {
    const ck = checkRow(r);
    const decision = decisions[r.lineNo];
    if (decision === "暂挂") {
      // 暂挂也入台账：状态待入账 + tag=争议，对完账后在账单详情转正或作废
      const id = `HY-2026-${seqBox.bill++}`;
      const reason = holdReasons[r.lineNo]?.trim() || "待与运营商对账";
      bills.unshift({
        id, supplier: em.supplier, period: em.period, costItemKey: r.costItemKey, amount: r.amount,
        resRef: r.resRef, contractNo: r.contractNo, status: "待入账", createdAt: demoNow(),
        source: "邮件导入", emailId: em.id, tag: "争议",
        diff: { expected: ck.expected ?? 0, diff: ck.diff, reason, handle: "暂挂对账" },
        note: `暂挂对账：${reason}`,
      });
      r.result = { billId: id, hold: true, holdReason: reason };
      held++;
      created++;
      continue;
    }
    const id = `HY-2026-${seqBox.bill++}`;
    bills.unshift({
      id, supplier: em.supplier, period: em.period, costItemKey: r.costItemKey, amount: r.amount,
      resRef: r.resRef, contractNo: r.contractNo, status: "已入账", createdAt: demoNow(),
      source: "邮件导入", emailId: em.id,
      ...(p ? { tag: "差异" as const, diff: { expected: ck.expected ?? 0, diff: ck.diff, reason: holdReasons[r.lineNo]?.trim(), handle: "按实入账" as const } } : {}),
      note: p ? `邮件导入：与合同基准差异 ${ck.diff > 0 ? "+" : ""}${ck.diff.toLocaleString("zh-CN")} 元，按实入账` : `邮件导入自 ${em.from}`,
    });
    r.result = { billId: id };
    created++;
    if (p) diffCnt++; else direct++;
  }
  em.status = "已导入";
  const parts = [`${direct} 张直接入账`];
  if (diffCnt) parts.push(`${diffCnt} 张差异按实入账`);
  if (held) parts.push(`${held} 张争议暂挂待对账`);
  notify({
    level: held > 0 ? "orange" : "green", group: "采购",
    title: `运营商账单已导入（${em.supplier} ${em.period}）`,
    text: `邮件「${em.subject}」解析 ${em.rows.length} 行：生成账单 ${created} 张（${parts.join("、")}）`,
    to: "/bills", roles: ["财务", "业务支撑部"],
  });
  bump();
  return null;
}

/** 忽略邮件（不属于应付账单的邮件，如广告/通知） */
export function ignoreEmail(emailId: string) {
  const em = BILL_EMAILS.find((e) => e.id === emailId);
  if (em && em.status === "未导入") {
    em.status = "已忽略";
    bump();
  }
}
