// 采购合同 · 一等主数据：采购侧价格事实的唯一出处
// 两级模型：采购合同（约定：供应商 / 标的 / 单价 / 月租 / 生效期）→ 采购订单（合同下按单执行，见采购管理 /purchase/orders）
// 关联面：R1 出口 / R2 基础线路选合同带出商务参数；采购单（P08）挂合同带出采购单价；
//        供应商账单按口径关联（周期性 → 合同，一次性 → 采购单）；设备入库溯源到采购单。
import { useSyncExternalStore } from "react";
import { persistable } from "@/data/persist";

export type PurchaseBilling = "周期性月租" | "按单计价";

export interface PurchaseContract {
  id: string;            // 合同号（CT-2026-xxx / CU-2026-xxx / …，全库唯一）
  buyerId?: string;      // 采购主体（我方哪个分子公司签的；缺省总部）
  name: string;          // 合同名称
  supplier: string;      // 供应商
  subject: string;       // 标的：出口带宽 / 基础线路 / OTN 波道 / 设备框架 / …
  billing: PurchaseBilling;
  /** 周期性月租类：容量（M）与月租（元/月）；整线类用 bwM/linePrice（带宽 M / 整线月租 元） */
  capacityM?: number;
  monthlyCost?: number;
  bwM?: number;
  linePrice?: number;
  /** 按单计价类：采购单价（元） */
  unitPrice?: number;
  effect: string;        // 生效日期
  end?: string;          // 到期日期（可空）
  status?: "履行中" | "已到期" | "已终止";  // 缺省 = 履行中
  attachments?: string[]; // 合同扫描件等附件（原型 mock；正式环境走对象存储）
  remark?: string;
}

// ---------- 预置合同（原 R1/R2 硬编码候选统一上收至此；PO 侧补设备 / 长途框架合同） ----------
export const PURCHASE_CONTRACTS: PurchaseContract[] = persistable("purchaseContracts", () => [
  // 出口带宽（周期性月租，R1）
  { id: "CT-2026-018", buyerId: "ENT-HQ", name: "电信 BGP 出口采购合同（1G）", supplier: "上海电信", subject: "出口带宽", billing: "周期性月租", capacityM: 1000, monthlyCost: 45000, effect: "2025-01-01" },
  { id: "CU-2026-033", buyerId: "ENT-HQ", name: "联通 169 BGP 出口采购合同（1G）", supplier: "上海联通", subject: "出口带宽", billing: "周期性月租", capacityM: 1000, monthlyCost: 40000, effect: "2025-01-01" },
  { id: "CM-2026-007", buyerId: "ENT-HQ", name: "移动 CMNET BGP 出口采购合同（800M）", supplier: "上海移动", subject: "出口带宽", billing: "周期性月租", capacityM: 800, monthlyCost: 28000, effect: "2025-01-01" },
  { id: "CT-2026-051", buyerId: "ENT-HQ", name: "电信 CN2 GIA 出口采购合同（500M）", supplier: "上海电信", subject: "出口带宽", billing: "周期性月租", capacityM: 500, monthlyCost: 75000, effect: "2025-09-01" },
  { id: "PN-2026-002", buyerId: "ENT-HQ", name: "国内精品网骨干通道采购合同（1G）", supplier: "上海电信", subject: "出口带宽", billing: "周期性月租", capacityM: 1000, monthlyCost: 120000, effect: "2025-08-01" },
  { id: "HK-2026-011", buyerId: "ENT-NET", name: "国际精品网出口采购合同（香港 500M）", supplier: "境外运营商", subject: "出口带宽", billing: "周期性月租", capacityM: 500, monthlyCost: 130000, effect: "2025-08-01" },
  // 基础线路 / OTN 波道（周期性整线月租，R2）
  { id: "CT-2026-063", buyerId: "ENT-HQ", name: "电信 CN2 GIA 接入线路采购合同（100M）", supplier: "上海电信", subject: "基础线路", billing: "周期性月租", bwM: 100, linePrice: 1000, effect: "2026-01-01" },
  { id: "CU-2026-042", buyerId: "ENT-HQ", name: "联通 169 接入线路采购合同（200M）", supplier: "上海联通", subject: "基础线路", billing: "周期性月租", bwM: 200, linePrice: 1600, effect: "2025-12-01" },
  { id: "OT-2026-009", buyerId: "ENT-HQ", name: "电信 上海↔北京 OTN 波道采购合同（10G）", supplier: "中国电信长途传输", subject: "OTN 波道", billing: "周期性月租", bwM: 10000, linePrice: 6000, effect: "2026-03-01" },
  { id: "OT-2026-015", buyerId: "ENT-HQ", name: "电信 上海↔广州 OTN 波道采购合同（10G）", supplier: "中国电信长途传输", subject: "OTN 波道", billing: "周期性月租", bwM: 10000, linePrice: 5200, effect: "2026-05-01" },
  // 设备 / 线路框架（按单计价，采购单挂此类合同）
  { id: "CT-2026-031", buyerId: "ENT-HQ", name: "华为渠道设备框架采购合同（CPE / 备件）", supplier: "华为渠道-上海XX", subject: "设备框架", billing: "按单计价", unitPrice: 4300, effect: "2026-01-01", remark: "AR6121 CPE 框架价 4,300 元/台，按单下达", attachments: ["CT-2026-031-框架合同扫描件.pdf"] },
  { id: "CT-2026-044", buyerId: "ENT-HQ", name: "华三渠道设备框架采购合同（CPE / 备件）", supplier: "华三渠道-上海YY", subject: "设备框架", billing: "按单计价", unitPrice: 3600, effect: "2026-02-01", remark: "MSR3600 CPE 框架价 3,600 元/台，按单下达" },
  { id: "CT-2026-020", buyerId: "ENT-HQ", name: "电信长途波道框架采购合同（按单开波道）", supplier: "电信上海分公司", subject: "OTN 波道", billing: "按单计价", unitPrice: 2800, effect: "2026-06-01", remark: "上海—深圳等长途波道按单计价" },
]);

// ---------- 轻量 store ----------
let version = 0;
const listeners = new Set<() => void>();
const bump = () => {
  version += 1;
  listeners.forEach((fn) => fn());
};
export function usePurchase(): number {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version,
  );
}
export const getContracts = () => PURCHASE_CONTRACTS;
export const CONTRACT_DEF = (id: string) => PURCHASE_CONTRACTS.find((c) => c.id === id);

export function saveContract(patch: PurchaseContract) {
  const i = PURCHASE_CONTRACTS.findIndex((c) => c.id === patch.id);
  if (i >= 0) PURCHASE_CONTRACTS[i] = patch;
  else PURCHASE_CONTRACTS.push(patch);
  bump();
}
export function removeContract(id: string) {
  const i = PURCHASE_CONTRACTS.findIndex((c) => c.id === id);
  if (i >= 0) PURCHASE_CONTRACTS.splice(i, 1);
  bump();
}
// 附件维护（原型 mock）
export function setContractAttachments(id: string, files: string[]) {
  const c = PURCHASE_CONTRACTS.find((x) => x.id === id);
  if (c) { c.attachments = files; bump(); }
}

/** 合同被采购侧引用的次数（R1/R2 档案、采购单、账单；由调用方传入引用检查回调之外，这里只做存在性提示） */
export const CONTRACT_ID = (c: PurchaseContract) => c.id;
