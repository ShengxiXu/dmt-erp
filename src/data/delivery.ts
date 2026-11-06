// P02 服务开通与资源分配 —— 工单台账
export type WoStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const STEP_NAMES = ["资源可用性检查", "资源分配申请", "资源分配审批", "资源绑定与扣减", "开通实施", "开通确认", "激活计费"];

export interface WorkOrder {
  id: string; sheetId: string; customer: string; contract: string;
  line: string;          // 开通对象（订单行）
  bwM: number;
  cat: string;           // 产品类别/类型（决定技术参数区字段集）
  step: WoStep;
  assignee: string;      // 运维负责人
  deadline: string;
  updated: string;
}

export const WORK_ORDERS: WorkOrder[] = [
  { id: "WO-2026-052", sheetId: "CE-2026-1008", customer: "上海某科技公司", contract: "HT-2026-0341 · 24 个月", line: "L1 · BGP 三网互通 50M（L2 专线并行开通）", bwM: 50, cat: "BGP 三网互通", step: 0, assignee: "孙工（运维）", deadline: "2026-10-28", updated: "2026-10-22 10:55" },
  { id: "WO-2026-051", sheetId: "CE-2026-1005", customer: "中海贸易", contract: "HT-2026-023 · 12 个月", line: "电信单线 200M（转售）", bwM: 200, cat: "运营商线路/裸光纤/设备转售", step: 1, assignee: "钱工（运维）", deadline: "2026-10-30", updated: "2026-10-21 09:40" },
  { id: "WO-2026-049", sheetId: "CE-2026-1002", customer: "凯瑞传媒", contract: "HT-2026-020 · 12 个月", line: "精品网通道 100M", bwM: 100, cat: "国内精品网", step: 4, assignee: "孙工（运维）", deadline: "2026-10-25", updated: "2026-10-22 08:10" },
  { id: "WO-2026-047", sheetId: "CE-2026-0998", customer: "博彦软件", contract: "HT-2026-0309 · 24 个月", line: "电信 CN2 切分 100M（转售）", bwM: 100, cat: "运营商线路/裸光纤/设备转售", step: 6, assignee: "孙工（运维）", deadline: "2026-10-20", updated: "2026-10-20 14:30" },
];

// ---------- P02-3 资源分配申请：类别化技术参数区（2026-10-22 设计） ----------
// 通用资源区（出口线路/IP/基础线路/CPE，所有类别一致）+ 类别专属技术参数区（下表）
export interface TechField { label: string; method: "text" | "enum" | "calc"; options?: string[]; unit?: string; placeholder?: string }
export interface TechGroup { title: string; fields: TechField[] }

export const TECH_PARAMS: Record<string, TechGroup[]> = {
  // 裁剪原则（2026-11-06）：技术口径定稿——所有 ISP 业务技术参数区只保留 VLAN ID
  //（唯一需要按单分配、运维排障要查的标识）。其余字段（双方 AS 号、会话数、宣告方式、
  // 限速/端口/光模块、SLA 承诺、A/Z 端点、保护等级、PON/波道/传送工程参数等）或由工程师
  // 按标准模板与现场勘查自行配置，或已载于合同/订单条款，不再进开通工单重复填写。
  // 例外：转售业务保留交付凭证三项（电路编号/验收单号/复测结果，账务核对依据）；
  // IDC 托管 / 云服务 / 安全服务非 ISP 线路业务，维持原参数集。
  // 类别键 = 产品类型名（products.ts），一一对应（2026-11-06 对齐）：
  // ISP 线路业务（AI 专线 / BGP 三网互通 / OPON / D-MAN / 国内精品网 / 国际精品网 / OTN / SD-WAN）
  // 技术参数按技术部口径只留 VLAN ID；「单线接入」非产品类型（一对一运营商线路仅存在于转售），已删除。
  "BGP 三网互通": [
    { title: "接入标识", fields: [
      { label: "VLAN ID", method: "text", placeholder: "如 305" },
    ]},
  ],
  "AI 专线": [
    { title: "接入标识", fields: [
      { label: "VLAN ID", method: "text", placeholder: "如 401" },
    ]},
  ],
  "国内精品网": [
    { title: "接入标识", fields: [
      { label: "VLAN ID", method: "text", placeholder: "如 501" },
    ]},
  ],
  "国际精品网": [
    { title: "接入标识", fields: [
      { label: "VLAN ID", method: "text", placeholder: "如 601" },
    ]},
  ],
  "OPON": [
    { title: "接入标识", fields: [
      { label: "VLAN ID", method: "text", placeholder: "如 100/200/300" },
    ]},
  ],
  "D-MAN": [
    { title: "接入标识", fields: [
      { label: "VLAN ID", method: "text", placeholder: "如 701" },
    ]},
  ],
  "OTN": [
    { title: "接入标识", fields: [
      { label: "VLAN ID", method: "text", placeholder: "如 801" },
    ]},
  ],
  "SD-WAN": [
    { title: "接入标识", fields: [
      { label: "VLAN ID", method: "text", placeholder: "如 901" },
    ]},
  ],
  "机柜托管": [
    { title: "机位与电力", fields: [
      { label: "机柜号", method: "text", placeholder: "如 A12" },
      { label: "U 位起止", method: "text", placeholder: "如 U20-U29（10U）" },
      { label: "电力需求", method: "text", unit: "kW" },
      { label: "PDU 类型", method: "enum", options: ["单路 PDU", "双路 PDU（A/B）"] },
      { label: "网络端口", method: "enum", options: ["1G 电口", "10G 光口", "25G 光口"] },
    ]},
  ],
  "云主机": [
    { title: "算力规格", fields: [
      { label: "节点位置", method: "enum", options: ["漕河泾云节点", "临港算力节点"] },
      { label: "vCPU / 内存", method: "enum", options: ["8C32G", "16C64G", "32C128G", "GPU 8卡"] },
      { label: "系统盘", method: "enum", options: ["200G SSD", "500G SSD"] },
      { label: "数据盘", method: "text", unit: "TB" },
      { label: "公网带宽", method: "text", unit: "M" },
    ]},
  ],
  "WAF 等订阅服务": [
    { title: "防护参数", fields: [
      { label: "清洗阈值", method: "enum", options: ["10G", "20G", "40G", "100G"], },
      { label: "防护域名数", method: "text", unit: "个" },
      { label: "QPS 上限", method: "text", unit: "QPS" },
      { label: "回源方式", method: "enum", options: ["直连回源", "隧道回源"] },
      { label: "证书管理", method: "enum", options: ["客户自带证书", "平台托管证书"] },
    ]},
  ],
  "运营商线路/裸光纤/设备转售": [
    { title: "交付凭证", fields: [
      { label: "运营商电路编号", method: "text", placeholder: "运营商侧工单号" },
      { label: "交付验收单号", method: "text" },
      { label: "带宽复测结果", method: "text", unit: "M", placeholder: "交付时实测，回填" },
    ]},
  ],
};

export const CATS = Object.keys(TECH_PARAMS);

// ---------- 类别大白话说明（给业务/管理层看：这些参数是干什么用的） ----------
export const CAT_DESC: Record<string, string> = {
  "BGP 三网互通": "ISP 线路业务：技术参数按技术部口径只留 VLAN ID，其余配置由工程师按标准模板执行",
  "AI 专线": "ISP 线路业务：只留 VLAN ID（SLA 指标以合同条款为准）",
  "国内精品网": "ISP 线路业务：只留 VLAN ID（SLA 指标以合同条款为准）",
  "国际精品网": "ISP 线路业务：只留 VLAN ID（出境方向与合规备案以合同条款及备案档案为准）",
  "OPON": "ISP 线路业务：只留 VLAN ID",
  "D-MAN": "ISP 线路业务：只留 VLAN ID（端点与保护等级以采购合同为准）",
  "OTN": "ISP 线路业务：只留 VLAN ID（波道工程参数由运营商配置，端点与保护以采购合同为准）",
  "SD-WAN": "ISP 线路业务：只留 VLAN ID（隧道与加密按产品规格默认配置）",
  "机柜托管": "客户设备放我们机房的机位、电力与网络口（非线路业务）",
  "云主机": "给客户开算力资源，约定配置规格（非线路业务）",
  "WAF 等订阅服务": "防护服务的阈值与范围（防多少流量、护几个域名）（非线路业务）",
  "运营商线路/裸光纤/设备转售": "纯转买转卖，只留运营商交付凭证（电路编号 / 验收单号 / 复测结果）；一对一运营商线路仅存在于本类",
};

// ---------- IP 段已占用区间（②层数据：精确到地址级） ----------
export interface OccupiedRange { start: string; end: string; customer: string }
export const IP_OCCUPIED: Record<string, OccupiedRange[]> = {
  "IP-58.40.0": [
    { start: "58.40.0.10", end: "58.40.0.109", customer: "云启数据科技（100 个）" },
    { start: "58.40.0.130", end: "58.40.0.193", customer: "恒信证券（64 个）" },
    { start: "58.40.0.220", end: "58.40.0.223", customer: "某科技公司（核算中预选 4 个）" },
  ],
  "IP-58.41.0": [{ start: "58.41.0.20", end: "58.41.0.59", customer: "跃游网络（40 个）" }],
  "IP-58.42.0": [{ start: "58.42.0.10", end: "58.42.0.109", customer: "中海贸易（100 个）" }],
  "IP-58.44.0": [{ start: "58.44.0.10", end: "58.44.0.159", customer: "正大物流（150 个）" }],
};
