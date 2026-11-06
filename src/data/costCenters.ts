// 成本中心 —— 间接成本的归集与分配单元（管理会计标准做法，对齐制造业「成本中心 + 动因分配」）
// 两步法：间接费用先按「归属成本中心」归集（月费用来自供应商账单 / 折旧摊销录入）
//         月末按「分配动因」算分配率切分到各订单（月结运行，差异留中心滚动，不追溯订单）
// 与直接成本的分工：直接成本 = BOM 物料上的条目，随单实时算；间接成本 = 本中心归集，月结按所选分法分配。
import { useSyncExternalStore } from "react";

/** 月结记录：真实账单到达后按同一动因重算，差异留中心滚动（只增不改） */
export interface SettleRun {
  period: string;        // 账期，如 2026-09
  estCost: number;       // 第一阶段：核算预估切分总额
  realCost: number;      // 第二阶段：真实账单金额
  diff: number;          // 差异 = 真实 − 预估（留中心滚动，不追溯订单）
  status: "差异留中心滚动" | "已核销";
  runAt: string;
}

/** 成本中心：归集哪些间接费用条目 + 按什么规则分配到订单 */
export interface CostCenter {
  id: string;            // CC-xx
  name: string;          // 如：出口调度平台、设备维保、监控运维、云平台运营、SLA 保障
  itemKeys: string[];    // 归集的间接费用条目（成本条目库中要素类型 = 间接费用 的条目）
  driverKey?: string;    // 分法预设（DRIVER_PRESETS 的 key；空 = 自定义）
  driver: string;        // 分法名称（如：按带宽占比分）
  formula: string;       // 算式（人话：中心当月费用 × 本单带宽 ÷ 当月总售出带宽）
  status?: "启用" | "停用";
  settleRuns?: SettleRun[];
}

// ---------- 分法预设（大白话，配带数字的算例；选一种，算式自动生成） ----------
export interface DriverPreset {
  key: string;
  name: string;          // 分法名称
  desc: string;          // 一句人话解释：什么情况下选它
  gen: (center: string) => string;  // 由中心名自动生成算式
  example: string;       // 带数字的完整算例
}
export const DRIVER_PRESETS: DriverPreset[] = [
  { key: "bw", name: "按带宽占比分", desc: "谁的订单带宽大，谁多承担。适合出口、调度平台这类和带宽强相关的费用",
    gen: (c) => `${c}当月费用 × 本单带宽 ÷ ${c}当月总售出带宽`,
    example: "中心 9 月费用 12,500 元、当月总售出带宽 1,600M；某客户一单带宽 100M → 这一单摊 12,500 × 100 ÷ 1,600 ≈ 781 元/月" },
  { key: "eq", name: "按客户数平均分", desc: "每家用得一样多：当月费用除以当月服务的客户数",
    gen: (c) => `${c}当月费用 ÷ 当月服务客户数`,
    example: "中心 9 月费用 8,000 元、当月服务 20 家客户 → 每家摊 8,000 ÷ 20 = 400 元/月" },
  { key: "node", name: "按节点数分", desc: "谁占用的节点多，谁多承担。适合云节点、监控点位这类按点位计的费用",
    gen: (c) => `${c}当月费用 × 本单占用节点数 ÷ 当月节点总数`,
    example: "中心 9 月费用 6,000 元、当月节点总数 30 个；一单占用 3 个 → 摊 6,000 × 3 ÷ 30 = 600 元/月" },
  { key: "cap", name: "按容量占比分", desc: "按占用容量的比例分配。适合端口、机柜位、冗余容量这类有容量概念的费用",
    gen: (c) => `${c}当月费用 × 本单占用容量 ÷ 总容量（已单独采购的计 0）`,
    example: "中心 9 月费用 5,000 元、总容量 100G；一单占用 10G → 摊 5,000 × 10 ÷ 100 = 500 元/月" },
];

/** 中心的分法算式（预设自动生成 / 自定义取录入值） */
export const DRIVER_SENTENCE = (c: Pick<CostCenter, "name" | "driverKey" | "formula">): string => {
  const p = DRIVER_PRESETS.find((x) => x.key === c.driverKey);
  return p ? p.gen(c.name) : c.formula;
};

// ---------- 预置成本中心（对齐现有间接费用条目：BGP 平台 / 维保 / 监控 / 云许可 / SLA 冗余） ----------
let centers: CostCenter[] = [
  { id: "CC-01", name: "出口调度平台", itemKeys: ["t4"], driverKey: "bw", driver: "按带宽占比分",
    formula: "出口调度平台当月费用 × 本单带宽 ÷ 出口调度平台当月总售出带宽",
    settleRuns: [{ period: "2026-09", estCost: 12500, realCost: 13000, diff: 500, status: "差异留中心滚动", runAt: "2026-10-08" }] },
  { id: "CC-02", name: "设备维保", itemKeys: ["t2", "t5"], driverKey: "cap", driver: "按容量占比分",
    formula: "设备维保当月费用 × 本单占用容量 ÷ 总容量（已单独采购的计 0）" },
  { id: "CC-03", name: "监控运维", itemKeys: ["t8"], driverKey: "eq", driver: "按客户数平均分",
    formula: "监控运维当月费用 ÷ 当月服务客户数" },
  { id: "CC-04", name: "云平台运营", itemKeys: ["t6", "t9"], driverKey: "node", driver: "按节点数分",
    formula: "云平台运营当月费用 × 本单占用节点数 ÷ 当月节点总数" },
  { id: "CC-05", name: "SLA 保障", itemKeys: ["t10"], driverKey: "cap", driver: "按容量占比分",
    formula: "SLA 保障当月费用 × 本单占用容量 ÷ 总容量（已单独采购的计 0）" },
];

// ---------- 轻量 store ----------
let version = 0;
const listeners = new Set<() => void>();
const bump = () => {
  version += 1;
  listeners.forEach((fn) => fn());
};
/** 组件订阅成本中心变更（返回版本号触发重渲染，数据用 getCenters() 读） */
export function useCenters(): number {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version,
  );
}
export const getCenters = () => centers;
export const CC_DEF = (id?: string) => centers.find((c) => c.id === id);
export const CC_NAME = (id?: string) => (id ? (CC_DEF(id)?.name ?? id) : "");

/** 新增 / 更新成本中心 */
export function saveCenter(c: CostCenter) {
  centers = centers.some((x) => x.id === c.id) ? centers.map((x) => (x.id === c.id ? c : x)) : [...centers, c];
  bump();
}
let seq = centers.length + 1;
/** 新建成本中心（编号自动 CC-xx） */
export function addCenter(patch: Omit<CostCenter, "id">): string {
  const id = `CC-${String(seq++).padStart(2, "0")}`;
  saveCenter({ id, status: "启用", ...patch });
  return id;
}
export function updateCenter(id: string, patch: Partial<CostCenter>) {
  const c = centers.find((x) => x.id === id);
  if (c) {
    Object.assign(c, patch);
    bump();
  }
}

/** 月结重算：真实账单到达后按同一动因重算并留痕（只增不改，差异留中心滚动） */
export function addSettleRun(id: string, run: Omit<SettleRun, "diff">) {
  const c = centers.find((x) => x.id === id);
  if (!c) return;
  const full: SettleRun = { ...run, diff: run.realCost - run.estCost };
  c.settleRuns = [...(c.settleRuns ?? []), full];
  bump();
}
