// 消息通知中心：业务事件 → 站内通知（持久化，已读未读可流转）
// 与 NoticeBell 的「实时待办」互补：待办 = 当前台账里还挂着的事；通知 = 发生过的事件留痕（谁、何时、做了什么）
// 事件源在各 data 层写函数里埋点（提交/审批/开票/回款/欠停/入库等），业务动作发生时自动发出
import { useSyncExternalStore } from "react";
import { persistable } from "@/data/persist";
import { demoNow } from "@/data/settings";

export type NoticeLevel = "red" | "orange" | "blue" | "green";
export interface Notice {
  id: string;             // NT-2026-xxxx
  at: string;             // 触发时间（演示口径 DEMO_TODAY + 实际时分）
  level: NoticeLevel;     // red=紧急 orange=预警 blue=普通 green=成功
  group: string;          // 分类：审批 / 财务 / 交付 / 采购 / 系统
  title: string;
  text: string;
  to: string;             // 点击跳转
  read: boolean;
  roles?: string[];       // 目标角色（空 = 全员可见）
}

// ---------- 预置通知（演示历史事件） ----------
const notices: Notice[] = persistable("notices", () => [
  { id: "NT-2026-0001", at: "2026-11-03 09:12", level: "green", group: "财务", title: "回款到账", text: "云启数据科技 回款 ¥50,000.00（银行转账 · INV-2026-301）", to: "/finance?tab=pay", read: false },
  { id: "NT-2026-0002", at: "2026-11-03 10:05", level: "orange", group: "审批", title: "核算单待审批", text: "核算单 CB-2026-028（恒信证券）已提交，待财务主管审批", to: "/approval?id=CB-2026-028", read: false },
  { id: "NT-2026-0003", at: "2026-11-03 14:40", level: "red", group: "财务", title: "账单逾期迁移", text: "逾期扫描：凯瑞传媒 INV-2026-306 逾期 45 天，迁入「催收跟进」", to: "/finance?tab=collect", read: true },
  { id: "NT-2026-0004", at: "2026-11-05 11:20", level: "blue", group: "采购", title: "采购单已下单", text: "采购单 PO-2026-031（上海电信 · 2 条线路）审批通过，已通知供应商", to: "/purchase/orders/PO-2026-031", read: true },
  { id: "NT-2026-0005", at: "2026-11-06 16:02", level: "green", group: "财务", title: "开票完成", text: "恒信证券 INV-2026-302 专用发票已开具并回填发票号", to: "/finance?tab=invoice", read: true },
  { id: "NT-2026-0006", at: "2026-11-09 09:31", level: "blue", group: "系统", title: "审批流配置变更", text: "「核算单审批」流程新增节点：风控合规复核（可配置停用）", to: "/system/approval", read: true },
]);

let version = 0;
const listeners = new Set<() => void>();
const bump = () => {
  version += 1;
  listeners.forEach((fn) => fn());
};

export const getNotices = () => notices;
export const useNotices = (): number =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version
  );

export const unreadCount = () => notices.filter((n) => !n.read).length;

/** 业务事件埋点：各 data 层写函数在动作完成时调用（原地 unshift，快照引用稳定） */
export function notify(patch: Omit<Notice, "id" | "at" | "read"> & { at?: string }) {
  const seq = notices.length + 1;
  notices.unshift({ ...patch, id: `NT-2026-${String(seq).padStart(4, "0")}`, at: patch.at ?? demoNow(), read: false });
  bump();
  return notices[0].id;
}

export function markRead(id: string) {
  const n = notices.find((x) => x.id === id);
  if (n && !n.read) {
    n.read = true;
    bump();
  }
}

export function markAllRead() {
  notices.forEach((n) => {
    n.read = true;
  });
  bump();
}
