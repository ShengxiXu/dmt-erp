// P05 订阅变更 / P06 退订与资源回收 —— 客户生命周期后段
// P05：变更申请（升/降带宽、增 IP、迁址）→ 审批 → 生效（订阅行与月租更新，次账期起按新价出账）
// P06：退订申请 → 审批 → 退订生效（订阅=退订，自生效账期停止出账）→ 资源回收单（CPE 回库 / IP 与带宽释放）→ 回收执行
// 联动：billing.ts（订阅台账 updateSubscription / 出账跳过退订）、resources.ts（R4 库存 stockIn 回库）
import { useSyncExternalStore } from "react";
import { SUBSCRIPTIONS, updateSubscription, addManualBill } from "@/data/billing";
import { CONTRACTS } from "@/data/contracts";
import { stockIn } from "@/data/resources";
import { cfgNum, cfgRate } from "@/data/settings";
import { bomMonthlyCost, ptypeOfLine, poolMarginal, ipOfLine } from "@/data/bomEstimate";

// ---------- P05 变更单 ----------
export type ChangeType = "套餐变更" | "带宽升级" | "带宽降级" | "增加 IP" | "减少 IP" | "地址迁移";
export type ChangeStatus = "审批中" | "已生效" | "已驳回";
/** 变更测算（增量成本，审批依据）：提交时按变更类型自动推导，月结仍以实际账单为准 */
export interface CostEst { items: { name: string; deltaMonthly: number; onceOff?: number }[]; deltaMonthly: number; onceOff: number; basis: string }
export interface ChangeOrder {
  chNo: string; subNo: string; customer: string; contractNo: string;
  type: ChangeType; from: string; to: string;        // 变更前 → 变更后（如 100M → 200M）
  monthlyFeeAfter: number;                            // 生效后月租（周期费计算基准）
  effective: string;                                  // 生效账期（如 2026-12）
  costEst: CostEst;                                   // 增量成本测算（系统自动推导）
  reason: string; status: ChangeStatus; createdAt: string;
  reviewer?: string; reviewNote?: string;
}

// 测算单价口径（A5 策略中心「变更测算单价」组实时读取；勿硬编码）

const bwOf = (s: string) => { const m = s.match(/([\d.]+)\s*(G)?M/); return m ? parseFloat(m[1]) * (m[2] ? 1000 : 1) : 0; };

function estimateChange(sub: { line: string; monthlyFee: number }, type: ChangeType, to: string, feeAfter: number): CostEst {
  if (type === "带宽升级" || type === "带宽降级") {
    const oldM = bwOf(sub.line), newM = bwOf(to);
    // 正式版（2026-11-09）：从产品组成推导——同一出口池下新带宽边际成本 − 原带宽边际成本；
    // 识别不出产品类型 / 无出口池档案时回退 A5 单价兜底
    const pt = ptypeOfLine(sub.line) ?? ptypeOfLine(to);
    const pool = pt ? poolMarginal(pt, Math.max(oldM, newM)) : null;
    if (pt && pool) {
      const after = poolMarginal(pt, newM)!, before = poolMarginal(pt, oldM)!;
      const delta = after.cost - before.cost;
      return { items: [{ name: `出口带宽切分 ${oldM}M → ${newM}M`, deltaMonthly: delta }], deltaMonthly: delta, onceOff: 0,
        basis: `口径：产品组成自动推导——${pt} 出口池边际成本差（池月租 ${pool.poolCost.toLocaleString()} 元，${newM}M 边际 ${after.cost.toLocaleString()} − ${oldM}M 边际 ${before.cost.toLocaleString()}）；月结以实际账单为准` };
    }
    const UNIT_EXIT_PER_M = cfgNum("cost.exitPerM");
    const delta = Math.round((newM - oldM) * UNIT_EXIT_PER_M);
    return { items: [{ name: `出口带宽切分 ${oldM}M → ${newM}M`, deltaMonthly: delta }], deltaMonthly: delta, onceOff: 0,
      basis: `口径：出口带宽成本 ${UNIT_EXIT_PER_M} 元/M/月（A5 策略中心兜底单价，未识别产品组成）` };
  }
  if (type === "增加 IP" || type === "减少 IP") {
    const n = +(to.match(/(\d+)/)?.[1] ?? 0);
    const UNIT_IP = cfgNum("cost.ipUnit");
    const delta = (type === "增加 IP" ? n : -n) * UNIT_IP;
    return { items: [{ name: `${type === "增加 IP" ? "新增" : "释放"}绑定 IP ${n} 个`, deltaMonthly: delta }], deltaMonthly: delta, onceOff: 0,
      basis: `口径：IP 地址 ${UNIT_IP} 元/个·月（A5 策略中心「变更测算单价」，实时读取）` };
  }
  if (type === "套餐变更") {
    // 正式版（2026-11-09）：目标套餐组成月成本 − 当前套餐组成月成本（同带宽/IP 口径下比较，差在结构上）
    const fromPt = ptypeOfLine(sub.line), toPt = ptypeOfLine(to);
    const bw = Math.max(bwOf(sub.line), bwOf(to));
    const ip = Math.max(ipOfLine(sub.line), ipOfLine(to));
    if (fromPt && toPt && fromPt !== toPt) {
      const from = bomMonthlyCost(fromPt, bw, ip), to2 = bomMonthlyCost(toPt, bw, ip);
      if (from.resolved && to2.resolved) {
        const delta = to2.total - from.total;
        const names = [...new Set([...from.lines.map((l) => l.name), ...to2.lines.map((l) => l.name)])];
        const items = names.map((n) => {
          const a = from.lines.find((l) => l.name === n)?.monthly ?? 0;
          const b = to2.lines.find((l) => l.name === n)?.monthly ?? 0;
          return { name: `${n}（${fromPt} ${a.toLocaleString()} → ${toPt} ${b.toLocaleString()}）`, deltaMonthly: b - a };
        }).filter((i) => i.deltaMonthly !== 0);
        return { items: items.length ? items : [{ name: `套餐结构变化（组成成本一致，月租差 ${(feeAfter - sub.monthlyFee) >= 0 ? "+" : ""}${(feeAfter - sub.monthlyFee).toLocaleString("zh-CN")} 元/月）`, deltaMonthly: 0 }], deltaMonthly: delta, onceOff: 0,
          basis: `口径：产品组成自动推导——${toPt} 组成月成本 ${to2.total.toLocaleString()} 元 − ${fromPt} 组成月成本 ${from.total.toLocaleString()} 元（出口池边际计价 + 基础线路档案 + IP 档案单价）；月结以实际账单为准` };
      }
    }
    // 兜底：成本率估算（无法识别产品类型组成时）
    const feeDelta = feeAfter - sub.monthlyFee;
    const ratio = cfgRate("cost.planRatio");
    const delta = Math.round(feeDelta * ratio);
    return { items: [{ name: `套餐结构变化（月租差 ${feeDelta >= 0 ? "+" : ""}${feeDelta.toLocaleString("zh-CN")} 元/月）`, deltaMonthly: delta }], deltaMonthly: delta, onceOff: 0,
      basis: `口径：成本率 ${ratio * 100}% 估算（未识别产品组成，A5 兜底）` };
  }
  const MOVE_ONCE_FEE = cfgNum("cost.installFee");
  return { items: [{ name: "新址安装调测（一次性）", deltaMonthly: 0, onceOff: MOVE_ONCE_FEE }], deltaMonthly: 0, onceOff: MOVE_ONCE_FEE,
    basis: `口径：安装调测服务 ${MOVE_ONCE_FEE} 元/次（A5 策略中心「变更测算单价」，实时读取）` };
}
// ---------- P06 退订单 + 资源回收单 ----------
export type TerminateReason = "客户申请" | "合同到期" | "欠费坏账" | "其他";
export interface TerminateOrder {
  tmNo: string; subNo: string; customer: string; contractNo: string;
  reason: TerminateReason; reasonText?: string;
  effectivePeriod: string;                            // 退订生效账期：该账期起停止出账
  penalty: number;                                    // 违约金申请金额（一事一议；系统仅给参考试算，审批可改）
  penaltyBasis?: string;                              // 参考口径说明
  penaltyInvNo?: string;                              // 违约金账单号（按审批确定金额生成，走正常审核 → 发出 → 应收）
  status: "审批中" | "退订生效" | "已驳回";
  createdAt: string; reviewer?: string; recoverNo?: string;
}

// 违约金口径：一事一议，无固定公式。系统仅按以下假设给出【参考试算】，最终金额由退订审批确定，账单按审批金额收取。
// 参考比例从 A5 策略中心「违约金参考」实时读取（剩余未履行账期月租合计 × 参考比例），仅供参考
const monthsBetween = (fromPeriod: string, end: string) => {
  const [sy, sm] = fromPeriod.split("-").map(Number), [ey, em] = end.slice(0, 7).split("-").map(Number);
  return Math.max(0, (ey - sy) * 12 + (em - sm) + 1);
};
/** 违约金参考试算（弹窗预填用；非定价依据） */
export function penaltyReference(subNo: string, reason: TerminateReason, effectivePeriod: string): { penalty: number; basis: string } {
  if (reason === "合同到期") return { penalty: 0, basis: "合同正常到期退订，通常无违约金（仍可按实际约定填写）" };
  const sub = SUBSCRIPTIONS.find((s) => s.subNo === subNo);
  const contract = CONTRACTS.find((c) => c.id === sub?.contractNo);
  if (!sub || !contract) return { penalty: 0, basis: "未找到订阅或合同，无法参考试算" };
  const months = monthsBetween(effectivePeriod, contract.end);
  const rate = cfgRate("penalty.refRate");
  const penalty = Math.round(months * sub.monthlyFee * rate);
  const basis = `参考试算（非定价依据）：剩余未履行 ${months} 期 × 月租 ${sub.monthlyFee.toLocaleString("zh-CN")} 元 × ${rate * 100}%` +
    (reason === "欠费坏账" ? "；欠费坏账的违约金通常并入坏账处理" : "") + "；最终金额由审批确定，以账单形式收取";
  return { penalty, basis };
}
export type RecoverAction = "库存回库" | "地址释放" | "配置清除";
export interface RecoverOrder {
  rcNo: string; tmNo: string; subNo: string; customer: string;
  items: { name: string; action: RecoverAction }[];
  status: "待执行" | "已完工"; createdAt: string; executedAt?: string; note?: string;
}

// ---------- 预置数据 ----------
export const CHANGE_ORDERS: ChangeOrder[] = [
  { chNo: "CH-2026-006", subNo: "SUB-2026-0305", customer: "中海贸易", contractNo: "HT-2026-023",
    type: "带宽升级", from: "单线 200M", to: "单线 500M", monthlyFeeAfter: 68000, effective: "2026-12",
    costEst: { items: [{ name: "出口带宽切分 200M → 500M", deltaMonthly: 12000 }], deltaMonthly: 12000, onceOff: 0,
      basis: "口径：出口带宽成本 40 元/M/月（资源目录单价，可配）" },
    reason: "客户电商大促期间流量不足，申请升带宽", status: "审批中", createdAt: "2026-11-02 14:10" },
  { chNo: "CH-2026-004", subNo: "SUB-2026-0330", customer: "博彦软件", contractNo: "HT-2026-0309",
    type: "增加 IP", from: "绑定 IP 8 个", to: "绑定 IP 16 个", monthlyFeeAfter: 10700, effective: "2026-11",
    costEst: { items: [{ name: "新增绑定 IP 8 个", deltaMonthly: 400 }], deltaMonthly: 400, onceOff: 0,
      basis: "口径：IP 地址 50 元/个·月（资源目录单价，可配）" },
    reason: "新增业务系统需要更多公网地址", status: "已生效", createdAt: "2026-10-18 09:30", reviewer: "业务支撑-许晟熙" },
  { chNo: "CH-2026-005", subNo: "SUB-2026-0280", customer: "凯瑞传媒", contractNo: "HT-2026-020",
    type: "套餐变更", from: "国内精品网 100M", to: "BGP 三网互通 100M", monthlyFeeAfter: 10800, effective: "2026-11",
    costEst: { items: [{ name: "套餐结构变化（月租差 +2,300 元/月）", deltaMonthly: 1426 }], deltaMonthly: 1426, onceOff: 0,
      basis: "口径：产品组成自动推导（出口池边际计价 + 基础线路档案 + IP 档案单价）；月结以实际账单为准" },
    reason: "客户业务从单向精品网扩展到多网互通，整体切换套餐", status: "已生效", createdAt: "2026-10-25 11:20", reviewer: "业务支撑-许晟熙" },
];
export const TERMINATE_ORDERS: TerminateOrder[] = [
  { tmNo: "TM-2026-002", subNo: "SUB-2026-0117", customer: "展鹏教育", contractNo: "HT-2026-0302",
    reason: "合同到期", effectivePeriod: "2026-11", status: "退订生效", createdAt: "2026-10-20 10:15",
    reviewer: "业务支撑-许晟熙", recoverNo: "RC-2026-002",
    penalty: 0, penaltyBasis: "合同正常到期退订，无违约金" },
  { tmNo: "TM-2026-003", subNo: "SUB-2026-0355", customer: "正大物流", contractNo: "HT-2026-015",
    reason: "客户申请", effectivePeriod: "2026-12", status: "审批中", createdAt: "2026-11-01 16:40",
    penalty: 16800, penaltyBasis: "参考试算（非定价依据）：剩余未履行 10 期 × 月租 5,600 元 × 30%；最终金额由审批确定，以账单形式收取" },
];
export const RECOVER_ORDERS: RecoverOrder[] = [
  { rcNo: "RC-2026-002", tmNo: "TM-2026-002", subNo: "SUB-2026-0117", customer: "展鹏教育",
    items: [{ name: "华为 AR6121 CPE ×1", action: "库存回库" }, { name: "绑定 IP 4 个（58.41 段）", action: "地址释放" }, { name: "出口带宽 50M 切分", action: "配置清除" }],
    status: "待执行", createdAt: "2026-10-28 10:20" },
];

// ---------- 轻量 store ----------
let version = 0;
const listeners = new Set<() => void>();
const bump = () => { version += 1; listeners.forEach((fn) => fn()); };
export function useLifecycle(): number {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => version,
  );
}
export const getChanges = () => CHANGE_ORDERS;
export const getTerminates = () => TERMINATE_ORDERS;
export const getRecovers = () => RECOVER_ORDERS;

let chSeq = 7, tmSeq = 4, rcSeq = 3;
const now = () => new Date().toISOString().slice(0, 16).replace("T", " ");

// P05-1/2：变更申请（仅「在网」订阅可申请；欠停需先复机）
export function submitChange(data: Omit<ChangeOrder, "chNo" | "status" | "createdAt" | "costEst">): string | null {
  const sub = SUBSCRIPTIONS.find((s) => s.subNo === data.subNo);
  if (!sub) return "订阅不存在";
  if (sub.status === "退订") return "该订阅已退订，不能发起变更";
  if (sub.status === "欠停") return "订阅处于欠停状态，须先复机（收款核销自动触发）再变更";
  if (!(data.monthlyFeeAfter > 0)) return "请填写生效后月租";
  CHANGE_ORDERS.unshift({ ...data, costEst: estimateChange(sub, data.type, data.to, data.monthlyFeeAfter), chNo: `CH-2026-${String(chSeq++).padStart(3, "0")}`, status: "审批中", createdAt: now() });
  bump();
  return null;
}
// P05-3/4：审批通过 → 生效：订阅行与月租即时更新，次账期起按新价出账（当期仍按原价）
export function approveChange(chNo: string): string | null {
  const o = CHANGE_ORDERS.find((x) => x.chNo === chNo);
  if (!o || o.status !== "审批中") return "变更单不存在或不在审批中";
  o.status = "已生效"; o.reviewer = "业务支撑-许晟熙";
  updateSubscription(o.subNo, { line: o.to, monthlyFee: o.monthlyFeeAfter });
  bump();
  return null;
}
export function rejectChange(chNo: string, note: string): string | null {
  const o = CHANGE_ORDERS.find((x) => x.chNo === chNo);
  if (!o || o.status !== "审批中") return "变更单不存在或不在审批中";
  if (!note.trim()) return "驳回必须填写原因";
  o.status = "已驳回"; o.reviewer = "业务支撑-许晟熙"; o.reviewNote = note;
  bump();
  return null;
}

// P06-1/2：退订申请（在网/欠停均可；生效账期起停止出账；违约金一事一议，由申请人填申请金额、审批定最终金额）
export function submitTerminate(data: Omit<TerminateOrder, "tmNo" | "status" | "createdAt" | "penaltyInvNo">): string | null {
  const sub = SUBSCRIPTIONS.find((s) => s.subNo === data.subNo);
  if (!sub) return "订阅不存在";
  if (sub.status === "退订") return "该订阅已退订";
  if (data.reason === "其他" && !data.reasonText?.trim()) return "退订原因=其他时必须填写说明";
  if (!(data.penalty >= 0)) return "违约金申请金额不能为负";
  TERMINATE_ORDERS.unshift({ ...data, tmNo: `TM-2026-${String(tmSeq++).padStart(3, "0")}`, status: "审批中", createdAt: now() });
  bump();
  return null;
}
// P06-3/4：审批通过 → 退订生效（finalPenalty = 审批确定的违约金金额，默认按申请金额）；违约金>0 生成账单走正常出账流程；生成资源回收单
export function approveTerminate(tmNo: string, finalPenalty?: number): string | null {
  const o = TERMINATE_ORDERS.find((x) => x.tmNo === tmNo);
  if (!o || o.status !== "审批中") return "退订单不存在或不在审批中";
  const penalty = finalPenalty ?? o.penalty;
  if (!(penalty >= 0)) return "违约金金额不能为负";
  o.status = "退订生效"; o.reviewer = "业务支撑-许晟熙"; o.penalty = penalty;
  updateSubscription(o.subNo, { status: "退订" });
  if (penalty > 0) {
    o.penaltyInvNo = addManualBill({
      customer: o.customer, contractNo: o.contractNo, period: o.effectivePeriod,
      items: [{ name: `${o.tmNo} 提前退订违约金`, amount: penalty, feeType: "一次性费用" }],
    });
  }
  const sub = SUBSCRIPTIONS.find((s) => s.subNo === o.subNo);
  const rc: RecoverOrder = {
    rcNo: `RC-2026-${String(rcSeq++).padStart(3, "0")}`, tmNo: o.tmNo, subNo: o.subNo, customer: o.customer,
    items: [
      { name: `CPE 设备（${sub?.line ?? "本订阅"}）×1`, action: "库存回库" },
      { name: `绑定 IP 地址（${sub?.line ?? "本订阅"}）`, action: "地址释放" },
      { name: `出口带宽切分与端口配置`, action: "配置清除" },
    ],
    status: "待执行", createdAt: now(),
  };
  RECOVER_ORDERS.unshift(rc);
  o.recoverNo = rc.rcNo;
  bump();
  return null;
}
export function rejectTerminate(tmNo: string, note: string): string | null {
  const o = TERMINATE_ORDERS.find((x) => x.tmNo === tmNo);
  if (!o || o.status !== "审批中") return "退订单不存在或不在审批中";
  if (!note.trim()) return "驳回必须填写原因";
  o.status = "已驳回"; o.reviewer = "业务支撑-许晟熙";
  bump();
  return null;
}
// P06-5：回收执行（CPE 回库 → R4 库存 +1；地址释放 / 配置清除为网络侧动作，留痕）
export function executeRecover(rcNo: string, note: string): string | null {
  const r = RECOVER_ORDERS.find((x) => x.rcNo === rcNo);
  if (!r || r.status !== "待执行") return "回收单不存在或已完工";
  const cpe = r.items.find((i) => i.action === "库存回库");
  if (cpe) stockIn("EQ-AR6121", 1, 0, r.tmNo, "回收入库");
  r.status = "已完工"; r.executedAt = now(); r.note = note || undefined;
  bump();
  return null;
}

// 口径说明（页面底部展示）
export const LIFECYCLE_RULES = [
  "变更：仅「在网」订阅可发起；欠停须先复机（收款足额核销自动触发）；审批通过后订阅行与月租即时更新，生效账期起按新价出账，当期仍按原价",
  "变更测算（2026-11-09 升正式版）：提交时按变更类型从产品组成自动推导增量成本——套餐变更 = 目标类型组成月成本 − 当前类型组成月成本（出口池边际计价 + 基础线路档案 + IP 档案单价）；带宽升降 = 同一出口池新/原带宽边际成本差；识别不出产品类型组成时回退 A5 单价 / 成本率兜底（basis 中明示）。只推导直接·周期性条目，一次性条目与间接费用不进测算；月结仍以实际账单为准，测算差异留待差异比对",
  "退订：审批通过后订阅=退订，自生效账期起账期扫描跳过出账；生效账期之前的欠费账单不受影响，照常催收",
  "退订违约金：一事一议，无固定计算规则。系统仅给出参考试算（剩余未履行账期月租合计 × 参考比例），申请人填申请金额，最终金额由退订审批确定；按审批金额生成客户账单（一次性费用）走正常 审核 → 发出 → 应收 流程收取",
  "资源回收：退订生效自动生成回收单（CPE 回库 → R4 库存 +1；IP 地址释放回地址池；出口带宽切分与端口配置清除，网络侧执行留痕）",
  "坏账联动：坏账审批通过 → 订阅强制进入退订流程（系统自动发起，退订原因=欠费坏账），见欠费与坏账页",
];
