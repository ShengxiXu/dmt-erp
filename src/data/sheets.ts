// 成本核算单台账 + 审批流配置（演示数据）
import { persistable } from "@/data/persist";

export type SheetStatus = "待填写" | "待对方提交" | "审批中" | "已通过" | "已驳回" | "变更中";

export interface CostSheet {
  id: string;
  customer: string;
  contract: string;
  lines: number;
  monthlyCost: number;
  contractValue: number;
  margin: number;
  opsDone: boolean;
  techDone: boolean;
  status: SheetStatus;
  curNode?: string;
  updated: string;
  /** 含「手工填入 · 待补关联」条目的数量（签订采购合同 / 资源建档后补关联） */
  pendingLink?: number;
}

export const SHEETS: CostSheet[] = persistable("sheets", () => [
  { id: "CE-2026-1008", customer: "上海某科技公司", contract: "HT-2026-0341 · 24 个月", lines: 3, monthlyCost: 12316, contractValue: 35000, margin: 64.8, opsDone: true, techDone: true, status: "审批中", curNode: "财务主管审批", updated: "2026-10-22 10:48", pendingLink: 1 },
  { id: "CE-2026-1007", customer: "恒信证券", contract: "HT-2026-0338 · 12 个月", lines: 2, monthlyCost: 32100, contractValue: 58000, margin: 44.7, opsDone: true, techDone: true, status: "变更中", curNode: "核算变更复核（补关联价差，P01-8）", updated: "2026-11-02 14:20", pendingLink: 1 },
  { id: "CE-2026-1006", customer: "澜石金融", contract: "HT-2026-0335 · 36 个月", lines: 4, monthlyCost: 86400, contractValue: 152000, margin: 43.2, opsDone: true, techDone: false, status: "待对方提交", curNode: undefined, updated: "2026-10-21 11:20" },
  { id: "CE-2026-1005", customer: "中海贸易", contract: "HT-2026-023 · 12 个月", lines: 1, monthlyCost: 9800, contractValue: 15000, margin: 34.7, opsDone: true, techDone: true, status: "已通过", curNode: undefined, updated: "2026-10-20 15:44" },
  { id: "CE-2026-1004", customer: "跃游网络", contract: "HT-2026-0329 · 12 个月", lines: 2, monthlyCost: 6150, contractValue: 8000, margin: 23.1, opsDone: true, techDone: true, status: "已驳回", curNode: undefined, updated: "2026-10-19 17:31" },
  { id: "CE-2026-1003", customer: "正大物流", contract: "HT-2026-0326 · 24 个月", lines: 1, monthlyCost: 4200, contractValue: 6500, margin: 35.4, opsDone: false, techDone: false, status: "待填写", curNode: undefined, updated: "2026-10-18 09:12" },
]);

// ---------- 审批流配置（业务可自配：节点 + 审批人规则 + 条件 + 嵌入环节） ----------
export interface ApprovalNode {
  key: string;
  name: string;
  approver: string;          // 审批人规则
  condition: string;         // 生效条件（金额档等）
  enabled: boolean;
}

export interface ApprovalFlow {
  embedPoint: string;        // 嵌入环节
  nodes: ApprovalNode[];
}

export const DEFAULT_FLOWS: Record<string, ApprovalFlow> = {
  "成本核算审批": {
    embedPoint: "P01-5 成本核算填报完成 → 提交后",
    nodes: [
      { key: "n1", name: "业务支撑部负责人复核", approver: "业务支撑部负责人（部门角色）", condition: "总是", enabled: true },
      { key: "n2", name: "技术部负责人复核", approver: "技术部负责人（部门角色）", condition: "总是", enabled: true },
      { key: "n3", name: "财务主管审批", approver: "财务主管（角色）", condition: "总是", enabled: true },
      { key: "n4", name: "财务总监加签", approver: "财务总监（角色）", condition: "月成本合计 > 50,000 元", enabled: true },
      { key: "n5", name: "总经理审批", approver: "总经理（角色）", condition: "月成本合计 > 200,000 元", enabled: false },
    ],
  },
};

/** 可嵌入审批流的业务环节（二期开放更多；一期预置两个模板） */
export const EMBED_POINTS = [
  "P01-5 成本核算填报完成 → 提交后",
  "P02-3 资源分配申请 → 提交后",
  "P03-4 账单发出 → 前",
  "P05-1 订阅变更申请 → 提交后",
  "P06-1 退订申请 → 提交后",
];

// ---------- 审批演示：核算单条目汇总（CE-2026-1008） ----------
// 铁律一：每条核算行金额必须可溯源——来源单据类型 + 来源单据 ID（《制造业口径》第七章）
export type SrcType = "库存出库单" | "账本耗用单" | "工单工时单" | "手工暂填";
export interface SheetEntry { dept: "业务支撑部" | "技术部"; line: string; item: string; amount: number; note: string; srcType: SrcType; srcId: string; /** 手工填入且尚未关联真实档案（采购合同/资源），签订后补关联 */ pendingLink?: boolean }

export const SHEET_ENTRIES: SheetEntry[] = persistable("sheetEntries", () => [
  { dept: "业务支撑部", line: "L1 · BGP 三网互通 50M", item: "基础线路租用费", amount: 1000, note: "B-001 电信 CN2 GIA 整线月租 1,000 元（单客户专用）", srcType: "账本耗用单", srcId: "HY-2026-1013" },
  { dept: "业务支撑部", line: "L1 · BGP 三网互通 50M", item: "出口带宽租用费（BGP 三网出口池）", amount: 3424, note: "BGP 三网出口池：113,000÷(1,600+50)×50 = 3,424（三出口月租与已售合并为一个池，边际计价）", srcType: "账本耗用单", srcId: "HY-2026-1014" },
  { dept: "业务支撑部", line: "L2 · 数据专线 OTN（上海—北京）", item: "基础线路租用费（手工填入）", amount: 6000, note: "新运营商上海↔北京线路尚未签约：手工填入估算单价，签订采购合同后补关联，价差触发核算变更复核", srcType: "手工暂填", srcId: "—（待补关联）", pendingLink: true },
  { dept: "业务支撑部", line: "L2 · 数据专线 OTN（上海—北京）", item: "CPE 采购成本（按单采购）", amount: 8600, note: "PO-2026-031：2 台 × 4,300 元", srcType: "手工暂填", srcId: "PO-2026-031（在途到货后转出库单）" },
  { dept: "业务支撑部", line: "L1+L2", item: "外勤上门差旅费", amount: 250, note: "北京现场交付", srcType: "手工暂填", srcId: "—（票据实报）" },
  { dept: "技术部", line: "L1 · BGP 三网互通 50M", item: "IP 地址使用费", amount: 156, note: "I-101 绑定 C 段分配 4 个 × 39 元", srcType: "账本耗用单", srcId: "HY-2026-1016" },
  { dept: "技术部", line: "L1+L2", item: "网络开通实施费", amount: 3200, note: "2 人 × 2 天 × 800 元", srcType: "工单工时单", srcId: "WB-2026-0341" },
  { dept: "技术部", line: "L1+L2", item: "安装调测费", amount: 800, note: "1 人天 × 800 元", srcType: "工单工时单", srcId: "WB-2026-0342" },
  { dept: "技术部", line: "L1", item: "上联端口使用费", amount: 80, note: "10G 端口 8,000 × 100M÷10,000M", srcType: "账本耗用单", srcId: "HY-2026-1017" },
  { dept: "技术部", line: "L1", item: "BGP 平台运行维护费", amount: 1250, note: "600,000÷12 × 50÷2,000", srcType: "手工暂填", srcId: "月结分配后由 alloc_run 回填" },
  { dept: "技术部", line: "L1+L2", item: "光模块及板卡材料费", amount: 800, note: "2 个 × 400 元", srcType: "库存出库单", srcId: "OUT-2026-011" },
]);

export const fmt = (n: number) => n.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
