// A5 策略中心 —— 系统行为参数的唯一维护处（P03 计费 / P04 欠费 / P05 变更测算 / P06 违约金参考）
// 保存即生效（内存 store + 订阅）；所有消费方禁止硬编码这些值，一律 cfgNum/cfgStr 读取。
// 边界：不做按客户/合同覆盖，不做灰度与审批流（正式环境建议加），修改留痕可追。
import { useSyncExternalStore } from "react";

export interface CfgDef {
  key: string; label: string; unit: string; hint: string;
  type: "number" | "percent" | "select";
  min: number; max: number;
  options?: { v: string; label: string }[];   // type=select 时必填
  danger?: boolean;                            // 影响收钱/停机的敏感项，保存前二次确认
}
export interface CfgGroup { id: string; name: string; desc: string; items: CfgDef[] }

export const CFG_GROUPS: CfgGroup[] = [
  {
    id: "billing", name: "计费规则（P03）", desc: "账期锚定、应收日期与出账的行为参数",
    items: [
      { key: "billing.payTiming", label: "付款时点", unit: "", hint: "后付=账期结束后出账收款；预付=账期开始前出账收款（如年付一次性预付）", type: "select", min: 0, max: 0,
        options: [{ v: "postpaid", label: "后付费（账期结束后收款）" }, { v: "prepaid", label: "预付费（账期开始前收款）" }] },
      { key: "billing.dueDays", label: "付款期", unit: "天", hint: "后付：应收日 = 账期截止日 + N 天；预付：应收日 = 账期开始日 − N 天", type: "number", min: 0, max: 90 },
      { key: "billing.billOnSuspend", label: "欠停期间计费", unit: "", hint: "欠停订阅的周期费是否照常计入账单", type: "select", min: 0, max: 0,
        options: [{ v: "yes", label: "照常计（推荐，欠费不豁免费用）" }, { v: "no", label: "暂停计" }] },
    ],
  },
  {
    id: "overdue", name: "欠费策略（P04）", desc: "逾期判定、停机、滞纳金与坏账的行为参数；改动直接影响催收与停机动作",
    items: [
      { key: "overdue.graceDays", label: "宽限期", unit: "天", hint: "逾期 ≤ 宽限期仅提醒，不停机", type: "number", min: 0, max: 30 },
      { key: "overdue.remindDays", label: "提醒频率", unit: "天", hint: "每 N 天提醒一次（客户联系人 + 归属销售 + 财务）", type: "number", min: 1, max: 30 },
      { key: "overdue.suspendDays", label: "停机条件（逾期 > N 天）", unit: "天", hint: "命中即逐订阅生成停机工单；信用额度客户按额度判定", type: "number", min: 1, max: 180, danger: true },
      { key: "overdue.lateFeeRate", label: "滞纳金比例", unit: "%/日", hint: "逾期金额 × 比例 × 天数，按账期入下期账单；收讫即停止", type: "percent", min: 0, max: 0.2, danger: true },
      { key: "overdue.badDebtDays", label: "坏账门槛（逾期 ≥ N 天）", unit: "天", hint: "达到门槛的逾期账单可发起坏账申请（走 P10 审批）", type: "number", min: 30, max: 720 },
    ],
  },
  {
    id: "cost", name: "变更测算单价（P05）", desc: "变更单增量成本测算的取价依据；月结仍以实际账单为准",
    items: [
      { key: "cost.exitPerM", label: "出口带宽成本单价", unit: "元/M/月", hint: "带宽升级/降级的增量成本 = 带宽差 × 该单价", type: "number", min: 1, max: 1000 },
      { key: "cost.ipUnit", label: "IP 地址成本单价", unit: "元/个·月", hint: "增加/减少 IP 的增量成本 = 数量 × 该单价", type: "number", min: 1, max: 500 },
      { key: "cost.planRatio", label: "套餐变更成本率", unit: "%", hint: "套餐变更增量成本 = 月租差 × 成本率（正式版从产品组成自动推导）", type: "percent", min: 10, max: 95 },
      { key: "cost.installFee", label: "安装调测费（一次性）", unit: "元/次", hint: "地址迁移类变更的一次性成本", type: "number", min: 0, max: 100000 },
    ],
  },
  {
    id: "penalty", name: "违约金参考（P06）", desc: "退订违约金的参考试算参数；违约金一事一议，最终金额由审批确定",
    items: [
      { key: "penalty.refRate", label: "违约金参考比例", unit: "%", hint: "参考值 = 剩余未履行账期月租合计 × 该比例；仅供申请预填，非定价依据", type: "percent", min: 0, max: 100 },
    ],
  },
  {
    id: "settle", name: "月结（P07）", desc: "月结运行与测算差异比对的参数；月结完成后账期锁账，改动只能红冲",
    items: [
      { key: "settle.closeDay", label: "月结日", unit: "日", hint: "每月几号跑上月账期的月结（次月 N 日）", type: "number", min: 1, max: 28 },
      { key: "settle.diffYellow", label: "差异预警（黄）", unit: "%", hint: "测算 vs 实际差异超过该比例标黄，要求填写说明", type: "percent", min: 1, max: 100 },
      { key: "settle.diffRed", label: "差异预警（红）", unit: "%", hint: "超过该比例标红；只记录说明，不自动调账", type: "percent", min: 1, max: 200 },
    ],
  },
];

// ---------- 默认值与运行时值 ----------
const DEFAULTS: Record<string, string> = {
  "billing.payTiming": "postpaid", "billing.dueDays": "7", "billing.billOnSuspend": "yes",
  "overdue.graceDays": "7", "overdue.remindDays": "7", "overdue.suspendDays": "30", "overdue.lateFeeRate": "0.05", "overdue.badDebtDays": "180",
  "cost.exitPerM": "40", "cost.ipUnit": "50", "cost.planRatio": "62", "cost.installFee": "800",
  "penalty.refRate": "30",
  "settle.closeDay": "3", "settle.diffYellow": "10", "settle.diffRed": "20",
};
const values: Record<string, string> = { ...DEFAULTS };

// ---------- 变更留痕 ----------
export interface CfgLog { at: string; operator: string; key: string; label: string; from: string; to: string }
export const CFG_LOGS: CfgLog[] = [
  { at: "2026-10-20 09:15", operator: "系统初始化", key: "overdue.lateFeeRate", label: "滞纳金比例", from: "0.03", to: "0.05" },
];

// ---------- 轻量 store ----------
let version = 0;
const listeners = new Set<() => void>();
const bump = () => { version += 1; listeners.forEach((fn) => fn()); };
export function useSettings(): number {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => version,
  );
}
export const getCfg = (key: string): string => values[key] ?? DEFAULTS[key] ?? "";
export const cfgNum = (key: string): number => { const n = parseFloat(getCfg(key)); return Number.isFinite(n) ? n : parseFloat(DEFAULTS[key] ?? "0"); };
/** 百分比类配置（存的是百分数数值，如 0.05 表示 0.05%/日、62 表示 62%），返回小数 */
export const cfgRate = (key: string): number => cfgNum(key) / 100;
export const CFG_DEF = (key: string): CfgDef | undefined => CFG_GROUPS.flatMap((g) => g.items).find((i) => i.key === key);

const now = () => new Date().toISOString().slice(0, 16).replace("T", " ");

/** 保存配置：按定义校验取值范围；danger 项由调用方二次确认后传入 confirmed=true */
export function saveCfg(key: string, raw: string, operator = "系统管理员", confirmed = false): string | null {
  const def = CFG_DEF(key);
  if (!def) return "配置项不存在";
  const v = raw.trim();
  if (def.type === "select") {
    if (!def.options?.some((o) => o.v === v)) return "取值不在可选范围内";
  } else {
    const n = Number(v);
    if (!Number.isFinite(n)) return "必须填写数字";
    if (n < def.min || n > def.max) return `取值须在 ${def.min} ~ ${def.max} ${def.unit}之间`;
    if (def.type === "number" && !Number.isInteger(n)) return "必须填写整数";
  }
  if (def.danger && !confirmed) return "该配置直接影响停机/计费行为，需二次确认";
  const from = getCfg(key);
  if (from === v) return "值未变化";
  values[key] = v;
  CFG_LOGS.unshift({ at: now(), operator, key, label: def.label, from: displayOf(key, from), to: displayOf(key, v) });
  bump();
  return null;
}
const displayOf = (key: string, v: string): string => {
  const def = CFG_DEF(key);
  if (def?.type === "select") return def.options?.find((o) => o.v === v)?.label ?? v;
  return v + (def ? ` ${def.unit}` : "");
};
