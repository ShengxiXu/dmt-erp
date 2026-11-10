// 导航配置（分组）：ArcoShell 侧边栏与用户/角色权限矩阵共用的唯一出处
// 权限粒度 = 菜单 path（含子菜单）；角色可见性过滤与路由守卫都以这里为准
import {
  LayoutGrid, FileText, Calculator, CheckSquare, Wrench, FolderOpen, ReceiptText,
  Users, Lightbulb, Package, ListChecks, Boxes, Coins, Layers, Warehouse,
  FileSignature, ShoppingCart, ClipboardList, RefreshCcw, CalendarCheck,
  Settings2, Building2, TrendingUp, Wallet, ShieldCheck, Banknote,
} from "lucide-react";

export interface NavChild { to: string; label: string }
export interface NavItem { to: string; label: string; icon: unknown; children?: NavChild[] }

export const NAV_GROUPS: { group: string; items: NavItem[] }[] = [
  {
    group: "概览",
    items: [
      { to: "/workbench", label: "工作台", icon: LayoutGrid },
      { to: "/analytics", label: "经营分析", icon: TrendingUp },
    ],
  },
  {
    group: "销售与合同",
    items: [
      { to: "/customer", label: "客户档案", icon: Users },
      { to: "/opportunity", label: "商机管理", icon: Lightbulb },
      { to: "/special", label: "特批申请", icon: FolderOpen },
      { to: "/contract", label: "合同管理", icon: FileSignature },
    ],
  },
  {
    group: "产品与资源",
    items: [
      { to: "/product", label: "产品定义", icon: Package },
      { to: "/product/bom", label: "资源清单", icon: ListChecks },
      { to: "/materials", label: "资源目录", icon: Boxes },
      { to: "/cost-items", label: "成本条目库", icon: Layers },
      { to: "/cost-centers", label: "成本中心", icon: Coins },
      {
        to: "/resources/r1", label: "资源中心", icon: Warehouse,
        children: [
          { to: "/resources/r1", label: "R1 出口资源池" },
          { to: "/resources/r2", label: "R2 基础线路" },
          { to: "/resources/r3", label: "R3 IP 地址" },
          { to: "/resources/r4", label: "R4 设备库存" },
          { to: "/resources/chain-map", label: "成本怎么算" },
        ],
      },
    ],
  },
  {
    group: "采购与库存",
    items: [
      { to: "/purchase/reqs", label: "采购需求", icon: ClipboardList },
      { to: "/purchase/orders", label: "采购单", icon: ShoppingCart },
      { to: "/purchase/contracts", label: "采购合同", icon: FileText },
      { to: "/bills", label: "供应商账单", icon: ReceiptText },
    ],
  },
  {
    group: "交付与核算",
    items: [
      { to: "/", label: "核算单录入", icon: Calculator },
      { to: "/approval", label: "审批中心", icon: CheckSquare },
      { to: "/delivery", label: "开通工单", icon: Wrench },
      { to: "/cost", label: "成本台账", icon: FileText },
    ],
  },
  {
    group: "财务",
    items: [
      { to: "/finance", label: "财务中心", icon: Wallet,
        children: [
          { to: "/finance/invoices", label: "开票管理（旧）" },
          { to: "/finance/payments", label: "收款管理（旧）" },
          { to: "/finance/overdue", label: "欠费与坏账（旧）" },
        ] },
      { to: "/billing", label: "计费与出账", icon: ReceiptText },
      { to: "/finance/claims", label: "回款认领", icon: Banknote },
      { to: "/finance/settle", label: "月结", icon: CalendarCheck },
      { to: "/lifecycle", label: "变更与退订", icon: RefreshCcw },
    ],
  },
  {
    group: "系统管理",
    items: [
      { to: "/system/users", label: "用户与角色", icon: ShieldCheck },
      { to: "/system/entities", label: "主体与印章", icon: Building2 },
      { to: "/system/settings", label: "策略中心", icon: Settings2 },
      { to: "/system/approval", label: "审批流配置", icon: CheckSquare },
    ],
  },
];
