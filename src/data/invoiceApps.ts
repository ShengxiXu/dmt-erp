// P04-0 开票管理 —— 应收账单 → 开票申请 → 开票执行（金蝶人工）→ 发票回填 → 客户凭票付款
// 边界：本系统是开票申请与状态台账的唯一来源；正式开票/发票文件/税务在金蝶完成（不做接口），
// 业务支撑把申请单打印成登记单照着录金蝶，开完票回填发票号；红冲/作废发生在金蝶，此处只做状态标记。
// 客户开票抬头/税号来自客户主数据（本系统自维护，无 CRM 同步）。
import { useSyncExternalStore } from "react";
import { CUSTOMERS } from "@/data/customers";

export type InvAppStatus = "待开票" | "开票中" | "已开票" | "已红冲";
export interface InvoiceApp {
  apNo: string;            // KA-2026-xxx 开票申请单号
  invNo: string;           // 关联应收账单
  customer: string; contractNo: string;
  amount: number;          // 开票金额
  periodText: string;      // 开票账期（如 2026-10-08 ~ 2026-11-07）
  items: string[];         // 开票内容（账单明细名称）
  bizCat: string;          // 业务类别（ISP / IDC / 云 / L2L / 工程 / 设备 / 等保 / 楼宇 / 其他）
  invType: "增值税专用发票（电子）" | "普通发票（电子）";
  format: "PDF" | "OFD" | "XML";
  buyerNote?: string;      // 对方要求开票备注
  contact?: string;        // 对方联系人
  status: InvAppStatus;
  invoiceNo?: string;      // 发票号码（金蝶开完回填）
  invoicedAt?: string;     // 开票日期
  createdAt: string;
}
export const BIZ_CATS = ["ISP", "IDC", "云", "L2L", "工程", "设备", "等保", "楼宇", "其他"];

// ---------- 预置数据（不同状态各一笔，流程看得通） ----------
export const INVOICE_APPS: InvoiceApp[] = [
  { apNo: "KA-2026-0312", invNo: "INV-2026-0945", customer: "云启数据科技", contractNo: "HT-2026-021",
    amount: 26400, periodText: "2026-10-01 ~ 2026-10-31", items: ["AI 专线 100M×2 · 10 月周期费", "IP 地址 12 个"],
    bizCat: "ISP", invType: "增值税专用发票（电子）", format: "PDF", contact: "钱工",
    status: "待开票", createdAt: "2026-11-03 10:12" },
  { apNo: "KA-2026-0305", invNo: "INV-2026-0881", customer: "中海贸易", contractNo: "HT-2026-023",
    amount: 12800, periodText: "2026-09-25 ~ 2026-10-24", items: ["单线 200M · 账期周期费"],
    bizCat: "ISP", invType: "增值税专用发票（电子）", format: "PDF", buyerNote: "备注栏请注明合同号 HT-2026-023",
    status: "开票中", createdAt: "2026-10-12 09:40" },
  { apNo: "KA-2026-0288", invNo: "INV-2026-0833", customer: "恒信证券", contractNo: "HT-2026-018",
    amount: 15200, periodText: "2026-09-10 ~ 2026-10-09", items: ["国内精品网 80M · 账期周期费"],
    bizCat: "ISP", invType: "普通发票（电子）", format: "PDF", contact: "孙经理",
    status: "已开票", invoiceNo: "243120000001234567", invoicedAt: "2026-10-15", createdAt: "2026-10-11 14:20" },
];

// ---------- 轻量 store ----------
let version = 0;
const listeners = new Set<() => void>();
const bump = () => { version += 1; listeners.forEach((fn) => fn()); };
export function useInvoiceApps(): number {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => version,
  );
}
export const getInvoiceApps = () => INVOICE_APPS;
export const APP_BY_NO = (no: string) => INVOICE_APPS.find((a) => a.apNo === no);

/** 客户主数据取开票抬头/税号（开票抬头默认=客户名称，可不一致时维护在客户档案） */
export const invoiceTitleOf = (customer: string) => {
  const c = CUSTOMERS.find((x) => x.name === customer);
  return { title: c?.invoiceTitle?.trim() || customer, taxNo: c?.taxNo ?? "" };
};

let seq = 313;
const now = () => new Date().toISOString().slice(0, 16).replace("T", " ");

/** P03-6 应收登记时由 billing.ts 调用，自动生成开票申请（待开票） */
export function createInvoiceApp(data: { invNo: string; customer: string; contractNo: string; amount: number; periodText: string; items: string[] }): string | null {
  if (INVOICE_APPS.some((a) => a.invNo === data.invNo && a.status !== "已红冲")) return "该账单已有开票申请";
  INVOICE_APPS.unshift({
    apNo: `KA-2026-${seq++}`, invNo: data.invNo, customer: data.customer, contractNo: data.contractNo,
    amount: data.amount, periodText: data.periodText, items: data.items, bizCat: "ISP",
    invType: "增值税专用发票（电子）", format: "PDF", status: "待开票", createdAt: now(),
  });
  bump();
  return null;
}

/** 待开票 → 编辑开票要素（发票类型 / 格式 / 业务类别 / 对方备注 / 联系人） */
export function updateInvoiceApp(apNo: string, patch: Partial<Pick<InvoiceApp, "invType" | "format" | "bizCat" | "buyerNote" | "contact">>): string | null {
  const a = APP_BY_NO(apNo);
  if (!a || a.status !== "待开票") return "仅待开票申请可编辑";
  Object.assign(a, patch);
  bump();
  return null;
}

/** 待开票 → 开票中（业务支撑开始录金蝶；登记单随之可打印） */
export function startInvoicing(apNo: string): string | null {
  const a = APP_BY_NO(apNo);
  if (!a || a.status !== "待开票") return "仅待开票申请可登记开票";
  a.status = "开票中";
  bump();
  return null;
}

/** 金蝶开完票 → 回填发票号码 + 开票日期（开票中 → 已开票） */
export function fillInvoice(apNo: string, invoiceNo: string, invoicedAt: string): string | null {
  const a = APP_BY_NO(apNo);
  if (!a || a.status !== "开票中") return "仅开票中的申请可回填发票号";
  if (!invoiceNo.trim()) return "必须填写发票号码";
  if (!invoicedAt.trim()) return "必须填写开票日期";
  a.invoiceNo = invoiceNo.trim(); a.invoicedAt = invoicedAt; a.status = "已开票";
  bump();
  return null;
}

/** 发票红冲/作废（发生在金蝶，此处状态标记留痕；关联应收账单走 P04 红冲审批） */
export function redFlushInvoice(apNo: string): string | null {
  const a = APP_BY_NO(apNo);
  if (!a || a.status !== "已开票") return "仅已开票申请可标记红冲";
  a.status = "已红冲";
  bump();
  return null;
}
