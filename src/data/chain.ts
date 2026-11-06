// 核算链路：命名引用链的解析与断链判定（核算链路图 / 产品侧链路卡片 / 资源侧被引用列表共用）
// 链：产品类型 —装配→ 成本条目（挂 BOM 物料 / 勾成本中心）—取数→ 资源档案(R1~R4) 或采购合同（转售）；直接成本随单算，间接费用归集成本中心
import type { CostItem } from "./costItems";
import { ARCHIVES, R1_ROWS, R2_ROWS, R3_ROWS, R4_ROWS, r1PoolByProduct } from "./resources";
import { PURCHASE_CONTRACTS } from "./purchase";

const fmtM = (n: number) => n.toLocaleString("zh-CN", { maximumFractionDigits: 2 });

/** 老口径取数来源键 → R1~R4 档案键（catalog.ts 遗留命名，迁移期兼容）；转售采购取数于采购合同，不是资源档案 */
const LEGACY_ARCHIVE_MAP: Record<string, string> = {
  lineinternet: "r1", // 出口资源 → R1 出口线路档案
  linebase: "r2",     // 基础线路资源 → R2 基础线路档案
  lineip: "r3",       // 绑定 IP 地址段 → R3 IP 地址段档案
  device: "r4",       // 设备库存 / 机柜 → R4 设备库存
};

/** 条目的取数档案键（r1~r4，或转售的伪键 "resale" = 采购合同）；字典/台账类来源（工时、SLA、计费参数等）返回 undefined */
export const itemArchiveKey = (it: Pick<CostItem, "sourceArchive">): string | undefined => {
  const s = it.sourceArchive;
  if (!s) return undefined;
  if (/^r[1-4]$/.test(s)) return s;
  if (s === "resale") return "resale"; // 取数于采购合同（采购管理模块），非资源档案
  return LEGACY_ARCHIVE_MAP[s];
};

/** 档案显示名（resale 为采购合同伪键） */
export const ARCHIVE_NAME = (key?: string): string =>
  key === "resale" ? "采购合同（转售批发价）" : key ? (ARCHIVES.find((a) => a.key === key)?.name ?? key) : "";

export interface ChainBreak { node: string; text: string }

/** 一笔账的「待办」清单（大白话）：缺什么配置、为什么算不了，新人可懂 */
export function itemProblems(it: CostItem): string[] {
  const out: string[] = [];
  if (it.status === "停用") out.push("这笔账已被停用，开单时不会计算");
  if (it.status === "草稿") out.push("这笔账还是草稿、没有生效");
  if (it.category === "资源驱动" && !it.sourceArchive) out.push("还没告诉系统从哪个资源档案里挑");
  if (it.settleType !== "间接" && !it.formula) out.push("还没告诉系统这笔账按什么计价方式算");
  if (it.settleType === "间接" && !it.costCenter) out.push("还没告诉系统这笔间接费用归集到哪个成本中心");
  return out;
}

/** 一个产品的「待办」清单：每笔账的问题 + 没配账 + 组成覆盖检查（直接成本的适用资源须在产品组成里，否则推导不进核算单） */
export function typeProblems(
  type: { name: string; costItems: string[]; materials?: { libKey: string }[] },
  items: CostItem[],
): ChainBreak[] {
  const out: ChainBreak[] = [];
  if (!type.costItems.length) out.push({ node: type.name, text: "还没告诉系统这个产品要算哪些账" });
  const compKeys = (type.materials ?? []).map((m) => m.libKey);
  for (const key of type.costItems) {
    const it = items.find((i) => i.key === key);
    if (!it) { out.push({ node: key, text: "配置的这笔账已被删除，请从产品里移除它" }); continue; }
    for (const t of itemProblems(it)) out.push({ node: it.name, text: t });
    if (it.settleType !== "间接" && it.appliesTo && compKeys.length && !compKeys.includes(it.appliesTo)) {
      out.push({ node: it.name, text: "直接成本的适用资源不在产品组成里：推导不进核算单，请补选对应资源或调整条目的适用资源" });
    }
  }
  return out;
}

/** 资源侧被引用：取数于本档案的条目 + 装配这些条目的产品类型（ServiceNow Related List 模式） */
export function archiveReferences(
  archiveKey: string,
  items: CostItem[],
  cats: { name: string; types: { name: string; costItems: string[] }[] }[],
) {
  return items
    .filter((i) => itemArchiveKey(i) === archiveKey)
    .map((i) => ({
      item: i,
      products: cats.flatMap((c) =>
        c.types.filter((t) => t.costItems.includes(i.key)).map((t) => ({ cat: c.name, type: t.name })),
      ),
    }));
}

/** 用真实档案数据为这笔账生成一段算例（数字均为档案真实值；手工录入/字典类返回 undefined） */
export function billExample(item: CostItem): string | undefined {
  const k = itemArchiveKey(item);
  if (k === "r1") {
    const r = R1_ROWS[0];
    const pool = r1PoolByProduct(r.product);
    const bw = 100;
    return `客户买 ${bw}M：${r.product}出口池（${pool.lines} 条线）月租合计 ${fmtM(pool.costSum)} ÷（已售 ${fmtM(pool.soldSum)} + ${bw}）× ${bw} = ${fmtM((pool.costSum / (pool.soldSum + bw)) * bw)} 元/月（边际计价：新增本单的成本；月结按平均分摊做实际归属）`;
  }
  if (k === "r2") {
    const r = R2_ROWS[0];
    return `租 1 条「${r.name}」：整线月租 ${fmtM(r.price)} 元/月（单客户专用；跨产品共用行计 0）`;
  }
  if (k === "r3") {
    const r = R3_ROWS[0];
    return `给这单分 4 个 IP：4 × ${fmtM(r.unitPrice)} = ${fmtM(4 * r.unitPrice)} 元/月`;
  }
  if (k === "r4") {
    const r = R4_ROWS[0];
    return `出库 2 台：2 × ${fmtM(r.costPrice)} = ${fmtM(2 * r.costPrice)} 元`;
  }
  if (item.sourceArchive === "resale" || k === "resale") {
    const c = PURCHASE_CONTRACTS.find((x) => x.billing === "按单计价") ?? PURCHASE_CONTRACTS[0];
    return `按采购合同批发价直接结转：如「${c.name}」框架单价 ${fmtM(c.unitPrice ?? 0)} 元（合同价见采购管理）`;
  }
  return undefined;
}
