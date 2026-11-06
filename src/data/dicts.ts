// 计价字典：跨资源共用的计价规则（价格规则下沉后，条目库只保留这类「不带具体资源」的规则）
// 当前收录：工时费率（开通实施 / 安装调测 / 运维投入共用一条费率线）。
// 具体资源的价格（月租 / 单价 / 采购价）挂在 R1~R4 资源档案与采购合同上，不进本字典。
import { useSyncExternalStore } from "react";

export interface EngineerRate {
  role: string;            // 岗位 / 级别
  rate: number;            // 费率（元/人天）
  effect: string;          // 生效日期
  status: "启用" | "停用";
  remark?: string;
}

export const ENGINEER_RATES: EngineerRate[] = [
  { role: "网络工程师（实施 / 运维）", rate: 800, effect: "2026-01-01", status: "启用", remark: "开通实施与安装调测共用" },
  { role: "高级工程师（方案 / 割接）", rate: 1200, effect: "2026-01-01", status: "启用", remark: "重大割接、疑难方案评审" },
];

let version = 0;
const listeners = new Set<() => void>();
const bump = () => {
  version += 1;
  listeners.forEach((fn) => fn());
};
/** 组件订阅字典变更（返回版本号触发重渲染，数据用 getRates() 读） */
export function useRates(): number {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version,
  );
}
export const getRates = () => ENGINEER_RATES;

/** 当前生效费率（条目库试算 / 核算填报取数）：取第一条启用记录，字典为空返回 null */
export const currentRate = (): EngineerRate | null =>
  ENGINEER_RATES.find((r) => r.status === "启用") ?? null;

export function saveRate(idx: number, patch: Partial<EngineerRate>) {
  if (ENGINEER_RATES[idx]) {
    Object.assign(ENGINEER_RATES[idx], patch);
    bump();
  }
}
export function addRate(rate: EngineerRate) {
  ENGINEER_RATES.push(rate);
  bump();
}
