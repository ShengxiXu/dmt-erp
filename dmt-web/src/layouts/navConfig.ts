import {
  LayoutGrid, FileText, CheckSquare, Wrench, FolderOpen,
  Users, Lightbulb, Package, Boxes, Coins, Layers, Warehouse,
  FileSignature, ShoppingCart, ClipboardList, RefreshCcw, CalendarCheck,
  Building2, TrendingUp, ShieldCheck, Banknote, ReceiptText, Settings2, ListChecks,
  type LucideIcon,
} from 'lucide-vue-next'

export interface NavChild {
  to: string
  label: string
}

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  perm?: string
  /** 全员可见（审批中心/工作台等职能页面，配合服务端节点审批人校验） */
  open?: boolean
  children?: NavChild[]
}

export interface NavGroup {
  group: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    group: '概览',
    items: [
      { to: '/workbench', label: '工作台', icon: LayoutGrid, perm: 'workbench:view' },
      { to: '/analytics', label: '经营分析', icon: TrendingUp, perm: 'analytics:view' },
    ],
  },
  {
    group: '销售与合同',
    items: [
      { to: '/customer', label: '客户档案', icon: Users, perm: 'customer:list' },
      { to: '/opportunity', label: '商机管理', icon: Lightbulb, perm: 'opportunity:list' },
      { to: '/special', label: '特批申请', icon: FolderOpen, perm: 'special:list' },
      { to: '/contract', label: '合同管理', icon: FileSignature, perm: 'contract:list' },
    ],
  },
  {
    group: '产品与资源',
    items: [
      { to: '/product', label: '产品定义', icon: Package, perm: 'product:list' },
      { to: '/product/bom', label: '资源清单', icon: ListChecks, perm: 'product:list' },
      { to: '/materials', label: '资源目录', icon: Boxes },
      { to: '/cost-items', label: '成本条目库', icon: Layers, perm: 'cost-item:list' },
      { to: '/cost-centers', label: '成本中心', icon: Coins, perm: 'cost-center:list' },
      {
        to: '/resources/r1', label: '资源中心', icon: Warehouse, perm: 'resources:list',
        children: [
          { to: '/resources/r0', label: 'R0 出口池档案' },
          { to: '/resources/r1', label: 'R1 出口线路' },
          { to: '/resources/r2', label: 'R2 基础线路' },
          { to: '/resources/r3', label: 'R3 IP 地址' },
          { to: '/resources/r4', label: 'R4 设备库存' },
          { to: '/resources/chain-map', label: '成本怎么算' },
        ],
      },
    ],
  },
  {
    group: '采购与库存',
    items: [
      { to: '/purchase/reqs', label: '采购需求', icon: ClipboardList, perm: 'purchase:list' },
      { to: '/purchase/orders', label: '采购单', icon: ShoppingCart, perm: 'purchase:list' },
      { to: '/purchase/contracts', label: '采购合同', icon: FileText, perm: 'purchase:list' },
      { to: '/bills', label: '供应商账单', icon: ReceiptText, perm: 'purchase:list' },
    ],
  },
  {
    group: '交付与核算',
    items: [
      { to: '/approval', label: '审批中心', icon: CheckSquare, open: true },
      { to: '/delivery', label: '开通工单', icon: Wrench },
      { to: '/cost', label: '成本台账', icon: FileText },
    ],
  },
  {
    group: '财务',
    items: [
      { to: '/finance/claims', label: '回款认领', icon: Banknote, perm: 'finance:list' },
      { to: '/billing', label: '计费与出账', icon: FileText, perm: 'finance:list' },
      { to: '/finance/invoices', label: '开票管理', icon: FileSignature, perm: 'finance:list' },
      { to: '/pay-requests', label: '付款申请', icon: Coins, perm: 'finance:list' },
      { to: '/finance/overdue', label: '欠费与坏账', icon: ReceiptText, perm: 'finance:list' },
      { to: '/finance/settle', label: '月结', icon: CalendarCheck, perm: 'finance:list' },
      { to: '/lifecycle', label: '变更与退订', icon: RefreshCcw },
    ],
  },
  {
    group: '系统管理',
    items: [
      { to: '/system/departments', label: '部门管理', icon: Users },
      { to: '/system/users', label: '用户与角色', icon: ShieldCheck },
      { to: '/system/entities', label: '主体与印章', icon: Building2 },
      { to: '/system/settings', label: '策略中心', icon: Settings2 },
      { to: '/system/approval', label: '审批流配置', icon: CheckSquare },
    ],
  },
]
