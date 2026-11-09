// P08 采购与资源入库 —— 采购需求（P08-1）→ 采购单（P08-2 创建 / P08-3 审批 / P08-4 下单与合同价 / P08-5 到货验收 / P08-6 入库建档）
// 闭环联动：资源不足联动生成的需求单携带挂起工单链接（linkedWo），入库建档完成后反向通知工单恢复开通（P02）。
// 与既有模块的写接口：设备入库 → resources.ts stockIn / R4 档案；带宽扩容 → R1 池容量；IP 段入库 → R3 档案（在途状态即采购单自身状态，无资源侧档案）。
import { useSyncExternalStore } from "react";
import { R4_ROWS, R1_ROWS, R3_ROWS, stockIn } from "@/data/resources";
import { PURCHASE_CONTRACTS, saveContract } from "@/data/purchase";
import { demoNow } from "@/data/settings";

// ---------- P08-1 采购需求单 ----------
export type ReqSource = "手工提报" | "资源不足联动" | "业务规划";
export type ReqType = "带宽" | "IP 段" | "设备";
export interface PurchaseReq {
  reqNo: string;            // PR-2026-xxxx，编号规则生成，只读
  source: ReqSource;
  type: ReqType;
  spec: string;             // 规格与数量：带宽=目标池+容量；IP=机房+前缀；设备=品牌/型号
  qty: number; unit: string; // 数量与单位（台 / M / 段）
  room: string;             // 目标机房（带宽/IP 类必填）
  expectDate: string;       // 期望到货日
  note?: string;
  status: "待处理" | "已转采购单" | "已转合同变更" | "已关闭";
  linkedWo?: string;        // 资源不足联动：挂起工单号（WO-xxx）
  poNo?: string;            // 转采购单后回填
  contractNo?: string;      // 带宽类转合同变更后回填（原采购合同，走补充协议，不新建采购单）
  createdAt: string; createdBy: string;
}

// ---------- P08-2 采购单 ----------
export type POLineType = "带宽容量" | "IP 段" | "设备";
export interface POLine {
  lineType: POLineType;
  spec: string;             // 带宽：500M；IP：/24；设备：华为 AR6121
  unitPrice: number; quantity: number;
  receivedQty: number;      // 累计到货（P08-5 回写）
  acceptedQty: number;      // 累计验收合格
}
export type POStatus = "草稿" | "待审批" | "已下单" | "部分到货" | "验收完成";
export interface ReceiptItem { lineIdx: number; arrived: number; result: "合格" | "不合格"; rejectReason?: string }
export interface ReceiptBatch { batchNo: number; at: string; operator: string; items: ReceiptItem[] }
export interface InboundDevice { assetNo: string; sn: string; brand: string; model: string; warrantyEnd: string }
export interface PurchaseOrder {
  poNo: string;
  supplier: string;
  reqNos: string[];         // 引用的采购需求单
  lines: POLine[];
  taxRate: number;          // 税率（含税总额 = Σ 明细 × (1+税率)）
  paymentTerms?: string;    // 账期条款（供 P09 对账参考）
  status: POStatus;
  version: number;          // 驳回重提版本 +1，留痕
  rejectReason?: string;    // 最近驳回原因（留痕）
  contractNo?: string;      // P08-4 采购合同编号
  contractId?: string;      // 下单前关联的采购合同档案（框架合同带价；零星采购可空，事后 P08-4 补录）
  contractSignedAt?: string;
  contractEffectAt?: string;
  contractLines?: { spec: string; price: number }[]; // 合同价明细 = P09 自动核对基准
  attachments?: string[];   // 附件（合同扫描件 / 到货单 / 验收单，原型 mock）
  batches: ReceiptBatch[];
  inboundDone: boolean;     // P08-6 完成：资源正式可售
  inboundAt?: string;
  resumedWo?: string;       // 入库后联动恢复的挂起工单
  createdAt: string;
}

// ---------- 预置数据 ----------
export const PURCHASE_REQS: PurchaseReq[] = [
  { reqNo: "PR-2026-1102", source: "资源不足联动", type: "设备", spec: "华为 AR6121 CPE", qty: 2, unit: "台", room: "上海漕河泾", expectDate: "2026-11-08", status: "待处理", linkedWo: "WO-2026-052", note: "工单 WO-2026-052 可用性检查：CPE 在库不足（需 2 台），改按单采购生成", createdAt: "2026-11-03 09:20", createdBy: "系统（工单挂起联动）" },
  { reqNo: "PR-2026-0099", source: "手工提报", type: "设备", spec: "10G 光模块（华为兼容）", qty: 20, unit: "个", room: "上海漕河泾", expectDate: "2026-11-15", status: "待处理", note: "备货：光模块安全库存补货", createdAt: "2026-10-28 14:05", createdBy: "钱工（运维）" },
  { reqNo: "PR-2026-0098", source: "业务规划", type: "带宽", spec: "联通 169 BGP 出口池扩容", qty: 500, unit: "M", room: "上海漕河泾", expectDate: "2026-11-30", status: "待处理", note: "Q4 BGP 销售预估增长，提前扩容", createdAt: "2026-10-25 10:40", createdBy: "业务支撑部-陈晨" },
  { reqNo: "PR-2026-0095", source: "手工提报", type: "设备", spec: "华为 AR6121 CPE", qty: 10, unit: "台", room: "上海漕河泾", expectDate: "2026-11-05", status: "已转采购单", poNo: "PO-2026-031", createdAt: "2026-10-18 11:12", createdBy: "孙工（运维）" },
];

export const PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    poNo: "PO-2026-052", supplier: "华为渠道-上海XX", reqNos: [], createdAt: "2026-11-02 16:30",
    lines: [{ lineType: "设备", spec: "华为 AR6121 CPE", unitPrice: 4300, quantity: 2, receivedQty: 0, acceptedQty: 0 }],
    taxRate: 0.13, paymentTerms: "月结 30 天", status: "草稿", version: 1, batches: [], inboundDone: false,
  },
  {
    poNo: "PO-2026-031", supplier: "华为渠道-上海XX", reqNos: ["PR-2026-0095"], createdAt: "2026-10-18 15:20",
    lines: [{ lineType: "设备", spec: "华为 AR6121 CPE", unitPrice: 4300, quantity: 10, receivedQty: 0, acceptedQty: 0 }],
    taxRate: 0.13, paymentTerms: "月结 30 天", status: "已下单", version: 1, batches: [], inboundDone: false,
    contractNo: "CT-2026-031", contractSignedAt: "2026-10-20", contractEffectAt: "2026-10-20",
    contractLines: [{ spec: "华为 AR6121 CPE", price: 4300 }],
    attachments: ["PO-2026-031-合同扫描件.pdf", "PO-2026-031-到货签收单.pdf"],
  },
  {
    poNo: "PO-2026-044", supplier: "华三渠道-上海YY", reqNos: [], createdAt: "2026-10-20 10:12",
    lines: [{ lineType: "设备", spec: "华三 MSR3600 CPE", unitPrice: 3600, quantity: 6, receivedQty: 0, acceptedQty: 0 }],
    taxRate: 0.13, paymentTerms: "月结 60 天", status: "已下单", version: 1, batches: [], inboundDone: false,
  },
  {
    poNo: "PO-2026-020", supplier: "电信上海分公司", reqNos: [], createdAt: "2026-10-25 09:45",
    lines: [{ lineType: "带宽容量", spec: "上海—深圳 OTN 长途波道 10G", unitPrice: 2800, quantity: 2, receivedQty: 1, acceptedQty: 1 }],
    taxRate: 0.09, paymentTerms: "月结 30 天", status: "部分到货", version: 1,
    batches: [{ batchNo: 1, at: "2026-10-30 15:10", operator: "仓管-王敏", items: [{ lineIdx: 0, arrived: 1, result: "合格" }] }],
    inboundDone: false,
  },
];

// ---------- 轻量 store ----------
let version = 0;
const listeners = new Set<() => void>();
const bump = () => { version += 1; listeners.forEach((fn) => fn()); };
export function usePurchaseFlow(): number {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => version,
  );
}
export const getReqs = () => PURCHASE_REQS;
export const getOrders = () => PURCHASE_ORDERS;
export const REQ_BY_NO = (no: string) => PURCHASE_REQS.find((r) => r.reqNo === no);
export const PO_BY_NO = (no: string) => PURCHASE_ORDERS.find((p) => p.poNo === no);
export const poTotal = (po: PurchaseOrder) => po.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
export const poTotalWithTax = (po: PurchaseOrder) => Math.round(poTotal(po) * (1 + po.taxRate));

let poSeq = 53, reqSeq = 1103;
// SN 全局唯一登记（真实环境为设备档案序列号索引；原型以登记簿模拟查重）
const REGISTERED_SNS = ["SN-AR6121-0001", "SN-AR6121-0002", "SN-AR6121-0003"];
export const fmtMoney = (n: number) => n.toLocaleString("zh-CN");

// P08-1：新增采购需求（手工提报 / 业务规划）
export function addReq(data: Omit<PurchaseReq, "reqNo" | "status" | "createdAt" | "createdBy"> & { createdBy?: string }) {
  const req: PurchaseReq = {
    ...data, reqNo: `PR-2026-${reqSeq++}`, status: "待处理",
    createdAt: demoNow(), createdBy: data.createdBy ?? "孙工（运维）",
  };
  PURCHASE_REQS.unshift(req);
  bump();
  return req;
}
export function closeReq(reqNo: string) {
  const r = REQ_BY_NO(reqNo);
  if (r && r.status === "待处理") { r.status = "已关闭"; bump(); }
}

// P08-1b：带宽类需求 → 原采购合同的合同变更（补充协议），不新建采购单
// 理由：周期性月租类扩容要保持成本口径连续（出口池月租不切断），行业惯例为原合同补充协议 / 变更单
export function reqToContractChange(reqNo: string, lineId: string, addM: number, addMonthly: number): string | null {
  const r = REQ_BY_NO(reqNo);
  const row = R1_ROWS.find((x) => x.id === lineId);
  if (!r || r.status !== "待处理" || r.type !== "带宽" || !row) return "参数无效（需求单状态或出口线路不符）";
  if (!(addM > 0) || !(addMonthly > 0)) return "请填写新增容量与新增月租（均须 > 0）";
  const before = `${row.capacityM}M / ${fmtMoney(row.monthlyCost)} 元·月`;
  row.capacityM += addM;
  row.monthlyCost += addMonthly;
  r.status = "已转合同变更";
  r.contractNo = row.contractNo;
  r.note = `${r.note ?? ""}${r.note ? "｜" : ""}已转合同变更：${row.id} 出口池 ${before} → ${row.capacityM}M / ${fmtMoney(row.monthlyCost)} 元·月（+${addM}M、+${fmtMoney(addMonthly)} 元·月），原合同 ${row.contractNo} 走补充协议，审批通过后生效`.trim();
  bump();
  return null;
}

// P08-2：需求单转采购单（可多选汇总）；contractId = 关联的框架合同档案（自动带采购单价）；返回新采购单号
export function createPoFromReqs(reqNos: string[], supplier: string, contractId?: string): string | null {
  const reqs = PURCHASE_REQS.filter((r) => reqNos.includes(r.reqNo) && r.status === "待处理" && r.type !== "带宽"); // 带宽类不走采购单（→ 合同变更）
  if (!reqs.length) return null;
  const poNo = `PO-2026-${poSeq++}`;
  // 框架合同带价：按单计价类合同单价自动填入设备明细行（仍可修改，留痕）
  const contract = contractId ? PURCHASE_CONTRACTS.find((c) => c.id === contractId) : undefined;
  const lines: POLine[] = reqs.map((r) => ({
    lineType: r.type === "带宽" ? "带宽容量" : r.type === "IP 段" ? "IP 段" : "设备",
    spec: r.spec,
    unitPrice: r.type === "设备" && contract?.unitPrice ? contract.unitPrice : 0,
    quantity: r.qty, receivedQty: 0, acceptedQty: 0,
  }));
  PURCHASE_ORDERS.unshift({
    poNo, supplier, reqNos, lines, taxRate: 0.13, status: "草稿", version: 1, batches: [], inboundDone: false,
    ...(contractId ? { contractId } : {}),
    createdAt: demoNow(),
  });
  reqs.forEach((r) => { r.status = "已转采购单"; r.poNo = poNo; });
  bump();
  return poNo;
}
// 某采购合同档案名下的采购单（合同页反向查询）
export const POS_OF_CONTRACT = (contractId: string) => PURCHASE_ORDERS.filter((p) => p.contractId === contractId);
// 附件维护（原型 mock；正式环境走对象存储 + 留痕）
export function setPoAttachments(poNo: string, files: string[]) {
  const po = PO_BY_NO(poNo);
  if (po) { po.attachments = files; bump(); }
}
export function savePoDraft(poNo: string, patch: Partial<PurchaseOrder>) {
  const po = PO_BY_NO(poNo);
  if (po && po.status === "草稿") { Object.assign(po, patch); bump(); }
}
// P08-2 操作：提交 → P08-3 待审批（提交后锁定）；审批点停用（A2 配置）时提交直接生效
export function submitPo(poNo: string) {
  const po = PO_BY_NO(poNo);
  if (!po || po.status !== "草稿") return;
  if (po.lines.some((l) => !(l.unitPrice > 0))) return;
  po.status = "待审批"; bump();
}
export function submitPoDirect(poNo: string) {
  const po = PO_BY_NO(poNo);
  if (!po || po.status !== "草稿") return;
  if (po.lines.some((l) => !(l.unitPrice > 0))) return;
  po.status = "已下单"; bump();
}
// P08-3：批准 → 已下单；驳回 → 退回草稿（版本 +1，留痕）
export function approvePo(poNo: string) { const po = PO_BY_NO(poNo); if (po && po.status === "待审批") { po.status = "已下单"; bump(); } }
export function rejectPo(poNo: string, reason: string) {
  const po = PO_BY_NO(poNo);
  if (po && po.status === "待审批") { po.status = "草稿"; po.version += 1; po.rejectReason = reason; bump(); }
}
// P08-4：下单后录入采购合同价（作为 P09 自动核对的基准；查重）
export function saveContractPrice(poNo: string, data: { contractNo: string; signedAt: string; effectAt: string; lines: { spec: string; price: number }[] }) {
  const po = PO_BY_NO(poNo);
  if (!po) return "采购单不存在";
  if (PURCHASE_ORDERS.some((p) => p.poNo !== poNo && p.contractNo === data.contractNo)) return "合同编号已存在，请检查是否重复录入";
  Object.assign(po, { contractNo: data.contractNo, contractSignedAt: data.signedAt, contractEffectAt: data.effectAt, contractLines: data.lines });
  // 零星补签的合同自动沉淀为合同档案（B 方案：与框架合同同库，供成本条目引用与账单核对）
  if (!PURCHASE_CONTRACTS.some((c) => c.id === data.contractNo)) {
    const firstType = data.lines[0]?.spec ?? "";
    saveContract({
      id: data.contractNo,
      name: `按单采购合同（由 ${poNo} 补录）`,
      supplier: po.supplier,
      subject: /带宽/.test(firstType) ? "出口带宽" : /IP/.test(firstType) ? "IP 地址" : "设备采购",
      billing: "按单计价",
      unitPrice: data.lines[0]?.price,
      effect: data.effectAt,
      remark: `零星采购补签合同，由采购单 ${poNo} 下单后录入合同价时自动生成`,
    });
  }
  po.contractId = data.contractNo;
  bump();
  return null;
}

// P08-5：到货验收（分批）；合格部分先行验收，不合格差异登记留痕
export function addReceiptBatch(poNo: string, items: ReceiptItem[], operator = "仓管-王敏") {
  const po = PO_BY_NO(poNo);
  if (!po || (po.status !== "已下单" && po.status !== "部分到货")) return;
  po.batches.push({ batchNo: po.batches.length + 1, at: demoNow(), operator, items });
  items.forEach((it) => {
    const line = po.lines[it.lineIdx];
    if (!line) return;
    line.receivedQty += it.arrived;
    if (it.result === "合格") line.acceptedQty += it.arrived;
  });
  const allDone = po.lines.every((l) => l.receivedQty >= l.quantity);
  po.status = allDone ? "验收完成" : "部分到货";
  bump();
}

// P08-6：资源入库建档。设备逐台建档（SN 全局唯一）；带宽扩容写 R1；IP 段写 R3。
// 入库数量 ≤ 验收合格数量；提交后联动恢复挂起工单。
export function completeInbound(poNo: string, payload: {
  devices?: { sn: string; brand: string; model: string; warrantyEnd: string }[];
  bw?: { poolId: string; addM: number; monthlyCost: number };
  ip?: { segment: string; room: string; unitPrice: number };
}): string | null {
  const po = PO_BY_NO(poNo);
  if (!po || po.status !== "验收完成" || po.inboundDone) return "当前状态不允许入库";
  const devLine = po.lines.find((l) => l.lineType === "设备");
  if (devLine) {
    const n = payload.devices?.length ?? 0;
    if (n > devLine.acceptedQty) return `入库数量（${n} 台）超过验收合格数量（${devLine.acceptedQty} 台）`;
    if (n < devLine.acceptedQty) return `设备须逐台建档：合格 ${devLine.acceptedQty} 台，已建 ${n} 台`;
    for (const d of payload.devices!) {
      if (REGISTERED_SNS.includes(d.sn)) return `SN ${d.sn} 已存在（全局唯一，请检查）`;
    }
    // 匹配既有档案（按型号）则入库存量，否则新建档案
    payload.devices!.forEach((d) => {
      const exist = R4_ROWS.find((r) => r.name.includes(d.model));
      if (exist) {
        stockIn(exist.id, 1, devLine.unitPrice, poNo);
      } else {
        const id = `EQ-2026-${String(R4_ROWS.length + 101).padStart(4, "0")}`;
        R4_ROWS.push({ id, name: `${d.brand} ${d.model}`, category: "CPE", costPrice: devLine.unitPrice, supplier: po.supplier, location: "上海漕河泾仓库", status: "在库", dynamic: { stock: 1, locked: 0 } });
      }
      REGISTERED_SNS.push(d.sn);
    });
  }
  if (payload.bw) {
    const pool = R1_ROWS.find((r) => r.id === payload.bw!.poolId);
    if (pool) { pool.capacityM += payload.bw.addM; pool.monthlyCost += payload.bw.monthlyCost; }
  }
  if (payload.ip) {
    const seg = payload.ip.segment;
    if (R3_ROWS.some((r) => r.segment.startsWith(seg.split("/")[0]))) return `IP 段 ${seg} 与现有段冲突`;
    const total = Math.pow(2, 32 - Number(seg.split("/")[1] || 24));
    R3_ROWS.push({
      id: `IP-${seg.split("/")[0]}`, segment: `${seg}（入库新建）`, total, reserved: 2, unitPrice: payload.ip.unitPrice,
      boundLines: [], product: "", ipCat: "客户分配/互联网出口", source: "运营商代播", status: "生效",
      dynamic: { allocated: 0, orders: [{ customer: "新入库段（暂未分配）", n: 0 }] },
    });
  }
  po.inboundDone = true;
  po.inboundAt = demoNow();
  // 反向通知：需求单携带的挂起工单恢复开通
  const linkedReq = PURCHASE_REQS.find((r) => r.poNo === poNo && r.linkedWo);
  if (linkedReq) po.resumedWo = linkedReq.linkedWo;
  bump();
  return null;
}

// 挂起工单是否已被采购入库恢复（DeliveryDetail 读取）
export const woResumedByPurchase = (woId: string): PurchaseOrder | undefined =>
  PURCHASE_ORDERS.find((p) => p.inboundDone && p.resumedWo === woId);
