// P04-0 开票管理 —— 【门面层】2026-11-09 财务中心 v2：开票数据已并入应收账单（receivables.ts 的 InvoiceInfo），
// 本文件不再持有独立数据，所有导出均为应收账单的派生视图 / 透传操作，保证旧页面（/finance/invoices）行为不变。
// 边界：本系统是开票申请与状态台账的唯一来源；正式开票/发票文件/税务在金蝶完成（不做接口），
// 业务支撑把申请单打印成登记单照着录金蝶，开完票回填发票号；红冲/作废发生在金蝶，此处只做状态标记。
// 客户开票抬头/税号来自客户主数据（本系统自维护，无 CRM 同步）。
import { useReceivables, RECEIVABLES, updateInvoiceInfo, startInvoicingInfo, fillInvoiceInfo, redFlushInvoiceInfo,
  BIZ_CATS, type Receivable, type InvoiceInfo, type InvMarkStatus } from "@/data/receivables";
import { CUSTOMERS } from "@/data/customers";

export type InvAppStatus = InvMarkStatus;
/** 开票申请视图（派生自账单行的 InvoiceInfo，补全冗余展示字段） */
export interface InvoiceApp extends InvoiceInfo {
  invNo: string;
  customer: string;
  contractNo: string;
  amount: number;
}
export { BIZ_CATS };

const project = (r: Receivable): InvoiceApp => ({
  ...r.invoice!, invNo: r.invNo, customer: r.customer, contractNo: r.contract, amount: r.amount,
});

export const getInvoiceApps = (): InvoiceApp[] => RECEIVABLES.filter((r) => r.invoice).map(project);
export const APP_BY_NO = (no: string) => getInvoiceApps().find((a) => a.apNo === no);
/** 订阅 receivables store（开票视图随账单联动刷新） */
export const useInvoiceApps = (): number => useReceivables();

/** 客户主数据取开票抬头/税号（开票抬头默认=客户名称，可不一致时维护在客户档案） */
export const invoiceTitleOf = (customer: string) => {
  const c = CUSTOMERS.find((x) => x.name === customer);
  return { title: c?.invoiceTitle?.trim() || customer, taxNo: c?.taxNo ?? "" };
};

// ---------- 操作透传（语义与校验不变，含「已收款账单不允许红冲发票」新规则） ----------
export const updateInvoiceApp = (apNo: string, patch: Parameters<typeof updateInvoiceInfo>[1]) => updateInvoiceInfo(apNo, patch);
export const startInvoicing = (apNo: string) => startInvoicingInfo(apNo);
export const fillInvoice = (apNo: string, invoiceNo: string, invoicedAt: string) => fillInvoiceInfo(apNo, invoiceNo, invoicedAt);
export const redFlushInvoice = (apNo: string) => redFlushInvoiceInfo(apNo);
