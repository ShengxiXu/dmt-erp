// 客户档案（主数据）：特批申请 / 合同流程只选择客户，不手动录入
import { useSyncExternalStore } from "react";

export interface Customer {
  id: string; name: string;
  creditCode?: string;   // 统一社会信用代码
  invoiceTitle?: string; // 开票抬头（默认=客户名称，不一致时维护，开票申请自动带出）
  taxNo?: string;        // 开票税号（专票必填）
  level?: "A" | "B" | "C"; // 客户等级
  industry: string; source?: string; // 客户来源
  address?: string;
  contact: string; contactTitle?: string; phone: string; email?: string;
  sales: string; remark?: string;
  status: "合作中" | "潜在"; createdAt: string;
}

// ---------- 商机（Opportunity）：客户与其下多个商机之间的层级 ----------
// 一个客户可有多个商机；特批申请必须挂在具体商机上（而非直接挂客户），
// 形成 客户 → 商机 → 特批 → 合同 的完整链路；合同生效后商机自动「赢单」关闭并转生成订单。
export type OppStage = "跟进中" | "已报价" | "赢单" | "输单";
export const OPP_STAGES: OppStage[] = ["跟进中", "已报价", "赢单", "输单"];
export const OPP_SOURCES = ["老客户续扩", "转介绍", "市场活动", "招标", "陌拜", "其他"];

export interface OppProduct {
  cat: string;           // 意向产品类别（来自产品定义）
  ptype: string;         // 意向产品类型（来自产品定义，不可自由输入）
}

export interface Opportunity {
  id: string;            // CJ-2026-xxx 商机编号
  customerId: string;    // 归属客户（CU-xxx）
  name: string;          // 商机名称（如「二期算力扩容」）
  products: OppProduct[]; // 意向产品（可多个，来自产品定义）
  expectAmount: number;  // 预计合同金额（元，赢单口径；非月租）
  expectMonths?: number; // 预计合同期（月），用于推算月均合同额
  expectedCloseAt?: string; // 预计成交日期
  stage: OppStage;
  source?: string;       // 来源渠道
  sales: string;
  remark?: string;
  createdAt: string;
}

// ---------- 轻量 store：商机跨页面共享（商机管理 / 客户档案 / 特批申请 / 合同） ----------
let opps: Opportunity[] = [
  { id: "CJ-2026-001", customerId: "CU-001", name: "AI 算力一期 · AI 专线扩容", products: [{ cat: "ISP 互联网接入", ptype: "AI 专线" }], expectAmount: 2304000, expectMonths: 24, expectedCloseAt: "2026-10-20", stage: "赢单", source: "老客户续扩", sales: "张弛", createdAt: "2026-09-02", remark: "合同 HT-2026-021 签署中，生效后自动关闭" },
  { id: "CJ-2026-002", customerId: "CU-001", name: "二期算力扩容 · BGP 三网互通", products: [{ cat: "ISP 互联网接入", ptype: "BGP 三网互通" }, { cat: "ISP 互联网接入", ptype: "AI 专线" }], expectAmount: 2112000, expectMonths: 24, expectedCloseAt: "2026-11-15", stage: "已报价", source: "老客户续扩", sales: "张弛", createdAt: "2026-10-10" },
  { id: "CJ-2026-003", customerId: "CU-002", name: "行情加速专线项目", products: [{ cat: "ISP 互联网接入", ptype: "国内精品网" }], expectAmount: 252000, expectMonths: 12, expectedCloseAt: "2026-11-30", stage: "已报价", source: "转介绍", sales: "张弛", createdAt: "2026-10-15" },
  { id: "CJ-2026-004", customerId: "CU-006", name: "总部带宽升级项目", products: [{ cat: "ISP 互联网接入", ptype: "BGP 三网互通" }], expectAmount: 360000, expectMonths: 12, expectedCloseAt: "2026-11-01", stage: "赢单", source: "老客户续扩", sales: "李骁", createdAt: "2026-10-08", remark: "特批 SA-2026-013 被驳回，重新谈判中" },
  { id: "CJ-2026-005", customerId: "CU-007", name: "临港算力 10G AI 专线", products: [{ cat: "ISP 互联网接入", ptype: "AI 专线" }, { cat: "IDC", ptype: "机柜托管" }], expectAmount: 5400000, expectMonths: 36, expectedCloseAt: "2026-12-20", stage: "已报价", source: "市场活动", sales: "张弛", createdAt: "2026-10-25" },
  { id: "CJ-2026-006", customerId: "CU-005", name: "核心系统长账期专线项目", products: [{ cat: "数据专线", ptype: "OTN" }], expectAmount: 936000, expectMonths: 36, expectedCloseAt: "2026-12-31", stage: "跟进中", source: "招标", sales: "张弛", createdAt: "2026-10-20" },
];

let version = 0;
const listeners = new Set<() => void>();
const bump = () => {
  version += 1;
  listeners.forEach((fn) => fn());
};

export const getOpps = () => opps;
export const OPPS_OF = (customerId: string) => opps.filter((d) => d.customerId === customerId);
export const GET_OPP = (id: string) => opps.find((d) => d.id === id);

/** 组件订阅商机变更（返回版本号触发重渲染，数据用 getOpps() 读） */
export function useOpps(): number {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version
  );
}

export function addOpp(patch: Omit<Opportunity, "id" | "createdAt">) {
  const id = `CJ-2026-0${String(opps.length + 1).padStart(2, "0")}`;
  opps = [{ ...patch, id, createdAt: "2026-10-27" }, ...opps];
  bump();
  return id;
}
export function updateOpp(id: string, patch: Partial<Opportunity>) {
  opps = opps.map((d) => (d.id === id ? { ...d, ...patch } : d));
  bump();
}

// ---------- 客户档案预置 ----------
export const CUSTOMERS: Customer[] = [
  { id: "CU-001", name: "云启数据科技", creditCode: "91310115MA1K4XXX1A", level: "A", industry: "算力/数据中心", source: "市场活动", address: "上海市浦东新区张江高科技园区博云路 2 号", contact: "钱工", contactTitle: "运维总监", phone: "138-0166-xxxx", email: "qian@yunqi.example", sales: "张弛", status: "合作中", createdAt: "2025-11-02", remark: "算力头部客户，三年框架意向" },
  { id: "CU-002", name: "恒信证券", creditCode: "91310000MA1FLXXX2B", level: "A", industry: "金融", source: "转介绍", address: "上海市黄浦区南京东路 100 号", contact: "孙经理", contactTitle: "IT 部负责人", phone: "139-1770-xxxx", email: "sun@hengxin.example", sales: "张弛", status: "合作中", createdAt: "2025-12-18" },
  { id: "CU-003", name: "中海贸易", creditCode: "91310113MA1GCXXX3C", level: "B", industry: "贸易", source: "陌拜", address: "上海市宝山区逸仙路 3000 号", contact: "吴总", phone: "136-1188-xxxx", email: "wu@zhonghai.example", sales: "李骁", status: "合作中", createdAt: "2025-09-05" },
  { id: "CU-004", name: "跃游网络", creditCode: "91310114MA1HDXXX4D", level: "B", industry: "游戏", source: "市场活动", address: "上海市杨浦区创智天地 7 号楼", contact: "郑工", contactTitle: "网络架构师", phone: "137-9922-xxxx", email: "zheng@yueyou.example", sales: "李骁", status: "合作中", createdAt: "2026-03-11" },
  { id: "CU-005", name: "澜石金融", creditCode: "91310101MA1JEXXX5E", level: "A", industry: "金融", source: "招标", address: "上海市静安区南京西路 1601 号", contact: "冯总", contactTitle: "副总经理", phone: "135-6633-xxxx", email: "feng@lanshi.example", sales: "张弛", status: "合作中", createdAt: "2025-08-21", remark: "对账期敏感，长账期需特批" },
  { id: "CU-006", name: "凯瑞传媒", creditCode: "91310110MA1KFXXX6F", level: "B", industry: "传媒", source: "转介绍", address: "上海市长宁区延安西路 2299 号", contact: "褚经理", contactTitle: "行政经理", phone: "131-5544-xxxx", email: "chu@kairui.example", sales: "李骁", status: "合作中", createdAt: "2026-02-14" },
  { id: "CU-007", name: "智算中心（临港算力）", creditCode: "91310115MA1LGXXX7G", level: "A", industry: "算力/数据中心", source: "市场活动", address: "上海市浦东新区临港新片区环湖西二路 888 号", contact: "卫工", contactTitle: "基建负责人", phone: "186-2200-xxxx", email: "wei@zhisuan.example", sales: "张弛", status: "潜在", createdAt: "2026-10-25", remark: "10G 大带宽意向，需评估资源池容量" },
  { id: "CU-008", name: "正大物流", creditCode: "91310116MA1MHXXX8H", level: "C", industry: "物流", source: "陌拜", address: "上海市嘉定区曹安公路 3988 号", contact: "蒋总", phone: "189-3311-xxxx", email: "jiang@zhengda.example", sales: "李骁", status: "合作中", createdAt: "2025-10-09" },
  { id: "CU-009", name: "博彦软件", creditCode: "91310115MA1NJXXX9A", level: "B", industry: "软件/IT", source: "市场活动", address: "上海市浦东新区软件园三期 12 号", contact: "高经理", contactTitle: "IT 负责人", phone: "186-1180-xxxx", email: "gao@boyan.example", sales: "张弛", status: "合作中", createdAt: "2026-05-12" },
  { id: "CU-010", name: "某跨境电商", creditCode: "91310115MA1PKXXX0B", level: "B", industry: "电商", source: "转介绍", address: "上海市青浦区华新镇纪鹤公路 3688 号", contact: "林工", contactTitle: "运维负责人", phone: "137-0170-xxxx", email: "ops@kuajing.example", sales: "李骁", status: "合作中", createdAt: "2025-08-20" },
  { id: "CU-011", name: "上海某科技公司", creditCode: "91310115MA1QLXXX1C", level: "A", industry: "科技", source: "招标", address: "上海市徐汇区漕河泾开发区 55 号", contact: "孟总", contactTitle: "技术总监", phone: "139-6620-xxxx", email: "meng@moukeji.example", sales: "张弛", status: "合作中", createdAt: "2026-08-30" },
  { id: "CU-012", name: "展鹏教育", creditCode: "91310116MA1RMXXX2D", level: "C", industry: "教育", source: "陌拜", address: "上海市普陀区中山北路 3000 号", contact: "范老师", contactTitle: "信息中心主任", phone: "135-4420-xxxx", email: "fan@zhanpeng.example", sales: "李骁", status: "合作中", createdAt: "2025-11-05" },
];
