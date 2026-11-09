// 资源中心（R1~R4）主数据 + ②层业务过程动态数据（原 B4 成本池已退役 → 成本中心模块；R5 在途采购档案已退役 → 采购管理模块）
// 对应《资源主数据设计 v1.1》：①主数据层（人手维护，变更留痕）②业务过程层（单据生成，只读展示）③快照层
// 字段模板已上收到资源目录：每个档案的表单字段 = 归属资源类（materialKey）的属性模板 attrs，
// 类定义字段、实例填值。本文件不再写死字段（保留 fields 仅作兜底，读取一律走 ARCHIVE_FIELDS）。
import { useSyncExternalStore } from "react";
import { MAT_DEF } from "./products";
import { DEMO_TODAY } from "./settings";
import type { FieldDef, FieldMethod } from "./products";
export type { FieldDef, FieldMethod };

/** 档案的表单字段：优先取归属资源类（资源目录）的属性模板 attrs，未定义时兜底 archive.fields */
export const ARCHIVE_FIELDS = (a: ArchiveDef): FieldDef[] => MAT_DEF(a.materialKey)?.attrs ?? a.fields ?? [];

export interface ArchiveDef {
  key: string;
  code: string;
  name: string;
  /** 归属物料（物料主数据为「主」，资源档案是物料的实例维度——SAP 式物料→库存层级）
   *  一个物料可有多套实例档案（如出口线路物料 ↔ R1 出口线路 + BGP 平台参数档案），一套档案只属于一个物料。 */
  materialKey: string;
  poolHint: string;     // 成本口径说明（直接/间接；原成本池已退役）
  /** @deprecated 档案字段改由资源目录中归属类（materialKey）的属性模板 attrs 驱动；
   *  本字段仅作无模板时的兜底，读取一律走 ARCHIVE_FIELDS() */
  fields?: FieldDef[];
}

/** 某物料下的全部实例档案（物料侧看“这个类下有哪些台账”） */
export const ARCHIVES_OF_MATERIAL = (matKey: string): ArchiveDef[] => ARCHIVES.filter((a) => a.materialKey === matKey);

// ---------- R1 出口线路档案 ----------
// 出口 = 向运营商采购的一条线路（合同性资源，非流量、不做减法），一条线路可多家客户共用。
// 无「池化线路 / BGP 出口组」之分：BGP 三网产品用电信/联通/移动三条（或多条）出口；
// 共享关系 = 「归属产品类型 + 可共享产品类型」两个字段，组不再是资源实体。
// 成本计收口径（全出口统一，产品类型级池化）：
// ① 录入测算（边际计价，决策依据）＝产品类型出口月租合计 ÷（该产品类型已售带宽合计 + 本单带宽）× 本单带宽
//    ——回答「新增这一单要花多少钱」，新线爬坡期客户不会被全价吓退；
// ② 月结归属（平均分摊，实际成本）＝池成本 ÷ 当时已售带宽 × 本单带宽（P07 月结模块）。
// 共用出口（同一出口挂多产品类型）：月租按各类型占用带宽占比拆进各自类型池，再按上述口径计收。
// 池化收益：新采购出口爬坡期闲置成本由全池客户共担，避免「单线单客户」成本畸高。
// 已售带宽/容量均为商用参考指标（满载预警），不进核算逻辑。
export interface R1Row {
  id: string; name: string;
  product: string;        // 归属产品类型（主）
  sharedWith: string;     // 可共享产品类型（、分隔；空 = 专属，仅一家使用）
  carrier: string; region: string; contractNo: string;
  capacityM: number; monthlyCost: number; effect: string; status: string;
  dynamic: { usedM: number; peakM?: number; orders: { customer: string; bw: number; since: string }[] };
}

// 采购合同候选统一出自「采购合同」一等主数据（purchase.ts）——此处仅留兼容适配，真实维护入口在 /purchase/contracts
import { getContracts } from "./purchase";

// R1 出口：选合同后带出容量 / 月租 / 生效日期 / 运营商
export const R1_CONTRACT_META: Record<string, { name: string; carrier?: string; capacityM?: number; monthlyCost?: number; effect?: string }> = Object.fromEntries(
  getContracts().filter((c) => c.capacityM != null || c.monthlyCost != null)
    .map((c) => [c.id, { name: c.name, carrier: c.subject === "出口带宽" ? c.supplier.replace("上海", "") : undefined, capacityM: c.capacityM, monthlyCost: c.monthlyCost, effect: c.effect }])
);

// R2 基础线路：选合同后带出带宽 / 整线月租 / 生效日期 / 运营商（整线月租类合同）
export const R2_CONTRACT_META: Record<string, { name: string; carrier?: string; bwM?: number; price?: number; effect?: string }> = Object.fromEntries(
  getContracts().filter((c) => c.bwM != null || c.linePrice != null)
    .map((c) => [c.id, { name: c.name, carrier: c.supplier.replace("上海", ""), bwM: c.bwM, price: c.linePrice, effect: c.effect }])
);

// R1 出口与 R2 基础线路共用的合同候选 = 全部周期性月租类合同
export const R1_CONTRACTS: string[] = getContracts().filter((c) => c.billing === "周期性月租").map((c) => c.id);

// 供应商下拉候选（真实环境来自供应商档案；R4 设备 / 采购单共用）
export const SUPPLIERS = ["华为渠道-上海XX", "华三渠道-上海YY", "光通信渠道-ZZ", "电信上海分公司", "上海电信", "上海联通", "漕河泾机房物业"];


// 按归属产品类型聚合出口池（月租合计 / 已售合计）——核算公式的取数口径
export function r1PoolByProduct(product: string, rows: R1Row[] = R1_ROWS) {
  const inPool = rows.filter((r) => r.product === product);
  return {
    lines: inPool.length,
    costSum: inPool.reduce((s, r) => s + r.monthlyCost, 0),
    soldSum: inPool.reduce((s, r) => s + r.dynamic.usedM, 0),
  };
}

export const R1: ArchiveDef = {
  key: "r1", code: "R1", name: "出口线路档案", materialKey: "mat_exit",
  poolHint: "成本口径：随单直接成本；同产品类型出口合并为一个池：录入按边际计价（池月租合计 ÷（已售＋本单带宽）× 本单带宽，决策依据），月结按平均分摊（池成本 ÷ 已售带宽）做实际归属；共用出口按各类型占用带宽占比拆池",
  fields: [],  // 字段由资源目录归属类的属性模板驱动（ARCHIVE_FIELDS），此处仅兜底
};

// 预置出口线路：BGP 三网 = 电信/联通/移动三条（可多条）；AI 专线与 BGP 共用同批出口；D-MAN 共用电信出口
export const R1_ROWS: R1Row[] = [
  {
    id: "E-CT-1", name: "电信-BGP出口-上海漕河泾-1G", product: "BGP 三网互通", sharedWith: "AI 专线、D-MAN",
    carrier: "电信", region: "上海市徐汇区漕河泾机房", contractNo: "CT-2026-018",
    capacityM: 1000, monthlyCost: 45000, effect: "2025-01-01", status: "生效",
    dynamic: {
      usedM: 600, peakM: 410,
      orders: [
        { customer: "中海贸易（BGP）", bw: 200, since: "2025-09" },
        { customer: "凯瑞传媒（BGP）", bw: 200, since: "2026-02" },
        { customer: "云启数据（AI 专线）", bw: 100, since: "2026-03" },
        { customer: "跃游网络（D-MAN）", bw: 50, since: "2026-06" },
        { customer: "某科技公司（BGP，核算中）", bw: 50, since: "—" },
      ],
    },
  },
  {
    id: "I-102", name: "联通-169-BGP出口-上海漕河泾-1G", product: "BGP 三网互通", sharedWith: "AI 专线",
    carrier: "联通", region: "上海市徐汇区漕河泾机房", contractNo: "CU-2026-033",
    capacityM: 1000, monthlyCost: 40000, effect: "2025-01-01", status: "生效",
    dynamic: {
      usedM: 500, peakM: 300,
      orders: [
        { customer: "中海贸易（BGP）", bw: 200, since: "2025-09" },
        { customer: "凯瑞传媒（BGP）", bw: 200, since: "2026-02" },
        { customer: "云启数据（AI 专线）", bw: 100, since: "2026-03" },
      ],
    },
  },
  {
    id: "I-103", name: "移动-CMNET-BGP出口-上海漕河泾-800M", product: "BGP 三网互通", sharedWith: "AI 专线",
    carrier: "移动", region: "上海市徐汇区漕河泾机房", contractNo: "CM-2026-007",
    capacityM: 800, monthlyCost: 28000, effect: "2025-01-01", status: "生效",
    dynamic: {
      usedM: 500, peakM: 390,
      orders: [
        { customer: "中海贸易（BGP）", bw: 200, since: "2025-09" },
        { customer: "凯瑞传媒（BGP）", bw: 200, since: "2026-02" },
        { customer: "云启数据（AI 专线）", bw: 100, since: "2026-03" },
      ],
    },
  },
  {
    id: "I-101", name: "电信-CN2GIA-国内精品网出口-上海-500M", product: "国内精品网", sharedWith: "",
    carrier: "电信", region: "上海市徐汇区漕河泾机房", contractNo: "CT-2026-051",
    capacityM: 500, monthlyCost: 75000, effect: "2025-09-01", status: "生效",
    dynamic: {
      usedM: 180, peakM: 235,
      orders: [
        { customer: "恒信证券", bw: 80, since: "2026-01" },
        { customer: "博彦软件", bw: 100, since: "2026-06" },
      ],
    },
  },
  {
    id: "PN-DOM", name: "国内精品网骨干通道-上海张江入口-1G", product: "国内精品网", sharedWith: "",
    carrier: "三方", region: "上海市浦东新区张江机房", contractNo: "PN-2026-002",
    capacityM: 1000, monthlyCost: 120000, effect: "2025-08-01", status: "生效",
    dynamic: {
      usedM: 520, peakM: 560,
      orders: [
        { customer: "澜石金融", bw: 320, since: "2025-08" },
        { customer: "云途物流", bw: 200, since: "2026-02" },
      ],
    },
  },
  {
    id: "PN-INTL", name: "国际精品网出口-香港方向-500M（境外运营商采购）", product: "国际精品网", sharedWith: "",
    carrier: "境外运营商", region: "香港特别行政区", contractNo: "HK-2026-011",
    capacityM: 500, monthlyCost: 130000, effect: "2025-08-01", status: "生效",
    dynamic: {
      usedM: 200, peakM: 160,
      orders: [
        { customer: "某跨境电商", bw: 120, since: "2026-01" },
        { customer: "某出海游戏厂商", bw: 80, since: "2026-05" },
      ],
    },
  },
];

// ---------- R2 基础线路 ----------
export interface R2Row {
  id: string; name: string; carrier: string;
  bwM: number; billing: "周期性（月）" | "一次性买断"; price: number; contractNo: string;
  shareable: "是" | "否"; effect: string; status: string;
  dynamic?: { usedBy: string };
}
export const R2: ArchiveDef = {
  key: "r2", code: "R2", name: "基础线路档案", materialKey: "mat_base",
  poolHint: "支撑条目：基础线路租用费；单客户专用，可跨产品类型共用（共用行计 0、成本计于首行）；整条月租计价、不绑定 IP",
  fields: [],  // 字段由资源目录归属类的属性模板驱动（ARCHIVE_FIELDS），此处仅兜底
};
export const R2_ROWS: R2Row[] = [
  { id: "B-001", name: "电信-CN2GIA-客户侧↔漕河泾机房-100M", carrier: "电信", bwM: 100, billing: "周期性（月）", price: 1000, contractNo: "CT-2026-063", shareable: "是", effect: "2026-01-01", status: "生效", dynamic: { usedBy: "本单 ISP 行已关联（核算中）" } },
  { id: "B-002", name: "联通-169-客户侧↔漕河泾机房-200M", carrier: "联通", bwM: 200, billing: "周期性（月）", price: 1600, contractNo: "CU-2026-042", shareable: "是", effect: "2025-12-01", status: "生效" },
  { id: "B-201", name: "电信-上海↔北京-OTN波道10G（含两端）", carrier: "电信", bwM: 10000, billing: "周期性（月）", price: 6000, contractNo: "OT-2026-009", shareable: "是", effect: "2026-03-01", status: "生效", dynamic: { usedBy: "数据专线行关联（核算中）" } },
  { id: "B-202", name: "电信-上海↔广州-OTN波道10G（含两端）", carrier: "电信", bwM: 10000, billing: "周期性（月）", price: 5200, contractNo: "OT-2026-015", shareable: "是", effect: "2026-05-01", status: "生效" },
];

// ---------- R3 IP 地址段 ----------
// 行业口径：IP 地址段（segment / prefix）。关联关系：先选归属产品类型 → 以它为条件查出该产品可用的出口线路
//（归属该类型 + 标记可共享给该类型的线路）→ 再勾选关联（一段可挂 1~2 条线做冗余，已关联只增不删）。
// 业务类型不再多选打标：由关联的出口线路反推（与 R1 归属产品类型模型一致）。
export const IP_CAT_L1 = ["客户分配", "内部使用"];
export const IP_CAT_L2_DEMO: Record<string, string[]> = {
  客户分配: ["互联网出口", "备案专用", "BGP 互联", "AI 专线"],
  内部使用: ["设备管理", "机房互联", "保留段"],
};
export interface R3Row {
  id: string; name?: string; segment: string; total: number; reserved?: number;
  unitPrice: number; boundLines: string[]; product?: string; ipCat?: string; remark?: string;
  source: "自有" | "运营商代播"; status: string;
  dynamic: { allocated: number; orders: { customer: string; n: number }[] };
}
export const R3: ArchiveDef = {
  key: "r3", code: "R3", name: "IP 地址段档案", materialKey: "mat_ip",
  poolHint: "成本口径：随单直接成本；先选归属产品类型、再按该类型查询可关联的出口线路，一段可挂 1~2 条线做冗余、已关联只增不删",
  fields: [],  // 字段由资源目录归属类的属性模板驱动（ARCHIVE_FIELDS），此处仅兜底
};
export const R3_ROWS: R3Row[] = [
  { id: "IP-58.40.0", name: "漕河泾-精品网出口-01", segment: "58.40.0.0/24（C 段）", total: 256, reserved: 2, unitPrice: 39, boundLines: ["I-101"], product: "国内精品网", ipCat: "客户分配/互联网出口", remark: "主力精品网段，切分以 /32 分配给订单", source: "自有", status: "生效",
    dynamic: { allocated: 214, orders: [{ customer: "恒信证券", n: 64 }, { customer: "博彦软件", n: 100 }, { customer: "某科技公司（核算中）", n: 4 }, { customer: "其余 10 单合计", n: 46 }] } },
  { id: "IP-58.41.0", name: "漕河泾-BGP电信出口-01", segment: "58.41.0.0/24（C 段）", total: 256, reserved: 2, unitPrice: 39, boundLines: ["E-CT-1"], product: "BGP 三网互通", ipCat: "客户分配/BGP 互联", source: "自有", status: "生效",
    dynamic: { allocated: 96, orders: [{ customer: "中海贸易", n: 40 }, { customer: "跃游网络", n: 56 }] } },
  { id: "IP-58.42.0", name: "漕河泾-BGP联通出口-01", segment: "58.42.0.0/24（C 段）", total: 256, reserved: 2, unitPrice: 39, boundLines: ["I-102"], product: "BGP 三网互通", ipCat: "客户分配/BGP 互联", source: "自有", status: "生效",
    dynamic: { allocated: 180, orders: [{ customer: "凯瑞传媒", n: 100 }, { customer: "朗润教育", n: 80 }] } },
  { id: "IP-58.43.0", name: "漕河泾-BGP移动出口-01", segment: "58.43.0.0/24（C 段）", total: 256, reserved: 2, unitPrice: 39, boundLines: ["I-103"], product: "BGP 三网互通", ipCat: "客户分配/BGP 互联", source: "自有", status: "生效",
    dynamic: { allocated: 96, orders: [{ customer: "云启数据（AI 专线）", n: 96 }] } },
  { id: "IP-58.44.0", name: "临港-AI专线-01", segment: "58.44.0.0/24（C 段）", total: 256, reserved: 2, unitPrice: 39, boundLines: ["E-CT-1", "I-102"], product: "AI 专线", ipCat: "客户分配/AI 专线", remark: "绑电信主用 + 联通备用（冗余）", source: "自有", status: "生效",
    dynamic: { allocated: 150, orders: [{ customer: "云启数据", n: 100 }, { customer: "某科技公司（核算中）", n: 50 }] } },
  { id: "IP-58.45.0", name: "漕河泾-保留段-01", segment: "58.45.0.0/24（C 段）", total: 256, reserved: 2, unitPrice: 39, boundLines: [], product: "", ipCat: "内部使用/保留段", remark: "备用段，暂不对外分配；启用前需业务支撑部确认", source: "自有", status: "生效",
    dynamic: { allocated: 0, orders: [{ customer: "备用段（暂未分配）", n: 0 }] } },
];

// ---------- R4 设备库存 ----------
export interface R4Row {
  id: string; name: string; category: string; costPrice: number; supplier: string; location: string; status: string;
  dynamic: { stock: number; locked: number };
}
export const R4: ArchiveDef = {
  key: "r4", code: "R4", name: "设备库存档案", materialKey: "mat_dev",
  poolHint: "库存直绑（P02）带出库存成本价；与 P06 退订回收联动；含网卡/HBA 卡（2026-10-21 扩类）",
  fields: [],  // 字段由资源目录归属类的属性模板驱动（ARCHIVE_FIELDS），此处仅兜底
};
export const R4_ROWS: R4Row[] = [
  { id: "EQ-AR6121", name: "华为 AR6121 CPE", category: "CPE", costPrice: 4500, supplier: "华为渠道-上海XX", location: "上海市徐汇区漕河泾仓库", status: "在库", dynamic: { stock: 5, locked: 4 } },
  { id: "EQ-MSR3600", name: "华三 MSR3600 CPE", category: "CPE", costPrice: 3800, supplier: "华三渠道-上海YY", location: "上海市徐汇区漕河泾仓库", status: "在库", dynamic: { stock: 2, locked: 0 } },
  { id: "EQ-SFP10G", name: "10G 光模块（华为兼容）", category: "光模块", costPrice: 400, supplier: "光通信渠道-ZZ", location: "上海市徐汇区漕河泾仓库", status: "在库", dynamic: { stock: 30, locked: 4 } },
];

// ---------- 库存三层：入库单 → 结存（数量层）→ 出库单；设备按采购价直接结转（在途由采购单 P08 管理） ----------
export interface InvInDoc {
  id: string; deviceId: string; qty: number; price: number; poNo: string; at: string; operator: string;
}
export interface InvOutDoc {
  id: string; deviceId: string; qty: number; costPrice: number; refType: "销售订单" | "核算锁定" | "其他"; refId: string; at: string; operator: string;
}
export const INV_IN_DOCS: InvInDoc[] = [
  { id: "IN-2026-001", deviceId: "EQ-AR6121", qty: 3, price: 4500, poNo: "PO-2026-018", at: "2026-08-12", operator: "仓管-王敏" },
  { id: "IN-2026-004", deviceId: "EQ-AR6121", qty: 2, price: 4600, poNo: "PO-2026-031", at: "2026-10-20", operator: "仓管-王敏" },
  { id: "IN-2026-002", deviceId: "EQ-MSR3600", qty: 2, price: 3800, poNo: "PO-2026-022", at: "2026-09-02", operator: "仓管-王敏" },
  { id: "IN-2026-003", deviceId: "EQ-SFP10G", qty: 30, price: 400, poNo: "PO-2026-025", at: "2026-09-15", operator: "仓管-王敏" },
];
export const INV_OUT_DOCS: InvOutDoc[] = [
  { id: "OUT-2026-011", deviceId: "EQ-SFP10G", qty: 2, costPrice: 400, refType: "销售订单", refId: "CE-2026-1008（L1+L2 实施领料）", at: "2026-10-22", operator: "仓管-王敏" },
];

let invSeq = 12;
let inSeq = 5;
const invListeners = new Set<() => void>();
let invVersion = 0;
const bumpInv = () => {
  invVersion += 1;
  invListeners.forEach((f) => f());
};
/** 组件订阅库存单据变更（返回版本号触发重渲染，数据用 INV_IN_DOCS / INV_OUT_DOCS 读） */
export function useInventory(): number {
  return useSyncExternalStore(
    (fn) => {
      invListeners.add(fn);
      return () => invListeners.delete(fn);
    },
    () => invVersion,
  );
}

/** 入库：只加现存量，档案采购价不变（设备一律按采购价直接结转，不做加权平均） */
export function stockIn(deviceId: string, qty: number, price: number, poNo: string, operator = "仓管-王敏") {
  const d = R4_ROWS.find((r) => r.id === deviceId);
  if (!d || qty <= 0 || price < 0) return null;
  d.dynamic.stock += qty;
  const doc: InvInDoc = {
    id: `IN-2026-${String(inSeq++).padStart(3, "0")}`,
    deviceId, qty, price, poNo, at: DEMO_TODAY, operator,
  };
  INV_IN_DOCS.push(doc);
  bumpInv();
  return doc;
}

/** 出库：按档案采购价直接结转计入成本；不允许负库存（返回 null = 拒绝） */
export function stockOut(deviceId: string, qty: number, refType: InvOutDoc["refType"], refId: string, operator = "仓管-王敏") {
  const d = R4_ROWS.find((r) => r.id === deviceId);
  if (!d || qty <= 0) return null;
  if (d.dynamic.stock - qty < 0) return null;
  const doc: InvOutDoc = {
    id: `OUT-2026-${String(invSeq++).padStart(3, "0")}`,
    deviceId, qty, costPrice: d.costPrice, refType, refId,
    at: DEMO_TODAY, operator,
  };
  d.dynamic.stock -= qty;
  INV_OUT_DOCS.push(doc);
  bumpInv();
  return doc;
}

export const ARCHIVES: ArchiveDef[] = [R1, R2, R3, R4];

// ---------- R5 已退役（2026-11-03）----------
// 原「R5 在途采购单档案」被采购管理模块取代：采购实例由 P08 采购单生成（需求 → 草稿 → 审批 → 下单 → 验收 → 入库），
// 在途状态即采购单自身状态，本模块不再维护采购侧档案视图（实例视图见 /purchase/orders）。

// 注：间接成本的归集与分配已迁移到「成本中心」主数据（costCenters.ts，CC-xx）；
// 原 B4 成本池规则随「公摊费用」口径一并退役——直接成本随单实时算（挂产品 BOM 物料），间接费用归集成本中心、月末按动因分配。
