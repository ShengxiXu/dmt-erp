// 附录 B 成本条目数据模型 —— 含每个字段的「填入方式」定义
// 填入方式五类：
//   text     直接填空（手工输入）
//   enum     枚举下拉（字典固定选项）
//   search   搜索选择（从其他业务数据档案中搜索并选择带入）
//   calc     自动计算（系统按公式自动带出，只读）
//   readonly 只读带入（上游节点 / CRM 同步，不可编辑）

export type MethodKind = "text" | "enum" | "search" | "calc" | "readonly";

export interface MethodDef {
  kind: MethodKind;
  field: string;      // 字段名
  label: string;      // 给用户看的说明
  source?: string;    // search：数据来源档案
}

export interface CatalogItem {
  key: string;
  name: string;
  dept: "ops" | "tech";    // ops=业务支撑部 tech=技术部
  costType: "周期性" | "一次性";
  unit: string;
  required: string;
  cats: string[];          // 适用产品类别（非接入类订单按类别预置条目）
  modes: string[];         // 绑定交付方式（1 对多：一条目可适用多个交付方式；各模式的条目集合由绑定关系反向推导）
  slot?: "per-carrier";    // 资源位展开规则：per-carrier = 按模式运营商组合逐家展开（默认全单 1 个资源位）
  methods: MethodDef[];    // 该条目的字段与填入方式
  hint: string;            // 演算示例（演示价）
  demo: string;            // 行内交互演示类型
}

export const CATEGORIES = [
  { id: "isp", name: "ISP 互联网接入（BGP / 三大运营商单线 / 双网组合 · 统一成本核算模型，2026-10-20 归并）" },
  { id: "otn", name: "数据专线（OTN / SD-WAN · 复用同一成本统计模型）" },
  { id: "idc", name: "IDC 托管" },
  { id: "cloud", name: "云服务" },
  { id: "sec", name: "安全服务（DDoS/WAF）" },
  { id: "resale", name: "转售业务（三大运营商线路 / 裸光纤 / 设备 · 转买转卖，2026-10-20 新增）" },
];

// ---------- 模拟数据源（真实系统中对应各业务档案） ----------
export interface PoolOrder {
  customer: string;
  bw: number;          // 该客户订单占用带宽（M）
  since: string;       // 开通时间
  until?: string;      // 合同到期月（YYYY-MM）
}
/** 已承载订单到期月取数（按客户名去括号备注匹配；数据缺 until 字段时兜底） */
export const CAT_ORDER_UNTIL: Record<string, string> = {
  云启数据科技: "2027-03", 恒信证券: "2027-01", 跃游网络: "2026-12", 博彦软件: "2027-06",
  中海贸易: "2027-09", 凯瑞传媒: "2027-02", 朗润教育: "2027-05", 正大物流: "2027-04",
  美格电商: "2027-08", 跨境电商云集市: "2027-12", 游戏出海星海互娱: "2026-12",
  智慧园区接入: "2028-06", 酒店集团客房宽带: "2027-11",
};
export const catUntilOf = (o: PoolOrder): string => o.until ?? CAT_ORDER_UNTIL[o.customer.split("（")[0]] ?? "—";
export interface SourceRow {
  id: string;
  title: string;
  sub: string;
  meta?: string;
  /** 带宽池档案：容量与当前负载（一对多切分时由工程师人工判断余量） */
  pool?: {
    capacityM: number;   // 采购总带宽
    usedM: number;       // 已承载合计
    orders: PoolOrder[]; // 已承载的客户订单明细
  };
  /** 一对一专享线路：每运营商两单采购结构（基础线路 + 互联网线路）分段单价，合计 = meta */
  segments?: { label: string; price: number }[];
  /** 线路-IP 绑定：采购线路时绑定好的 IP（只增不删，每 IP 可绑 2 条线做冗余）；选线后自动带出 */
  boundIp?: string;
  /** IP 地址档案行：该地址段包含的地址数（选中后自动带出占用数量） */
  ipCount?: number;
  /** 按固定条数计价的线路（数据专线长途波道/管道段：固定 2 条，单价按条计，不受订单带宽影响） */
  fixedQty?: number;
  /** 出口资源分类标签 = 归属产品类型（出口资源弹层按 6 类产品类型分类查询） */
  ptag?: string;
  /** 可共享给哪些产品类型（填报选资源时：归属该类型、或标记可共享给该类型的行都会出现，如 D-MAN 订单能看到 BGP 的电信出口） */
  shareTo?: string[];
}

export interface MemberPool {
  name: string;         // 通道池名（见名知意：运营商 + 通道池 + 采购容量）
  capacityM: number;    // 批发采购容量
  monthlyCost: number;  // 池月成本
}

export const SOURCES: Record<string, { name: string; rows: SourceRow[] }> = {
  pool: {
    name: "带宽资源档案（P08 入库：一对多切分池 + 一对一专享线路）",
    rows: [
      {
        id: "P-001", title: "电信 CN2 GIA 批发池（一对多切分）· 500M", sub: "上游：CN2 GIA｜池月租 75,000 元｜合同 CT-2026-018｜承载线路：I-101（绑 2 个 C 段）", meta: "75000",
        pool: {
          capacityM: 500, usedM: 380,
          orders: [
            { customer: "云启数据科技", bw: 100, since: "2025-11" },
            { customer: "恒信证券", bw: 80, since: "2026-01" },
            { customer: "跃游网络", bw: 50, since: "2026-03" },
            { customer: "博彦软件", bw: 100, since: "2026-06" },
            { customer: "某科技公司（本单）", bw: 50, since: "—" },
          ],
        },
      },
      {
        id: "P-002", title: "联通 169 骨干池（一对多切分）· 1G", sub: "上游：联通 169｜池月租 28,000 元｜合同 CU-2026-033｜承载线路：I-102（绑 2 个 C 段）", meta: "28000",
        pool: {
          capacityM: 1000, usedM: 520,
          orders: [
            { customer: "中海贸易", bw: 200, since: "2025-09" },
            { customer: "凯瑞传媒", bw: 200, since: "2026-02" },
            { customer: "朗润教育", bw: 120, since: "2026-05" },
          ],
        },
      },
      {
        id: "P-003", title: "移动 CMNET 池（一对多切分）· 500M", sub: "上游：移动 CMNET｜池月租 16,000 元｜合同 CM-2026-007｜承载线路：I-103（绑 2 个 C 段）", meta: "16000",
        pool: {
          capacityM: 500, usedM: 150,
          orders: [
            { customer: "正大物流", bw: 100, since: "2026-04" },
            { customer: "美格电商", bw: 50, since: "2026-08" },
          ],
        },
      },
      { id: "D-001", title: "电信 CN2 GIA 专线（一对一专享）· 100M", sub: "向电信采购的独享线路，整线交付给一个客户｜18 元/Mbps·月（基础线路 10 + 互联网线路 8）｜合同 CT-2026-051", meta: "18",
        segments: [
          { label: "基础线路（用户端→我方机房）", price: 10 },
          { label: "互联网线路（我方机房→互联网）", price: 8 },
        ] },
      { id: "D-002", title: "联通 169 专线（一对一专享）· 200M", sub: "向联通采购的独享线路，整线交付给一个客户｜15 元/Mbps·月（基础线路 8 + 互联网线路 7）｜合同 CU-2026-042", meta: "15",
        segments: [
          { label: "基础线路（用户端→我方机房）", price: 8 },
          { label: "互联网线路（我方机房→互联网）", price: 7 },
        ] },
      { id: "D-003", title: "移动 CMNET 专线（一对一专享）· 100M", sub: "向移动采购的独享线路，整线交付给一个客户｜12 元/Mbps·月（基础线路 7 + 互联网线路 5）｜合同 CM-2026-015", meta: "12",
        segments: [
          { label: "基础线路（用户端→我方机房）", price: 7 },
          { label: "互联网线路（我方机房→互联网）", price: 5 },
        ] },
    ],
  },
  linebase: {
    name: "基础线路资源档案（单客户专用，可跨产品类型共用，不绑定 IP）",
    rows: [
      { id: "B-001", title: "电信 CN2 GIA 基础线路（单客户专用）· 100M", sub: "整条月租 1,000 元/月｜合同 CT-2026-051｜可跨产品类型共用（共用计 0）｜不绑定 IP", meta: "1000" },
      { id: "B-002", title: "联通 169 基础线路（单客户专用）· 200M", sub: "整条月租 1,600 元/月｜合同 CU-2026-042｜可跨产品类型共用（共用计 0）｜不绑定 IP", meta: "1600" },
      { id: "B-003", title: "移动 CMNET 基础线路（单客户专用）· 100M", sub: "整条月租 700 元/月｜合同 CM-2026-015｜可跨产品类型共用（共用计 0）｜不绑定 IP", meta: "700" },
      { id: "B-201", title: "上海—北京 OTN 长途线路（含两端，数据专线用）", sub: "整条月租 6,000 元/月｜供应商合同 OT-2026-009｜单客户专用｜不绑定 IP", meta: "6000" },
      { id: "B-202", title: "上海—广州 OTN 长途线路（含两端，数据专线用）", sub: "整条月租 5,200 元/月｜供应商合同 OT-2026-015｜单客户专用｜不绑定 IP", meta: "5200" },
    ],
  },
  lineinternet: {
    name: "出口线路档案（向运营商采购的线路，可多家客户共用；一对一运营商线路仅存在于转售业务）",
    rows: [
      { id: "E-CT-1", title: "电信 BGP 出口｜归属 BGP 三网互通（可共享 AI 专线 / D-MAN）· 1G", ptag: "BGP 三网互通", shareTo: ["AI 专线", "D-MAN"], sub: "月租 45,000 元（固定周期成本，与售出无关）｜合同 CT-2026-018｜计收 = 归属产品类型出口月租合计 ÷（已售合计 + 本单）× 本单带宽｜不关联基础线路档案（基础线路仅一对一）", meta: "45000",
        pool: {
          capacityM: 1000, usedM: 600,
          orders: [
            { customer: "中海贸易（BGP）", bw: 200, since: "2025-09" },
            { customer: "凯瑞传媒（BGP）", bw: 200, since: "2026-02" },
            { customer: "云启数据（AI 专线）", bw: 100, since: "2026-03" },
            { customer: "跃游网络（D-MAN）", bw: 50, since: "2026-06" },
            { customer: "某科技公司（BGP，本单）", bw: 50, since: "—" },
          ],
        } },
      { id: "I-102", title: "联通 169 BGP 出口｜归属 BGP 三网互通（可共享 AI 专线）· 1G", ptag: "BGP 三网互通", shareTo: ["AI 专线"], sub: "月租 40,000 元｜合同 CU-2026-033｜计收 = 归属产品类型出口月租合计 ÷（已售合计 + 本单）× 本单带宽｜不关联基础线路档案（基础线路仅一对一）", meta: "40000",
        pool: {
          capacityM: 1000, usedM: 500,
          orders: [
            { customer: "中海贸易（BGP）", bw: 200, since: "2025-09" },
            { customer: "凯瑞传媒（BGP）", bw: 200, since: "2026-02" },
            { customer: "云启数据（AI 专线）", bw: 100, since: "2026-03" },
          ],
        } },
      { id: "I-103", title: "移动 CMNET BGP 出口｜归属 BGP 三网互通（可共享 AI 专线）· 800M", ptag: "BGP 三网互通", shareTo: ["AI 专线"], sub: "月租 28,000 元｜合同 CM-2026-007｜计收 = 归属产品类型出口月租合计 ÷（已售合计 + 本单）× 本单带宽｜不关联基础线路档案（基础线路仅一对一）", meta: "28000",
        pool: {
          capacityM: 800, usedM: 500,
          orders: [
            { customer: "中海贸易（BGP）", bw: 200, since: "2025-09" },
            { customer: "凯瑞传媒（BGP）", bw: 200, since: "2026-02" },
            { customer: "云启数据（AI 专线）", bw: 100, since: "2026-03" },
          ],
        } },
      { id: "I-101", title: "电信 CN2 GIA 出口线路｜归属国内精品网（专属）· 500M", ptag: "国内精品网", sub: "月租 75,000 元｜合同 CT-2026-051｜计收 = 归属产品类型出口月租合计 ÷（已售合计 + 本单）× 本单带宽｜不关联基础线路档案（基础线路仅一对一）", meta: "75000", boundIp: "绑定 IP：58.40.0.0/24 ＋ 58.41.0.0/24（2 个 C 段 · 共 512 个地址 · 自有池 · 随本线路分配给多个客户）",
        pool: {
          capacityM: 500, usedM: 180,
          orders: [
            { customer: "恒信证券", bw: 80, since: "2026-01" },
            { customer: "博彦软件", bw: 100, since: "2026-06" },
          ],
        } },
      { id: "PN-DOM", title: "国内精品网骨干通道｜归属国内精品网（专属，上海张江入口）· 1G", ptag: "国内精品网", sub: "月租 120,000 元（整线包租，等价 120 元/Mbps·月）｜低时延骨干网｜计收 = 归属产品类型出口月租合计 ÷（已售合计 + 本单）× 本单带宽", meta: "120000",
        pool: {
          capacityM: 1000, usedM: 520,
          orders: [
            { customer: "澜石金融", bw: 320, since: "2025-08" },
            { customer: "云途物流", bw: 200, since: "2026-02" },
          ],
        } },
      { id: "PN-INTL", title: "国际精品网出口线路｜归属国际精品网（境外运营商采购，香港方向）· 500M", ptag: "国际精品网", sub: "月租 130,000 元（整线包租，等价 260 元/Mbps·月）｜跨境合规出口｜计收 = 归属产品类型出口月租合计 ÷（已售合计 + 本单）× 本单带宽", meta: "130000",
        pool: {
          capacityM: 500, usedM: 260,
          orders: [
            { customer: "跨境电商云集市", bw: 180, since: "2025-12" },
            { customer: "游戏出海星海互娱", bw: 80, since: "2026-05" },
          ],
        } },
      { id: "PN-PON", title: "PON 汇聚上联通道｜归属 OPON（专属）· 10G", ptag: "OPON", sub: "月租 180,000 元（整线包租，等价 18 元/Mbps·月）｜计收 = 归属产品类型出口月租合计 ÷（已售合计 + 本单）× 本单带宽", meta: "180000",
        pool: {
          capacityM: 10000, usedM: 6500,
          orders: [
            { customer: "智慧园区接入（批量 260 户）", bw: 3900, since: "2025-06" },
            { customer: "酒店集团客房宽带", bw: 2600, since: "2025-11" },
          ],
        } },
      // 注：AI 专线出口与 BGP 相同（共享 E-CT-1 / I-102 / I-103）；D-MAN 共享 BGP 电信出口（E-CT-1）——不再单列专属通道
    ],
  },
  contract: {
    name: "采购合同档案（价格事实镜像自「采购合同」主数据）",
    rows: [
      { id: "C-018", title: "电信出口带宽采购合同 CT-2026-018", sub: "固定单价 60 元/Mbps·月｜周期性固定计费（非 95/流量）", meta: "60" },
      { id: "C-033", title: "联通出口带宽采购合同 CU-2026-033", sub: "固定单价 55 元/Mbps·月｜周期性固定计费", meta: "55" },
      { id: "C-007", title: "移动出口带宽采购合同 CM-2026-007", sub: "固定单价 50 元/Mbps·月｜周期性固定计费", meta: "50" },
    ],
  },
  device: {
    name: "设备库存档案（P02）",
    rows: [
      { id: "D-2210", title: "华为 AR6121 CPE（在库 5 台）", sub: "库存成本价 4,500 元/台｜仓库：上海漕河泾｜绑库存出库", meta: "4500" },
      { id: "D-2231", title: "华三 MSR3600 CPE（在库 2 台）", sub: "库存成本价 3,800 元/台｜仓库：上海漕河泾｜绑库存出库", meta: "3800" },
    ],
  },
  devicepo: {
    name: "设备采购单档案（P08 在途 / 按单采购）",
    rows: [
      { id: "PO-2201", title: "华为 AR6121 CPE 采购单（在途）", sub: "采购单价 4,300 元/台｜本单 10 台｜依据采购合同 CT-2026-031｜预计 2026-11-05 到货", meta: "4300" },
      { id: "PO-2230", title: "华三 MSR3600 CPE 采购单（在途）", sub: "采购单价 3,600 元/台｜本单 6 台｜依据采购合同 CT-2026-044｜预计 2026-11-12 到货", meta: "3600" },
    ],
  },
  ippool: {
    name: "IP 地址段档案",
    rows: [
      { id: "IP-1", title: "自有 IPv4 地址段 · 256 个", sub: "年成本 120,000 元｜单价 39 元/个·月", meta: "39" },
      { id: "IP-2", title: "自有 IPv4 C 段组（出口线路绑定）· 1,024 个", sub: "年成本 480,000 元｜单价 39 元/个·月｜供 I-101 / E-CT-1 / I-102 / I-103 等出口线路整段绑定", meta: "39" },
    ],
  },
  lineip: {
    name: "线路绑定 IP 档案（以出口线路为查询条件，仅列出该线路绑定的 IP 地址段）",
    rows: [
      { id: "IP-58.40.0", title: "58.40.0.0/24（C 段）", sub: "所属线路 I-101（电信 CN2 GIA 出口｜国内精品网）｜256 个地址｜单价 39 元/个·月", meta: "39", ipCount: 256 },
      { id: "IP-58.41.0", title: "58.41.0.0/24（C 段）", sub: "所属线路 E-CT-1（电信 BGP 出口｜BGP 三网互通）｜256 个地址｜单价 39 元/个·月", meta: "39", ipCount: 256 },
      { id: "IP-58.42.0", title: "58.42.0.0/24（C 段）", sub: "所属线路 I-102（联通 169 BGP 出口｜BGP 三网互通）｜256 个地址｜单价 39 元/个·月", meta: "39", ipCount: 256 },
      { id: "IP-58.43.0", title: "58.43.0.0/24（C 段）", sub: "所属线路 I-103（移动 CMNET BGP 出口｜BGP 三网互通）｜256 个地址｜单价 39 元/个·月", meta: "39", ipCount: 256 },
      { id: "IP-58.44.0", title: "58.44.0.0/24（C 段）", sub: "所属线路 E-CT-1 + I-102（AI 专线主备绑定）｜256 个地址｜单价 39 元/个·月", meta: "39", ipCount: 256 },
      { id: "IP-58.45.0", title: "58.45.0.0/24（C 段）", sub: "保留段（暂未绑定出口线路）｜256 个地址｜单价 39 元/个·月", meta: "39", ipCount: 256 },
    ],
  },
  service: {
    name: "第三方服务订阅档案（P08）",
    rows: [
      { id: "S-31", title: "DDoS 清洗 10G · 清洗服务商X", sub: "3,000 元/月｜一对一按需转售｜按单结转", meta: "3000" },
      { id: "S-32", title: "WAF 年订阅 · 安全厂商Y", sub: "36,000 元/年｜一对多｜已服务 10 客户 → 300 元/月·客户", meta: "300" },
    ],
  },
  port: {
    name: "上联端口台账（核心网资源）",
    rows: [
      { id: "PT-10G-03", title: "核心路由器 10G 上联端口 #3", sub: "端口月成本 8,000 元｜已用 3,200M / 10,000M", meta: "8000" },
    ],
  },
  otu: {
    name: "OTN 平台 OTU 端口台账",
    rows: [
      { id: "OTU-21", title: "OTU 端口 #21（上海端）", sub: "单价 500 元/端口·月｜空闲", meta: "500" },
      { id: "OTU-22", title: "OTU 端口 #22（北京端）", sub: "单价 500 元/端口·月｜空闲", meta: "500" },
    ],
  },
  asset: {
    name: "设备资产台账",
    rows: [
      { id: "A-8801", title: "戴尔 R740 服务器（云节点）", sub: "购置价 60,000 元｜3 年折旧 → 1,667 元/月", meta: "1667" },
    ],
  },
  material: {
    name: "设备库存（板卡/光模块）",
    rows: [
      { id: "M-110", title: "10G 光模块（在库 30 个）", sub: "单价 400 元", meta: "400" },
      { id: "M-121", title: "100G 光模块（在库 8 个）", sub: "单价 2,800 元", meta: "2800" },
    ],
  },
  resale: {
    name: "转售采购档案（运营商线路 / 裸光纤 / 设备批发价 · 转买转卖直接结转）",
    rows: [
      { id: "RS-CT", title: "电信线路批发价（转售采购）", sub: "60 元/Mbps·月｜合同 CT-2026-018｜转售价由 CRM 合同决定，成本 = 采购价", meta: "60" },
      { id: "RS-DEDI", title: "电信 CN2 GIA 独享出口线路（一对一专享 · 转售采购）· 100M", sub: "整线批发 80 元/Mbps·月（一条只转售一个客户）｜合同 CT-2026-051｜一对一运营商线路仅存在于转售业务", meta: "80" },
      { id: "RS-CU", title: "联通线路批发价（转售采购）", sub: "55 元/Mbps·月｜合同 CU-2026-033", meta: "55" },
      { id: "RS-CM", title: "移动线路批发价（转售采购）", sub: "50 元/Mbps·月｜合同 CM-2026-007", meta: "50" },
      { id: "RS-FIBER", title: "裸光纤 上海—苏州（转售采购）", sub: "8,000 元/月·对｜供应商合同 OF-2026-006", meta: "8000" },
      { id: "RS-SW", title: "华为 S5735 交换机（批发价）", sub: "3,200 元/台｜渠道批发合同 RS-EQ-112", meta: "3200" },
    ],
  },
  sla: {
    name: "SLA 等级字典",
    rows: [
      { id: "std", title: "标准 99.9%（单上联）", sub: "无冗余预留", meta: "0" },
      { id: "hi", title: "高可用 99.99%（双上联）", sub: "冗余预留 ≈ 常规端口费的 20%", meta: "20%" },
    ],
  },
  cabinet: {
    name: "机柜资源档案",
    rows: [
      { id: "R-A12", title: "漕河泾机房 A12 柜（42U）", sub: "整柜月租 5,000 元｜已用 26U｜剩余 16U", meta: "5000" },
    ],
  },
  engineer: {
    name: "工程师工时字典",
    rows: [
      { id: "E1", title: "网络工程师 · 内部折算价", sub: "800 元/人天", meta: "800" },
    ],
  },
  share10: {
    name: "计费基数（一对多服务客户数）",
    rows: [
      { id: "SH-1", title: "当前服务客户数：10 户（WAF 订阅）", sub: "年订阅 36,000 元 ÷ 12 ÷ 10", meta: "300" },
    ],
  },
  share200: {
    name: "计费基数（监控平台订阅客户数）",
    rows: [
      { id: "SH-2", title: "监控平台订阅客户：200 户", sub: "年成本 120,000 元 ÷ 12 ÷ 200", meta: "50" },
    ],
  },
  share40: {
    name: "计费基数（云节点总数）",
    rows: [
      { id: "SH-3", title: "云节点总数：40 个｜本租户占 1 个", sub: "年许可费 120,000 元 ÷ 12 ÷ 40", meta: "250" },
    ],
  },
  bgpplat: {
    name: "BGP 平台运行参数",
    rows: [
      { id: "BP-1", title: "BGP 路由调度平台年运维费：600,000 元", sub: "平台总售出带宽 2,000M", meta: "2000" },
    ],
  },
};

/** 出口资源分类标签（按 6 类产品类型分类查询 + 通用形态） */
export const RESOURCE_TAGS = ["BGP 三网互通", "AI 专线", "OPON", "D-MAN", "国内精品网", "国际精品网"];

// ---------- 23 个条目定义 ----------
export const ITEMS: CatalogItem[] = [
  // ===== 业务支撑部条目 =====
  {
    key: "op1a", name: "基础线路租用费",dept: "ops",
    costType: "周期性", unit: "元/月", required: "是（接入类 + 数据专线）", cats: ["isp", "otn"], modes: ["PT-AI", "PT-BGP", "PT-PON", "PT-DMAN", "PT-DOM", "PT-INTL"],
    methods: [
      { kind: "readonly", field: "订单带宽", label: "从订单行带入（CRM 同步），只读" },
      { kind: "search", field: "基础线路资源", label: "搜索选择基础线路：向运营商租的整条线，单客户专用；不同产品类别可共用同一条线（勾选「共用」计 0，成本计于先关联的行），不重复采购；一单可含多条（一般 1 条，冗余 2 条）；不绑定 IP；无采购订单可关联时转手工填入", source: "linebase" },
      { kind: "calc", field: "amount", label: "Σ（条数 × 整条月租；共用线路计 0），自动算" },
    ],
    hint: "选 B-001：1 条 × 1,000 元 = 1,000 元/月；与 L1 行共用 B-001 → 本行 0 元（成本计于 L1 行）；数据专线新增 B-201（上海↔北京，含两端）：6,000 元/月",
    demo: "bwbase",
  },
  {
    key: "op1b", name: "出口带宽租用费",dept: "ops",
    costType: "周期性", unit: "元/月", required: "是（ISP 类）", cats: ["isp"], modes: ["PT-AI", "PT-BGP", "PT-PON", "PT-DMAN", "PT-DOM", "PT-INTL"],
    methods: [
      { kind: "readonly", field: "订单带宽", label: "从订单行带入（CRM 同步），只读" },
      { kind: "search", field: "出口线路", label: "搜索选择出口线路：向运营商采购的线路（归属某产品类型，可标记共享给其他产品）；一单可含多条；成本按归属产品类型出口池计算（同池多条只计一次）；无采购订单可关联时转手工填入", source: "lineinternet" },
      { kind: "calc", field: "amount", label: "产品类型出口月租合计 ÷（该产品类型已售带宽合计 + 本单带宽）× 本单带宽，自动算（多条线路同属一个产品类型池时只计一次）" },
    ],
    hint: "BGP 三网 50M：池 = 电信 45,000 + 联通 40,000 + 移动 28,000 = 113,000 元，已售 600+500+500 = 1,600M，113,000÷(1,600+50)×50 = 3,424 元/月（三出口合并为一个池，边际计价——新增本单的成本；月结按平均分摊做实际归属）；国内精品网 50M：池 = 75,000+120,000 = 195,000，已售 700M，195,000÷(700+50)×50 = 13,000 元/月",
    demo: "bwinternet",
  },
  {
    key: "op4", name: "CPE 设备购置费",dept: "ops",
    costType: "一次性", unit: "元", required: "是（OTN 随单买断）", cats: ["otn", "isp"], modes: ["PT-AI", "PT-BGP", "PT-PON", "PT-DMAN", "PT-DOM", "PT-INTL"],
    methods: [
      { kind: "search", field: "设备", label: "搜索设备库存（P02）；按单采购走采购单（P08），到货直发现场", source: "device" },
      { kind: "enum", field: "供给方式", label: "枚举：库存直绑 / 按单采购" },
      { kind: "calc", field: "amount", label: "台数 × 采购单价，自动算" },
    ],
    hint: "2 台 × 4,500 元 = 9,000 元（一次性，报价已含）",
    demo: "device",
  },
  {
    key: "op5", name: "机柜租用及电力费",dept: "ops",
    costType: "周期性", unit: "元/月", required: "是", cats: ["idc", "cloud"], modes: [],
    methods: [
      { kind: "enum", field: "计费口径", label: "枚举：按 U 位 / 按电力（字典配置）" },
      { kind: "search", field: "机柜", label: "搜索选择机柜档案，带出整柜月租", source: "cabinet" },
      { kind: "text", field: "占用 U 位 / kW", label: "手工输入占用值" },
      { kind: "calc", field: "amount", label: "占用÷总量 × 整柜月租，自动算" },
    ],
    hint: "10U ÷ 42U × 5,000 ≈ 1,190 元/月",
    demo: "cabinet",
  },
  {
    key: "op6", name: "IP 地址使用费",dept: "tech",
    costType: "周期性", unit: "元/月", required: "按产品", cats: ["isp", "idc"], modes: ["PT-AI", "PT-BGP", "PT-PON", "PT-DMAN", "PT-DOM", "PT-INTL"],
    methods: [
      { kind: "readonly", field: "出口线路", label: "由本行「出口带宽租用费」条目选定后带入，作为 IP 查询条件（IP 与线路绑定；基础线路不绑定 IP）" },
      { kind: "search", field: "绑定 IP 地址", label: "以出口线路为查询条件搜索选择，仅列出该线路绑定的 IP（出口线路均为共享线路，绑定整段 C 段按需分配；无绑定档案时转手工填入，留痕）", source: "lineip" },
      { kind: "text", field: "本单分配数量", label: "直接填空（默认 = CRM 需求数量；一对多 C 段按需分配，不整段计费）" },
      { kind: "calc", field: "amount", label: "地址单价 × 本单分配数量，自动算出" },
    ],
    hint: "选定电信共享出口 I-101 → 查询出绑定 C 段 58.40.0.0/24（共 256 个），本单分配 4 个（默认 = CRM 需求）：39 元 × 4 = 156 元/月；同段其余地址仍可供其他订单分配（共享 C 段不整段计费）",
    demo: "ippool",
  },
  {
    key: "op7", name: "第三方安全/增值服务采购成本",dept: "ops",
    costType: "周期性", unit: "元/月", required: "否", cats: ["sec"], modes: [],
    methods: [
      { kind: "enum", field: "服务类型", label: "枚举：DDoS 清洗 / WAF / 安全服务 / CDN" },
      { kind: "search", field: "服务订阅", label: "搜索第三方服务订阅档案，带出价格与计费方式", source: "service" },
      { kind: "calc", field: "amount", label: "一对一按单全额计收；一对多按客户数计收", source: "share10" },
    ],
    hint: "DDoS 10G 3,000 元/月；WAF 36,000÷12÷10 = 300 元/月",
    demo: "service",
  },
  {
    key: "op8", name: "安装调测费",dept: "tech",
    costType: "一次性", unit: "人天", required: "是", cats: ["isp", "otn", "idc", "resale"], modes: ["PT-AI", "PT-BGP", "PT-PON", "PT-DMAN", "PT-DOM", "PT-INTL"],
    methods: [
      { kind: "text", field: "人天", label: "直接填空（技术部按实际投入人天填报）" },
      { kind: "search", field: "工时折算价", label: "搜索工时字典带出折算价（A4 字典统一维护，开通实施与安装调测共用同一折算价）", source: "engineer" },
      { kind: "calc", field: "amount", label: "人天 × 折算价，自动算" },
    ],
    hint: "新装专线上门调测 1 人天 × 800 元/人天 = 800 元",
    demo: "manday",
  },
  {
    key: "op9", name: "现场布线施工费",dept: "ops",
    costType: "一次性", unit: "元", required: "按装配", cats: ["isp", "otn", "idc"], modes: ["PT-AI", "PT-BGP", "PT-PON", "PT-DMAN", "PT-DOM", "PT-INTL"],
    methods: [
      { kind: "text", field: "金额", label: "直接填空（施工队报价）" },
    ],
    hint: "布线 30 米 + 熔接 4 芯 = 1,500 元",
    demo: "plain1500",
  },
  {
    key: "op10", name: "设备物流运输费",dept: "ops",
    costType: "一次性", unit: "元", required: "按装配", cats: ["otn", "isp", "idc", "resale"], modes: [],
    methods: [
      { kind: "text", field: "金额", label: "直接填空（含保价费）" },
    ],
    hint: "CPE 2 台物流 + 保价 = 300 元",
    demo: "plain300",
  },
  {
    key: "op11", name: "外勤上门差旅费",dept: "ops",
    costType: "一次性", unit: "元", required: "按装配", cats: ["isp", "otn", "idc", "cloud", "resale"], modes: [],
    methods: [
      { kind: "text", field: "金额", label: "直接填空（按票据实报）" },
    ],
    hint: "苏州移机高铁往返 + 市内交通 = 250 元",
    demo: "plain250",
  },

  // ===== 转售业务（转买转卖，成本 = 采购价直接结转） =====
  {
    key: "rs1", name: "转售线路/裸光纤采购成本（转买转卖）",dept: "ops",
    costType: "周期性", unit: "元/月", required: "是（转售类）", cats: ["resale"], modes: [],
    methods: [
      { kind: "search", field: "转售采购合同", label: "搜索选择转售采购档案（运营商线路 / 裸光纤批发价），带出采购单价", source: "resale" },
      { kind: "text", field: "数量", label: "直接填空（带宽 M / 光纤对数）" },
      { kind: "calc", field: "amount", label: "数量 × 采购单价，直接结转（不加成）" },
    ],
    hint: "电信线路批发 60 元/M × 100M = 6,000 元/月（转售价 80 元/M，毛利 CRM 合同侧体现）",
    demo: "resale",
  },
  {
    key: "rs2", name: "转售设备采购成本（转买转卖）",dept: "ops",
    costType: "一次性", unit: "元", required: "是（转售类）", cats: ["resale"], modes: [],
    methods: [
      { kind: "search", field: "设备批发采购", label: "搜索转售采购档案中的设备批发价（或设备库存），带出单价", source: "resale" },
      { kind: "text", field: "数量", label: "直接填空（台数）" },
      { kind: "calc", field: "amount", label: "台数 × 批发单价，直接结转" },
    ],
    hint: "2 台 × 3,200 元 = 6,400 元（一次性）",
    demo: "device",
  },

  // ===== 技术部 10 条 =====
  {
    key: "t1", name: "网络开通实施费",dept: "tech",
    costType: "一次性", unit: "元", required: "是", cats: ["isp", "otn", "idc", "cloud", "sec"], modes: [],
    methods: [
      { kind: "text", field: "人天", label: "直接填空（人数 × 天数）" },
      { kind: "search", field: "工时折算价", label: "搜索工时字典带出折算价（A4 字典统一维护，开通实施与安装调测共用同一折算价）", source: "engineer" },
      { kind: "calc", field: "amount", label: "人天 × 折算价，自动算" },
    ],
    hint: "2 人 × 2 天 × 800 元 = 3,200 元",
    demo: "manday",
  },
  {
    key: "t2", name: "上联端口使用费",dept: "tech",
    costType: "周期性", unit: "元/月", required: "是", cats: ["isp", "idc", "cloud"], modes: [],
    methods: [
      { kind: "search", field: "上联端口", label: "搜索端口台账选择占用端口，带出端口月成本；仅计占用自有核心网/传输网端口且上游报价未含端口费的部分（上游已含的计 0）", source: "port" },
      { kind: "readonly", field: "本单带宽", label: "从订单行带入，只读" },
      { kind: "calc", field: "amount", label: "端口月成本 × 本单带宽÷端口带宽，自动算" },
    ],
    hint: "8,000 × 100M÷10,000M = 80 元/月",
    demo: "port",
  },
  {
    key: "t3", name: "OTU 端口使用费",dept: "tech",
    costType: "周期性", unit: "元/月", required: "是（数据专线类）", cats: ["otn"], modes: [],
    methods: [
      { kind: "search", field: "OTU 端口", label: "搜索 OTU 端口台账，两端各选一个；上游波道/管道采购报价已含 OTU 端口的，本条目计 0（2026-10-21 口径补丁）", source: "otu" },
      { kind: "calc", field: "amount", label: "端口数 × 单价，自动算" },
    ],
    hint: "2 个 × 500 元 = 1,000 元/月",
    demo: "otu",
  },
  {
    key: "t4", name: "BGP 平台运行维护费",dept: "tech",
    costType: "周期性", unit: "元/月", required: "是（ISP 类）", cats: ["isp"], modes: ["PT-BGP"],
    methods: [
      { kind: "search", field: "平台运行参数", label: "搜索平台档案，带出年运维费与总售出带宽", source: "bgpplat" },
      { kind: "readonly", field: "本单出口带宽", label: "从订单行带入，只读" },
      { kind: "calc", field: "amount", label: "年运维费÷12 × 本单带宽÷总售出带宽，自动算" },
    ],
    hint: "600,000÷12 × 50÷2,000 = 1,250 元/月",
    demo: "bgpplat",
  },
  {
    key: "t5", name: "设备原厂维保费",dept: "tech",
    costType: "周期性", unit: "元/月", required: "否", cats: ["isp", "otn", "idc", "cloud"], modes: [],
    methods: [
      { kind: "enum", field: "计费方式", label: "枚举：维保对象（网络设备 / 服务器硬件）+ 计费方式（按端口 / 按带宽），按对象分别取计费基数" },
      { kind: "text", field: "年维保金额", label: "直接填空（原厂维保合同金额）" },
      { kind: "calc", field: "amount", label: "年维保÷12÷端口数，自动算" },
    ],
    hint: "120,000÷12÷50 = 200 元/月",
    demo: "maintain",
  },
  {
    key: "t6", name: "云节点设备折旧费",dept: "tech",
    costType: "周期性", unit: "元/月", required: "按装配", cats: ["cloud", "idc"], modes: [],
    methods: [
      { kind: "search", field: "设备资产", label: "搜索设备资产台账，带出购置价与折旧年限（折旧年限/残值率字典可配置）；电费不含在本条目，由机柜电力条目统一核算", source: "asset" },
      { kind: "calc", field: "amount", label: "购置价 ÷ 折旧月数，自动算" },
    ],
    hint: "60,000 ÷ 36 = 1,667 元/月",
    demo: "asset",
  },
  {
    key: "t7", name: "光模块及板卡材料费",dept: "tech",
    costType: "一次性", unit: "元", required: "按装配", cats: ["isp", "otn", "idc", "cloud"], modes: [],
    methods: [
      { kind: "search", field: "设备库存", label: "搜索设备库存，带出采购价并扣减库存（含云节点服务器网卡/HBA 卡）", source: "material" },
      { kind: "text", field: "数量", label: "直接填空" },
      { kind: "calc", field: "amount", label: "数量 × 单价，自动算" },
    ],
    hint: "2 个 × 400 元 = 800 元",
    demo: "material",
  },
  {
    key: "t8", name: "监控平台服务费",dept: "tech",
    costType: "周期性", unit: "元/月", required: "否", cats: ["isp", "otn", "idc", "cloud", "sec"], modes: [],
    methods: [
      { kind: "search", field: "计费基数", label: "搜索服务客户数档案", source: "share200" },
      { kind: "calc", field: "amount", label: "年成本÷12÷客户数，自动算" },
    ],
    hint: "120,000÷12÷200 = 50 元/月",
    demo: "share200",
  },
  {
    key: "t9", name: "云平台软件许可费",dept: "tech",
    costType: "周期性", unit: "元/月", required: "按需（云类）", cats: ["cloud"], modes: [],
    methods: [
      { kind: "search", field: "计费基数", label: "搜索云节点档案", source: "share40" },
      { kind: "calc", field: "amount", label: "年许可费÷12÷节点数，自动算" },
    ],
    hint: "120,000÷12÷40 = 250 元/月",
    demo: "share40",
  },
  {
    key: "t10", name: "SLA 冗余保障费",dept: "tech",
    costType: "周期性", unit: "元/月", required: "否", cats: ["isp", "otn"], modes: [],
    methods: [
      { kind: "search", field: "SLA 等级", label: "搜索 SLA 字典带出本单冗余容量与池容量", source: "sla" },
      { kind: "calc", field: "amount", label: "池预留月成本 × 订单容量 ÷ 池容量；已单独采购的冗余（第二条出口线路 / 冗余基础线路）计 0，自动算" },
    ],
    hint: "池预留月成本 2,000 元 × 本单 50M ÷ 池容量 500M = 200 元/月（已购冗余线路计 0）",
    demo: "sla",
  },
];

export const METHOD_META: Record<MethodKind, { label: string; color: string; bg: string; desc: string }> = {
  text: { label: "直接填空", color: "text-orange-700", bg: "bg-orange-100 border-orange-300", desc: "手工键入数字/文本" },
  enum: { label: "枚举下拉", color: "text-green-700", bg: "bg-green-100 border-green-300", desc: "从字典固定选项中选" },
  search: { label: "搜索选择", color: "text-blue-700", bg: "bg-blue-100 border-blue-300", desc: "从其他业务档案搜索并选择，带出关联数据" },
  calc: { label: "自动计算", color: "text-purple-700", bg: "bg-purple-100 border-purple-300", desc: "系统按公式自动算出，只读" },
  readonly: { label: "只读带入", color: "text-gray-600", bg: "bg-gray-100 border-gray-300", desc: "上游节点/CRM 同步带入，不可改" },
};

// ---------- 三层模型配置（2026-10-20 修订） ----------
// cats 含义：该条目的「默认带出类别」——非接入类订单（OTN/IDC/云/安全，无交付模式）按类别预置表单行；
// 接入类订单的条目集合由交付模式绑定的模板生成：默认条目可删（可补回）；
// 「＋增补条目」仅限与交付模式/类别有绑定关系的条目（模板或类别绑定的条目子集），不允许加入无绑定关系的其他条目；
// 要扩大可增补范围只能改模板/类别绑定（附录 B6 字典，业务支撑部管理员维护）。

/** 每个条目绑定的财务成本科目（新增条目必须映射科目，保证归集口径统一） */
export const SUBJECTS: Record<string, string> = {
  op1a: "线路租用费", op1b: "带宽租用费", op4: "设备购置费",
  op5: "机柜租用费", op6: "IP 地址使用费", op7: "外购服务费", op8: "施工服务费",
  op9: "施工服务费", op10: "物流费", op11: "差旅费",
  t1: "内部人工成本", t2: "网络资源使用费", t3: "网络资源使用费", t4: "平台运行费",
  t5: "维保费", t6: "折旧费", t7: "物料消耗费", t8: "平台运行费",
  t9: "平台运行费", t10: "网络资源使用费",
};


// ---------- 产品类型字典（附录 B5）× 成本条目绑定（2026-10-20 迭代） ----------
// 类别：ISP 互联网接入（6 种产品类型，成本核算模型完全一致）、数据专线（OTN/SD-WAN）、IDC、云、安全、转售业务。
// 产品类型（AI专线 / BGP三网互通 / OPON / D-MAN / 国内精品网 / 国际精品网）只决定【关联哪类出口资源】，
// 不改变成本条目口径——条目集合统一：基础线路 ★、出口资源 ★、自有 IP ★ + CPE/调测/布线（默认）。
// 成本条目 → 产品类型是【1 对多】绑定（条目侧维护适用类型列表），类型的条目集合由绑定关系【反向推导】；
// 出口资源条目只有一种计价形态（录入边际计价）：产品类型出口月租合计 ÷（该产品类型已售带宽合计 + 本单带宽）× 本单带宽
//（出口是向运营商采购的线路，多家客户共用、不做减法；同产品类型的所有出口合并为一个池，新线闲置由全池共担；
//   共用出口——同一出口挂多产品类型——月租按各类型占用带宽占比拆进各自类型池。月结按平均分摊做实际归属，见 P07）。
// AI 专线与 BGP 三网共用同批出口；D-MAN 共享 BGP 电信出口；BGP 三网产品一单需选电信/联通/移动三条（同池只计一次）。
// 一对一运营商出口线路不在 ISP 本类——仅存在于转售业务（resale 类别转售线路条目，批发采购价直接结转）。
// 转售业务（resale 类别）：三大运营商线路 / 裸光纤 / 设备，转买转卖，成本 = 采购价直接结转。
/** 由条目绑定关系推导某产品类型的条目骨架（ops/tech 分组） */
function buildRows(m: DeliveryModeDef): { ops: string[]; tech: string[] } {
  const bound = ITEMS.filter((i) => i.modes.includes(m.key));
  return {
    ops: bound.filter((i) => i.dept === "ops").map((i) => i.key),
    tech: bound.filter((i) => i.dept === "tech").map((i) => i.key),
  };
}
/** 产品类型定义（ISP 互联网接入，统一成本核算模型） */
interface DeliveryModeDef {
  key: string;
  name: string;           // 产品类型名称
  resourceNote: string;   // 资源关联说明（出口资源搜索引导：该类应关联哪类资源档案）
}
export interface DeliveryMode extends DeliveryModeDef {
  rows: { ops: string[]; tech: string[] };   // 推导出的条目集合（绑定该产品类型的条目，按部门分组）
}

const MODE_DEFS: DeliveryModeDef[] = [
  { key: "PT-AI", name: "AI 专线", resourceNote: "出口资源与 BGP 三网相同：共享 BGP 电信/联通/移动出口（E-CT-1 / I-102 / I-103）" },
  { key: "PT-BGP", name: "BGP 三网互通", resourceNote: "出口资源选 BGP 三网出口：电信/联通/移动各一条（或多条）；成本并入 BGP 三网出口池统一计收" },
  { key: "PT-PON", name: "OPON", resourceNote: "出口资源选 PON 汇聚上联通道（归属 OPON 专属，如 PN-PON）" },
  { key: "PT-DMAN", name: "D-MAN", resourceNote: "出口资源选 BGP 电信出口（E-CT-1，与 BGP 三网互通共享）" },
  { key: "PT-DOM", name: "国内精品网", resourceNote: "出口资源选国内精品网出口（归属专属，如 I-101 / PN-DOM）" },
  { key: "PT-INTL", name: "国际精品网", resourceNote: "出口资源选国际精品网出口（境外运营商采购，如 PN-INTL）" },
];
export const MODES: DeliveryMode[] = MODE_DEFS.map((m) => ({ ...m, rows: buildRows(m) }));
