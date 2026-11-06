// 成本条目库 —— 全系统算账逻辑的唯一出处
// 主线（全局成本模型）：直接成本条目随单实时算；间接费用条目归属成本中心、月结按所选分法分配。
// 本模块对 catalog.ts 的 ITEMS 做包装增强（不动原有定义，填报页兼容）：
//   ① 口径档案化：取数来源档案 / 计价方式 /（间接费用）归属成本中心；不设静态筛选条件——
//      条目全系统共用，选资源时的过滤在填报那一刻由订单的产品类型动态决定（资源档案带「归属产品类型 + 可共享产品类型」字段）
//   ② 状态机：草稿 → 生效 → 停用（要素齐全才允许生效）
//   ③ 锁定规则：被产品类型引用的条目，关键字段锁定（页面侧禁用录入）
import { useSyncExternalStore } from "react";
import { ITEMS, type CatalogItem } from "./catalog";

export type ItemStatus = "草稿" | "生效" | "停用";
export type ItemCategory = "资源驱动" | "手工录入";
/** 算账去向（成本性态）：直接 = 随单实时算；间接 = 归集成本中心、月末按所选分法分配（金额唯一出处） */
export type SettleType = "直接" | "间接";

/** 算账去向 → 一句话约束说明（展示在条目库与核算填报页） */
export const SETTLE_RULE: Record<SettleType, string> = {
  直接: "这单专属的成本：选档案带出单价随单算，或由填报部门按计价方式填报",
  间接: "分不清算哪单的共用费用：先归集到成本中心，月末按中心的分法分到各订单",
};

export interface CostItem extends CatalogItem {
  category: ItemCategory;      // 条目类别：资源驱动（从档案取数）/ 手工录入
  settleType: SettleType;      // 算账去向（直接 / 间接，决定金额从哪来）
  sourceArchive?: string;      // 取数来源档案（R1~R4 key、档案名或 resale=采购合同；手工录入为空）
  appliesTo?: string;          // 适用资源（资源目录 matKey）：这笔直接成本对应哪个资源类——产品组成推导直接成本的桥。
                               // 资源驱动条目由取数来源自动得出；手工录入条目建条目时手选；间接费用不从组成推导，无需填写
  formula?: string;            // 计价方式（算式文本）
  costCenter?: string;         // 归属成本中心（仅间接费用必填，CC-xx；直接成本随单算不归属中心）
  status: ItemStatus;
  specDriver?: string;         // 规格驱动：公式变量绑定的规格字段说明
  appliesToLog?: { at: string; from?: string; to?: string }[];  // 适用资源变更留痕（映射漂移审计）
  remark?: string;
}

// ---------- 预置条目的口径补录（迁移自原核算页面口径） ----------
/** 间接费用条目 → 归属成本中心（直接成本随单算，不归属中心） */
const CENTER_MAP: Record<string, string> = {
  t2: "CC-02", t4: "CC-01", t5: "CC-02", t6: "CC-04", t8: "CC-03", t9: "CC-04", t10: "CC-05",
};
/** 间接费用条目集合：共用费用，归集成本中心月结分配（含资产折旧类——按单算折旧第一期不做，并入中心归集） */
const INDIRECT_ITEMS = new Set(["t2", "t4", "t5", "t6", "t8", "t9", "t10"]);

/** 取数来源键（R1~R4 或 catalog 遗留键）→ 适用资源类（资源目录 matKey）；转售（resale）取数于采购合同，适用资源类 mat_resale */
export const SOURCE_TO_MAT: Record<string, string> = {
  r1: "mat_exit", r2: "mat_base", r3: "mat_ip", r4: "mat_dev",
  lineinternet: "mat_exit", linebase: "mat_base", lineip: "mat_ip", device: "mat_dev",
  cabinet: "mat_rack", service: "mat_3rdsvc", engineer: "mat_svc", resale: "mat_resale",
};
/** 手工录入 / 台账类预置条目的适用资源（无取数来源可推，预置指定；新建条目在表单手选） */
const PRESET_APPLIES: Record<string, string> = {
  op9: "mat_svc", op10: "mat_svc", op11: "mat_svc",   // 布线 / 物流 / 差旅 → 安装调测服务（交付服务）
  t1: "mat_svc",                                      // 网络开通实施费（人工）
  t3: "mat_port",                                     // OTU 端口使用费 → 网内端口资源
  t7: "mat_dev",                                      // 光模块及板卡材料费 → 设备与备件
};

// 预置条目全部默认为「生效」；间接费用不带自己的算式（金额由成本中心的分法统一算，条目只管归集到哪）
export const costItems: CostItem[] = ITEMS.map((it) => {
  const indirect = INDIRECT_ITEMS.has(it.key);
  const source = it.methods.find((m) => m.kind === "search")?.source;
  return {
    ...it,
    category: it.methods.some((m) => m.kind === "search") ? "资源驱动" : "手工录入",
    settleType: indirect ? "间接" : "直接",
    sourceArchive: source,
    appliesTo: indirect ? undefined : (PRESET_APPLIES[it.key] ?? SOURCE_TO_MAT[source ?? ""]),
    formula: indirect ? undefined : it.methods.find((m) => m.kind === "calc")?.label,
    costCenter: CENTER_MAP[it.key],
    status: "生效",
  };
});

// ---------- 轻量 store ----------
let version = 0;
const listeners = new Set<() => void>();
const bump = () => {
  version += 1;
  listeners.forEach((fn) => fn());
};
/** 组件订阅条目库变更（返回版本号触发重渲染，数据用 getCostItems() 读） */
export function useCostItems(): number {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version,
  );
}
export const getCostItems = () => costItems;

/** 配置齐全性检查（资源驱动类需来源档案；直接成本必须有计价方式 + 适用资源；间接费用无算式、必须归属成本中心——算法唯一出处是成本中心的分法） */
export const missingElements = (it: Pick<CostItem, "category" | "sourceArchive" | "formula" | "costCenter" | "settleType" | "appliesTo">): string[] => {
  const miss: string[] = [];
  if (!it.settleType) miss.push("算账去向");
  if (it.category === "资源驱动" && !it.sourceArchive) miss.push("取数来源");
  if (it.settleType !== "间接" && !it.formula) miss.push("计价方式");
  if (it.settleType !== "间接" && !it.appliesTo) miss.push("适用资源");
  if (it.settleType === "间接" && !it.costCenter) miss.push("归属成本中心");
  return miss;
};

export function updateItem(key: string, patch: Partial<CostItem>) {
  const it = costItems.find((i) => i.key === key);
  if (it) {
    // 适用资源（推导桥）变更留痕：映射改错会改变历史核算口径，审计依据
    if (patch.appliesTo !== undefined && patch.appliesTo !== it.appliesTo) {
      it.appliesToLog = [...(it.appliesToLog ?? []), { at: new Date().toISOString().slice(0, 16).replace("T", " "), from: it.appliesTo, to: patch.appliesTo || undefined }];
    }
    Object.assign(it, patch);
    bump();
  }
}

/** 资源类是否被启用的直接成本条目覆盖（推导桥命中） */
export const classCovered = (matKey: string): boolean =>
  costItems.some((i) => i.settleType === "直接" && i.status !== "停用" && !!i.appliesTo && i.appliesTo.split(/[,、\s]+/).includes(matKey));

/** 成本无出处检查：给定资源类集合中，未被任何启用直接条目覆盖的类（费用实际走间接分摊） */
export const uncoveredClasses = (matKeys: string[]): string[] => [...new Set(matKeys)].filter((k) => !classCovered(k));

let seq = 1;
export function addItem(patch: Partial<CostItem> & { name: string; dept: CostItem["dept"] }) {
  const key = `c${String(seq++).padStart(2, "0")}-${Date.now().toString().slice(-4)}`;
  const { name, dept, ...rest } = patch;
  costItems.push({
    key, name, dept,
    costType: "周期性", unit: "元/月", required: "按装配",
    cats: [], modes: [], methods: [], hint: "（新建条目，录入方式待补充）", demo: "plain1500",
    category: "手工录入", settleType: "直接", status: "草稿",
    ...rest,
  } as CostItem);
  bump();
  return key;
}

/** 被产品类型引用的反向查询（入参为产品目录快照，避免与 products.ts 循环依赖） */
export interface ItemRef {
  cat: string;       // 产品类别
  type: string;      // 产品类型
}
export function itemReferences(key: string, cats: { name: string; types: { name: string; costItems: string[] }[] }[]): ItemRef[] {
  const refs: ItemRef[] = [];
  for (const c of cats)
    for (const t of c.types) {
      if (t.costItems.includes(key)) refs.push({ cat: c.name, type: t.name });
    }
  return refs;
}
