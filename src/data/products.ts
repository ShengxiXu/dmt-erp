// 产品基础数据：产品类别 → 产品类型 → 规格字段模板（三级，逐页维护）
// 产品类型完整属性：状态（启用/停用）、SLA、计费周期、税率、标准交付周期、默认成本条目集合、规格字段模板
// 定价不在类型层维护：价格由订单行议价 + 套餐定价承载，类型只定义「卖什么、算什么」
// 系统管理域可维护：/product 三级页面增删改，合同订单行与成本核算实时读取本配置
// 规则：订单行「规格摘要」只能由本配置的结构化选项拼接，不允许自由输入
import { persistable } from "@/data/persist";
import { useSyncExternalStore } from "react";
import { ITEMS } from "./catalog";

export type SpecFieldType = "select" | "number" | "text" | "date" | "switch";

export interface SpecField {
  key: string;
  label: string;        // 拼进规格摘要的前缀，如 "带宽"/"IP"
  type: SpecFieldType;
  options?: string[];   // select 的可选项
  placeholder?: string; // number / text 的占位
  required?: boolean;   // 必填
}

export interface Plan {
  id: string;
  name: string;                    // 套餐名，如「标准版」
  price?: number;                  // 套餐价（元/月），可空
  values: Record<string, string>;  // 规格字段 key → 预设值（客户选套餐即带出）
  remark?: string;
}

/** 核算装配版本（《制造业口径》第五章）：装配变更自动升版本，存量合同绑定签订时版本不受影响 */
export interface AssemblyVer {
  v: number;
  date: string;
  items: string[];       // 该版本装配的条目 key 快照
  note?: string;
}

/** 物料库条目（独立主数据）：物料的通用定义，全行业产品共享。
 *  产品 BOM 不重复定义物料，只引用（libKey）+ 挂本产品自己的直接成本条目。
 *  注意：不带「取数档案 / 规格型号 / 单位 / 单价」——那些属于实例层（资源档案）或算账层（成本条目），
 *  物料只管产品由什么组成。 */
export interface MaterialDef {
  key: string;
  name: string;                       // 物料名，如：出口线路 / CPE 设备 / 安装调测服务
  form: "实物" | "服务化资源" | "人工服务";
  group?: string;                     // 物料分类（行业标准归档，便于物料库长大后的归类管理）
  status?: "启用" | "停用";           // 主数据不物理删除：停用后不可被新产品选用，已引用的 BOM 不受影响
  remark?: string;
  /** 采购口径：设置了该字段的物料会出现在「采购需求 → 需求类型」中（主数据驱动，不写死在页面）；
   *  kind = 带宽扩容（出口池扩容 → 原采购合同补充协议，不新建采购单）｜采购入库（走采购单 → 到货验收 → 入库） */
  purchase?: { kind: "带宽扩容" | "采购入库"; unit: string };
  /** 属性模板：本类实例档案（资源中心）的表单字段定义。类定义字段、实例填值；
   *  无档案的类可不定义（清单选用不受影响）。 */
  attrs?: FieldDef[];
}

/** 物料分类（行业标准归组；用户可按需扩展，表单支持自定义输入） */
export const MATERIAL_GROUPS = ["线路资源", "设备与备件", "机房设施", "IP 资源", "平台与外购服务", "交付服务"];

// ---------- 资源类属性模板（字段定义层） ----------
// 资源中心 R1~R4 档案页的表单字段不再写死在页面代码里，而由资源目录中「类」的属性模板驱动：
// 类定义字段（label/类型/选项/占位说明），档案实例填值。与产品类型的「规格字段模板」同一套思路。
// method: text 文本 | enum 枚举 | search 关联搜索 | region 省市区级联 | calc 计算值 | readonly 系统只读
export type FieldMethod = "text" | "enum" | "search" | "region" | "calc" | "readonly";
export interface FieldDef {
  key: string;
  label: string;
  method: FieldMethod;
  options?: string[];
  source?: string;      // search：数据来源档案说明
  placeholder?: string;
  withDetail?: boolean; // region：除省市区外是否附详细地址输入（路名门牌 / 机房楼宇等）
  dynamic?: boolean;    // true = ②层实时聚合，只读、不可手改
  numeric?: boolean;    // text 但只接受数字（如单价、地址数）
}

/** R1 出口线路档案字段模板（归属资源类：出口线路 mat_exit） */
const ATTRS_EXIT: FieldDef[] = [
  { key: "id", label: "资源编码", method: "readonly", placeholder: "系统生成（规则可配），如 E-CT-1 / I-101" },
  { key: "name", label: "线路名称", method: "text", placeholder: "命名：运营商-地域-带宽，见名知意" },
  { key: "product", label: "归属产品类型", method: "enum", options: ["AI 专线", "BGP 三网互通", "OPON", "D-MAN", "国内精品网", "国际精品网"], placeholder: "该出口归属的产品类型（决定按哪个产品类型的口径计收成本）" },
  { key: "sharedWith", label: "可共享产品类型", method: "text", options: ["AI 专线", "BGP 三网互通", "OPON", "D-MAN", "国内精品网", "国际精品网"], placeholder: "勾选「允许其他产品类型使用」后选择；不勾选 = 仅本类型 / 一家使用" },
  { key: "carrier", label: "运营商", method: "enum", options: ["电信", "联通", "移动", "境外运营商", "三方"] },
  { key: "region", label: "地域", method: "region", withDetail: true, placeholder: "机房 / 园区，如 漕河泾 / 张江" },
  { key: "contractNo", label: "采购合同", method: "search", source: "采购合同档案（下拉选择；无合同可手工填入，留痕）" },
  { key: "capacityM", label: "带宽容量(M)", method: "text", numeric: true, placeholder: "采购带宽（商用参考，不进核算）" },
  { key: "monthlyCost", label: "月租(元)", method: "text", numeric: true, placeholder: "向运营商采购的固定月租（与同类产品其他出口合并后计收）" },
  { key: "effect", label: "生效日期", method: "text", placeholder: "YYYY-MM-DD" },
  { key: "status", label: "状态", method: "readonly", placeholder: "系统流转：草稿/生效/停用" },
  { key: "usedM", label: "已售带宽(M)", method: "calc", dynamic: true, placeholder: "②层实时聚合：商用指标（池化计收基数），不进容量核算" },
  { key: "orders", label: "承载订单清单", method: "readonly", dynamic: true, placeholder: "②层：审批通过订单占用（池化计收基数明细）" },
];
/** R2 基础线路档案字段模板（mat_base） */
const ATTRS_BASE: FieldDef[] = [
  { key: "id", label: "线路编码", method: "readonly", placeholder: "系统生成，如 B-001" },
  { key: "name", label: "线路名称", method: "text", placeholder: "运营商-路由-带宽，见名知意（如 电信-上海↔北京-OTN波道10G）" },
  { key: "carrier", label: "运营商", method: "enum", options: ["电信", "联通", "移动", "三方"] },
  { key: "bwM", label: "带宽(M)", method: "text", numeric: true, placeholder: "线路容量（描述用，计价看整条月租）" },
  { key: "billing", label: "计费方式", method: "enum", options: ["周期性（月）", "一次性买断"] },
  { key: "price", label: "整条月租/买断价(元)", method: "text", numeric: true, placeholder: "向运营商租整条线路的月租（一条一单）" },
  { key: "contractNo", label: "采购合同", method: "search", source: "采购合同档案（下拉选择；无合同可手工填入，留痕）" },
  { key: "shareable", label: "可共用标记", method: "enum", options: ["是", "否"], placeholder: "跨产品类型共用本线时选「是」，共用行计 0" },
  { key: "effect", label: "生效日期", method: "text" },
  { key: "status", label: "状态", method: "readonly", placeholder: "草稿/生效/停用" },
  { key: "usedBy", label: "被占用情况", method: "readonly", dynamic: true, placeholder: "②层：被订单行关联情况" },
];
/** R3 IP 地址段档案字段模板（mat_ip） */
const ATTRS_IP: FieldDef[] = [
  { key: "id", label: "IP 编码", method: "readonly", placeholder: "按地址段自动生成，如 IP-58.40.0（规则可配）" },
  { key: "name", label: "地址段名称", method: "text", placeholder: "见名知意，如 漕河泾-精品网出口-01" },
  { key: "segment", label: "地址段 CIDR", method: "text", placeholder: "如 58.40.0.0/24；录入后点「检测冲突」核查" },
  { key: "total", label: "地址总数", method: "calc", placeholder: "按掩码自动计算，不可手填" },
  { key: "reserved", label: "保留地址数", method: "text", numeric: true, placeholder: "网关/广播等预留，默认 2；可用 = 总数 − 保留" },
  { key: "usable", label: "可用地址数", method: "calc", placeholder: "①层 = 总数 − 保留" },
  { key: "product", label: "归属产品类型", method: "enum", options: ["AI 专线", "BGP 三网互通", "OPON", "D-MAN", "国内精品网", "国际精品网"], placeholder: "先选产品类型，再以其为条件查询可关联的出口线路" },
  { key: "boundLines", label: "关联出口线路", method: "search", source: "R1 出口线路档案：仅列出归属该产品类型、或标记可共享给该类型的线路（先选上方产品类型）；一段可关联 1~2 条做冗余，已关联只增不删" },
  { key: "ipCat", label: "IP 地址分类", method: "enum", options: [], placeholder: "两级：客户分配 / 内部使用 + 二级类型（二级未来在系统内自行维护）" },
  { key: "unitPrice", label: "单价(元/个·月)", method: "text", numeric: true, placeholder: "A4 字典默认值可改" },
  { key: "source", label: "来源", method: "enum", options: ["自有", "运营商代播"] },
  { key: "remark", label: "备注", method: "text", placeholder: "自由填写：用途说明、切分约定、注意事项等" },
  { key: "status", label: "状态", method: "readonly", placeholder: "停用前须剩余 = 可用数（无订单占用）" },
  { key: "allocated", label: "已分配数", method: "calc", dynamic: true, placeholder: "②层实时累计" },
  { key: "remain", label: "剩余可用数", method: "calc", dynamic: true, placeholder: "②层 = 可用 − 已分配" },
  { key: "allocDetail", label: "分配明细", method: "readonly", dynamic: true, placeholder: "②层：占用订单清单" },
];
/** R4 设备库存档案字段模板（mat_dev） */
const ATTRS_DEV: FieldDef[] = [
  { key: "id", label: "设备编码", method: "readonly", placeholder: "系统生成" },
  { key: "name", label: "设备名称/型号", method: "text", placeholder: "品牌 + 型号，见名知意" },
  { key: "category", label: "设备类别", method: "enum", options: ["CPE", "光模块", "板卡", "服务器配件（网卡/HBA）"] },
  { key: "costPrice", label: "采购价(元)", method: "text", numeric: true, placeholder: "采购合同价，出库按此直接结转" },
  { key: "supplier", label: "供应商", method: "search", source: "供应商档案（手工兜底留痕）" },
  { key: "location", label: "存放地点", method: "region", withDetail: true, placeholder: "库房 / 机房名称，如 漕河泾仓库" },
  { key: "status", label: "状态", method: "readonly", placeholder: "在库/已出库/维修/报废" },
  { key: "stock", label: "现存量", method: "calc", dynamic: true, placeholder: "②层：入库+回收−出库" },
  { key: "locked", label: "锁定量", method: "calc", dynamic: true, placeholder: "②层：核算选中未出库（审批通过转出库）" },
  { key: "available", label: "可用量", method: "calc", dynamic: true, placeholder: "②层 = 现存量 − 锁定量" },
];
/** 产品 BOM 行：引用物料库的一项物料（libKey），直接成本条目挂在本行上（itemKeys 归本产品）。
 *  物料是「类」，资源档案里是「实例」：如「出口线路」物料 ↔ R1 档案里一条条具体的出口线路。 */
export interface Material {
  key: string;
  libKey: string;
  itemKeys: string[];
}

export interface ProductType {
  name: string;
  status: "启用" | "停用";
  sla?: string;          // 默认 SLA 等级（可空，待业务确认）
  billingCycle?: string; // 计费周期：月付 / 季付 / 年付 / 一次性（预留，可空）
  taxRate?: string;      // 税率（%，预留，可空）
  leadTime?: string;     // 标准交付周期（个工作日，预留，可空）
  materials?: Material[];            // 产品 BOM：引用物料库 + 挂直接成本条目
  directOff?: string[];             // 组成推导的直接成本中，被本产品单个剔除的条目 key（自动带出、可个别关闭）
  centers?: string[];               // 用到的成本中心（间接费用归集于此，月结按所选分法分配）
  costItems: string[];   // 装配条目并集（= 各物料直接条目 ∪ 所选成本中心归集的间接条目），核算单按此预置表单行
  asmVersion: number;    // 当前装配版本号（变更自动 +1）
  asmHistory: AssemblyVer[]; // 版本历史（只增不改）
  specFields: SpecField[];
  plans?: Plan[];        // 套餐：把客户常买的规格搭配打包定价（不改算账逻辑）
  updatedAt: string;
}

export interface ProductCat {
  name: string;
  remark?: string;
  types: ProductType[];
}

export const COST_ITEM_NAME = (key: string) => ITEMS.find((i) => i.key === key)?.name ?? key;

// ---------- 规格字段模板片段（预置复用） ----------
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

const ISP_FIELDS: SpecField[] = [
  { key: "bw", label: "带宽", type: "select", options: ["50M", "100M", "200M", "500M", "1G", "10G"], required: true },
  { key: "ip", label: "IP", type: "select", options: ["1 个", "4 个", "8 个", "16 个", "32 个", "64 个", "128 个", "256 个（一个 C）"] },
  { key: "line", label: "基础线路", type: "select", options: ["1 条", "2 条（冗余）"] },
];
const LINE_FIELDS: SpecField[] = [
  { key: "bw", label: "波道带宽", type: "select", options: ["10G", "100G"], required: true },
  { key: "route", label: "路由", type: "select", options: ["上海—北京", "上海—广州", "上海—深圳", "上海—成都", "上海—武汉"], required: true },
  { key: "line", label: "基础线路", type: "select", options: ["2 条（两端各一，固定）"] },
];
const SDWAN_FIELDS: SpecField[] = LINE_FIELDS;
const IDC_FIELDS: SpecField[] = [
  { key: "rack", label: "机柜", type: "select", options: ["10U", "20U", "半柜", "整柜 42U"], required: true },
  { key: "power", label: "电力", type: "select", options: ["3kW", "5kW", "10kW", "16kW"] },
];
const CLOUD_FIELDS: SpecField[] = [
  { key: "vm", label: "云主机", type: "number", placeholder: "台数", required: true },
  { key: "node", label: "节点", type: "select", options: ["上海漕河泾", "上海临港", "北京亦庄"] },
];
const SEC_FIELDS: SpecField[] = [
  { key: "svc", label: "服务项", type: "select", options: ["WAF（一对多订阅）", "等保测评", "渗透测试"], required: true },
  { key: "domain", label: "防护域名", type: "number", placeholder: "个数" },
];
const RESALE_FIELDS: SpecField[] = [
  { key: "carrier", label: "运营商", type: "select", options: ["电信", "联通", "移动"], required: true },
  { key: "bw", label: "带宽", type: "select", options: ["50M", "100M", "200M", "500M", "1G"] },
  { key: "form", label: "形态", type: "select", options: ["线路", "裸光纤", "设备"], required: true },
];

// ---------- 预置数据（v1.0，可在产品定义页修改） ----------
const T = (name: string, patch: Partial<ProductType>, fields: SpecField[]): ProductType => {
  const base: ProductType = {
    name, status: "启用", costItems: [], updatedAt: "2026-10-26", ...patch, specFields: clone(fields),
    asmVersion: 1,
    // 装配版本初始化：当前集合即 v1
    asmHistory: [{ v: 1, date: "2026-10-26", items: [...(patch.costItems ?? [])], note: "初始装配" }],
  };
  base.asmHistory[0].date = base.updatedAt;
  return base;
};

const ISP_COST = ["op1a", "op1b", "op6", "op4", "op8", "t1", "t4"];

/** 组成种子：产品由哪些资源组成（资源目录引用；直接成本由组成推导，不再逐个勾条目） */
const M = (libKey: string): Material => ({ key: `seed_${libKey}`, libKey, itemKeys: [] });
const ISP_MATS = ["mat_exit", "mat_base", "mat_ip", "mat_dev", "mat_svc"].map(M);
const LINE_MATS = ["mat_base", "mat_port", "mat_svc"].map(M);
const SDWAN_MATS = ["mat_base", "mat_svc"].map(M);
const IDC_MATS = ["mat_rack", "mat_svc"].map(M);

const cats: ProductCat[] = persistable("productCats", () => [
  {
    name: "ISP 互联网接入",
    remark: "共享出口：不同出口归属不同产品类型，AI 专线 / D-MAN 可共享 BGP 三网出口；一对一运营商线路仅存在于转售业务",
    types: [
      T("AI 专线", { sla: "99.99%", costItems: ISP_COST, materials: ISP_MATS, centers: ["CC-01"],
        plans: [
          { id: "plan_ai_std", name: "标准版", price: 3800, values: { bw: "100M", ip: "4 个", line: "1 条" }, remark: "中小客户主推" },
          { id: "plan_ai_pro", name: "尊享版", price: 6800, values: { bw: "200M", ip: "8 个", line: "1 条" }, remark: "含优先排障" },
        ] }, ISP_FIELDS),
      T("BGP 三网互通", { sla: "99.9%", costItems: ISP_COST, materials: ISP_MATS, centers: ["CC-01"] }, ISP_FIELDS),
      T("OPON", { costItems: ISP_COST, materials: ISP_MATS, centers: ["CC-01"] }, ISP_FIELDS),
      T("D-MAN", { costItems: ISP_COST, materials: ISP_MATS, centers: ["CC-01"] }, ISP_FIELDS),
      T("国内精品网", { costItems: ISP_COST, materials: ISP_MATS, centers: ["CC-01"] }, ISP_FIELDS),
      T("国际精品网", { sla: "99.9%", costItems: ISP_COST, materials: ISP_MATS, centers: ["CC-01"] }, ISP_FIELDS),
    ],
  },
  {
    name: "数据专线",
    remark: "OTN 长途波道 / SD-WAN 组网",
    types: [
      T("OTN", { costItems: ["op1a", "t1", "t3"], materials: LINE_MATS }, LINE_FIELDS),
      T("SD-WAN", { costItems: ["op1a", "t1"], materials: SDWAN_MATS }, SDWAN_FIELDS),
    ],
  },
  { name: "IDC", types: [T("机柜托管", { costItems: ["op5", "t1"], materials: IDC_MATS,
        plans: [{ id: "plan_idc_half", name: "半柜版", price: 4500, values: { rack: "半柜", power: "5kW" } }] }, IDC_FIELDS)] },
  { name: "云", types: [T("云主机", { costItems: ["t6", "t8", "t9"], materials: ["mat_cloud"].map(M), centers: ["CC-03", "CC-04"] }, CLOUD_FIELDS)] },
  { name: "安全服务", types: [T("WAF 等订阅服务", { costItems: ["op7", "t8"], materials: ["mat_3rdsvc"].map(M), centers: ["CC-03"] }, SEC_FIELDS)] },
  { name: "转售", remark: "三大运营商线路 / 裸光纤 / 设备，转买转卖直接结转", types: [T("运营商线路/裸光纤/设备转售", { costItems: ["rs1", "rs2"], materials: ["mat_resale"].map(M) }, RESALE_FIELDS)] },
]);

// ---------- 轻量 store：页面间共享 + 变更通知 ----------
let version = 0;
const listeners = new Set<() => void>();

export const getCats = () => cats;
export const subscribeCats = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const bump = () => {
  version += 1;
  listeners.forEach((fn) => fn());
};

/** 组件订阅目录变更（返回版本号触发重渲染，数据用 getCats() 读） */
export function useCatalog(): number {
  return useSyncExternalStore(subscribeCats, () => version);
}

// ---------- 物料库（独立主数据：物料的通用定义，产品 BOM 引用之） ----------
// 预置行业通用物料；用户可自行增改。删除已被引用的物料不会让 BOM 行消失，但行会标「物料库已删除」。
const matDefs: MaterialDef[] = persistable("materialDefs", () => [
  { key: "mat_exit", name: "出口线路", form: "服务化资源", group: "线路资源", status: "启用", remark: "向运营商采购的出口，可多家客户共享；BGP 调度平台、SLA 冗余池也算在这", attrs: ATTRS_EXIT, purchase: { kind: "带宽扩容", unit: "M" } },
  { key: "mat_base", name: "基础线路", form: "服务化资源", group: "线路资源", status: "启用", remark: "接入端线路：单客户专用，可跨产品共用不重复采购", attrs: ATTRS_BASE, purchase: { kind: "采购入库", unit: "条" } },
  { key: "mat_ip", name: "IP 地址段", form: "服务化资源", group: "IP 资源", status: "启用", remark: "随出口线路绑定的 IP 段", attrs: ATTRS_IP, purchase: { kind: "采购入库", unit: "段" } },
  { key: "mat_dev", name: "网络设备与备件", form: "实物", group: "设备与备件", status: "启用", remark: "CPE / 交换机等待库存设备，含板卡光模块", attrs: ATTRS_DEV, purchase: { kind: "采购入库", unit: "台" } },
  { key: "mat_rack", name: "机柜与电力", form: "服务化资源", group: "机房设施", status: "启用", remark: "IDC 托管的机柜、电力", purchase: { kind: "采购入库", unit: "柜" } },
  { key: "mat_port", name: "网内端口资源", form: "服务化资源", group: "线路资源", status: "启用", remark: "核心网上联端口 / OTN OTU 端口", purchase: { kind: "采购入库", unit: "个" } },
  { key: "mat_plat", name: "平台服务", form: "服务化资源", group: "平台与外购服务", status: "启用", remark: "BGP 调度、监控运维等平台订阅服务", purchase: { kind: "采购入库", unit: "套" } },
  { key: "mat_cloud", name: "云资源", form: "服务化资源", group: "平台与外购服务", status: "启用", remark: "云主机 / 节点、云节点设备折旧与软件许可", purchase: { kind: "采购入库", unit: "节点" } },
  { key: "mat_svc", name: "安装调测服务", form: "人工服务", group: "交付服务", status: "启用", remark: "交付实施人工投入；布线 / 物流 / 差旅等交付杂项也归这里" },
  { key: "mat_3rdsvc", name: "第三方服务订阅", form: "服务化资源", group: "平台与外购服务", status: "启用", remark: "DDoS 清洗、WAF 等外购服务", purchase: { kind: "采购入库", unit: "套" } },
  { key: "mat_resale", name: "转售采购资源", form: "服务化资源", remark: "转售业务：运营商线路 / 裸光纤 / 设备批发采购", purchase: { kind: "采购入库", unit: "条" } },
]);
// 旧快照回填：资源目录加「采购口径」之前的快照没有 purchase 字段，按物料默认口径补齐
const PURCHASE_DEFAULTS: Record<string, { kind: "带宽扩容" | "采购入库"; unit: string }> = {
  mat_exit: { kind: "带宽扩容", unit: "M" }, mat_ip: { kind: "采购入库", unit: "段" }, mat_dev: { kind: "采购入库", unit: "台" },
  mat_base: { kind: "采购入库", unit: "条" }, mat_rack: { kind: "采购入库", unit: "柜" }, mat_port: { kind: "采购入库", unit: "个" },
  mat_plat: { kind: "采购入库", unit: "套" }, mat_cloud: { kind: "采购入库", unit: "节点" }, mat_3rdsvc: { kind: "采购入库", unit: "套" },
  mat_resale: { kind: "采购入库", unit: "条" },
};
matDefs.forEach((m) => { if (!m.purchase && PURCHASE_DEFAULTS[m.key]) m.purchase = PURCHASE_DEFAULTS[m.key]; });

export const getMaterials = () => matDefs;
/** 按 libKey 取物料定义（BOM 行渲染用；引用已删除的物料返回 undefined） */
export const MAT_DEF = (libKey: string) => matDefs.find((m) => m.key === libKey);
/** 引用某物料的产品类型："cat / type" 列表 */
export const MAT_REFS = (libKey: string) =>
  cats.flatMap((c) => c.types.filter((t) => (t.materials ?? []).some((m) => m.libKey === libKey)).map((t) => `${c.name} / ${t.name}`));

/** 新增 / 更新物料（同 key 覆盖） */
export function saveMaterial(def: MaterialDef) {
  const i = matDefs.findIndex((m) => m.key === def.key);
  if (i >= 0) Object.assign(matDefs[i], def);
  else matDefs.push(def);
  bump();
}
/** 删除物料（BOM 引用行保留但标「物料库已删除」，引用数 > 0 时需页面二次确认） */
export function removeMaterial(key: string) {
  const i = matDefs.findIndex((m) => m.key === key);
  if (i >= 0) matDefs.splice(i, 1);
  bump();
}

// ---------- 类别维护 ----------
export function addCat(name: string) {
  if (cats.some((c) => c.name === name)) return false;
  cats.push({ name, types: [] });
  bump();
  return true;
}
export function removeCat(name: string) {
  const i = cats.findIndex((c) => c.name === name);
  if (i >= 0) cats.splice(i, 1);
  bump();
}
export function addType(catName: string, typeName: string) {
  const cat = cats.find((c) => c.name === catName);
  if (!cat || cat.types.some((t) => t.name === typeName)) return false;
  cat.types.push({ name: typeName, status: "启用", costItems: [], asmVersion: 1, asmHistory: [{ v: 1, date: "2026-10-26", items: [], note: "初始装配" }], updatedAt: "2026-10-26", specFields: [] });
  bump();
  return true;
}
export function removeType(catName: string, typeName: string) {
  const cat = cats.find((c) => c.name === catName);
  const i = cat?.types.findIndex((t) => t.name === typeName) ?? -1;
  if (cat && i >= 0) cat.types.splice(i, 1);
  bump();
}
/** 复制产品类型（含规格字段 / 成本条目），名称加「副本」后缀 */
export function duplicateType(catName: string, typeName: string) {
  const cat = cats.find((c) => c.name === catName);
  const src = cat?.types.find((t) => t.name === typeName);
  if (!cat || !src) return false;
  let n = 2;
  let newName = `${typeName}（副本${n > 2 ? n : ""}）`;
  while (cat.types.some((t) => t.name === newName)) {
    n += 1;
    newName = `${typeName}（副本${n}）`;
  }
  cat.types.push({ ...clone(src), name: newName, status: "停用", updatedAt: "2026-10-26" });
  bump();
  return true;
}
/** 更新某类别下某产品类型（name / status / sla / billingCycle / taxRate / leadTime / costItems / specFields）
 *  装配（costItems）变更自动升版本：旧版本快照入历史（只增不改），存量合同绑定签订时版本不受影响 */
export function updateType(catName: string, typeName: string, patch: Partial<ProductType>) {
  const t = cats.find((c) => c.name === catName)?.types.find((x) => x.name === typeName);
  if (!t) return;
  const asmChanged = patch.costItems != null && patch.costItems.join() !== t.costItems.join();
  if (!asmChanged) {
    Object.assign(t, patch, { updatedAt: "2026-10-26" });
  } else {
    const v = t.asmVersion + 1;
    Object.assign(t, patch, {
      asmVersion: v,
      asmHistory: [...t.asmHistory, { v, date: "2026-10-26", items: [...patch.costItems!], note: `装配调整（v${t.asmVersion} → v${v}）` }],
      updatedAt: "2026-10-26",
    });
  }
  bump();
}
/** 调整规格字段顺序（dir = -1 上移 / +1 下移） */
export function moveField(catName: string, typeName: string, index: number, dir: -1 | 1) {
  const t = cats.find((c) => c.name === catName)?.types.find((x) => x.name === typeName);
  if (!t) return;
  const j = index + dir;
  if (j < 0 || j >= t.specFields.length) return;
  const next = [...t.specFields];
  [next[index], next[j]] = [next[j], next[index]];
  updateType(catName, typeName, { specFields: next });
}

// ---------- 读取辅助 ----------
export const CATS = () => cats.map((c) => c.name);
/** 产品类型列表；includeDisabled=false 时仅返回「启用」（供合同起草等交易场景使用） */
export const PTYPES = (cat: string, includeDisabled = false) =>
  (cats.find((c) => c.name === cat)?.types ?? [])
    .filter((t) => includeDisabled || t.status === "启用")
    .map((t) => t.name);
export const GET_TYPE = (cat: string, ptype: string) =>
  cats.find((c) => c.name === cat)?.types.find((t) => t.name === ptype);
export const SPEC_FIELDS = (cat: string, ptype: string) => GET_TYPE(cat, ptype)?.specFields ?? [];
export const PLANS = (cat: string, ptype: string) => GET_TYPE(cat, ptype)?.plans ?? [];

/** 新增 / 更新套餐（同 id 覆盖） */
export function savePlan(cat: string, ptype: string, plan: Plan) {
  const t = GET_TYPE(cat, ptype);
  if (!t) return;
  const plans = t.plans ?? [];
  updateType(cat, ptype, { plans: plans.some((p) => p.id === plan.id) ? plans.map((p) => (p.id === plan.id ? plan : p)) : [...plans, plan] });
}
export function removePlan(cat: string, ptype: string, planId: string) {
  const t = GET_TYPE(cat, ptype);
  if (!t?.plans) return;
  updateType(cat, ptype, { plans: t.plans.filter((p) => p.id !== planId) });
}

/** 由结构化字段值拼出规格摘要，如「带宽 100M · IP 64 个 · 基础线路 1 条」 */
export function buildSpec(cat: string, ptype: string, specs: Record<string, string>): string {
  return SPEC_FIELDS(cat, ptype)
    .map((f) => (specs[f.key] ? `${f.label} ${specs[f.key]}` : ""))
    .filter(Boolean)
    .join(" · ");
}

/** 校验订单行规格是否满足必填（返回缺失字段 label 列表，空 = 通过） */
export function missingRequired(cat: string, ptype: string, specs: Record<string, string>): string[] {
  return SPEC_FIELDS(cat, ptype)
    .filter((f) => f.required && !(specs[f.key] ?? "").trim())
    .map((f) => f.label);
}
