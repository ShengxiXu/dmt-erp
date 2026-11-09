import { createContext, useContext, useState, type ReactNode } from "react";
import { Link, Outlet, useLocation } from "react-router";
import {
  LayoutGrid, FileText, Calculator, CheckSquare, Wrench, FolderOpen, ReceiptText, Receipt,
  Users, Lightbulb, Package, ListChecks, Boxes, Coins, Layers, Warehouse, CircleAlert,
  FileSignature, ShoppingCart, ClipboardList, Landmark, RefreshCcw, CalendarCheck,
  Settings2, Building2, ChevronRight, ChevronDown, TrendingUp, Wallet,
} from "lucide-react";
import { SHEETS } from "@/data/sheets";
import GlobalSearch from "@/components/GlobalSearch";
import NoticeBell from "@/components/NoticeBell";

/** 导航配置（分组） */
const NAV_GROUPS = [
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
          { to: "/finance/invoices", label: "开票管理（旧）", icon: Receipt },
          { to: "/finance/payments", label: "收款管理（旧）", icon: Landmark },
          { to: "/finance/overdue", label: "欠费与坏账（旧）", icon: CircleAlert },
        ] },
      { to: "/billing", label: "计费与出账", icon: ReceiptText },
      { to: "/finance/settle", label: "月结", icon: CalendarCheck },
      { to: "/lifecycle", label: "变更与退订", icon: RefreshCcw },
    ],
  },
  {
    group: "系统管理",
    items: [
      { to: "/system/entities", label: "主体与印章", icon: Building2 },
      { to: "/system/settings", label: "策略中心", icon: Settings2 },
      { to: "/system/approval", label: "审批流配置", icon: CheckSquare },
    ],
  },
];

/** 面包屑上下文：ShellLayout 持有状态并下发 setter，页面在渲染期写入，顶栏同帧刷新 */
const BreadcrumbCtx = createContext<string>("工作台");
const SetBreadcrumbCtx = createContext<(b: string) => void>(() => {});

/**
 * 透明壳：页面里的 <ArcoShell breadcrumb="..."> 不再渲染侧边栏/顶栏，
 * 只负责把面包屑注册到 persistent 布局（渲染期同步写入，无闪烁）。
 */
export default function ArcoShell({ breadcrumb, userRole: _userRole, children }: { breadcrumb: string; userRole?: string; children: ReactNode }) {
  const cur = useContext(BreadcrumbCtx);
  const setCrumb = useContext(SetBreadcrumbCtx);
  if (cur !== breadcrumb) setCrumb(breadcrumb); // 渲染期调整状态：React 在提交前同步重渲染 ShellLayout
  return <>{children}</>;
}

/**
 * 持久布局：侧边栏 + 顶栏只挂载一次，路由切换只换右侧内容，
 * 导航不再整页重建（分组展开状态、滚动位置都保留）。
 */
export function ShellLayout() {
  const { pathname } = useLocation();
  const [crumb, setCrumb] = useState("工作台");
  const pendingCount = SHEETS.filter((s) => s.status === "审批中").length;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const now = new Date();
  const wd = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][now.getDay()];
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${wd}`;

  return (
    <div className="flex min-h-screen bg-[#F7F8FA] text-[#1D2129]"
      style={{ fontFamily: 'Inter, -apple-system, "PingFang SC", "Hiragino Sans GB", "noto sans", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif' }}>
      <aside className="fixed inset-y-0 z-30 flex w-[220px] flex-col border-r border-[#E5E6EB] bg-white">
        <div className="flex h-14 items-center gap-2.5 border-b border-[#F2F3F5] px-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] text-sm font-bold text-white shadow-md">D</span>
          <div className="leading-tight">
            <div className="text-[14px] font-semibold">DMT-ERP</div>
            <div className="text-[11px] text-[#86909C]">交付与核算系统</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV_GROUPS.map((g) => (
            <div key={g.group} className="mb-2">
              <div className="px-3 pb-1 pt-2 text-[12px] text-[#86909C]">{g.group}</div>
              {g.items.map((n) => {
                const hasChildren = !!n.children?.length;
                const childActive = n.children?.some((c) => pathname === c.to || pathname.startsWith(c.to));
                const active = n.to === "/" ? pathname === "/" : (pathname === n.to || !!childActive);
                const badge = n.label === "审批中心" ? pendingCount : 0;
                const open = openGroups[n.to] ?? !!childActive;
                return (
                  <div key={n.to}>
                    <div className={`mb-0.5 flex h-10 items-center gap-2.5 rounded-[2px] pr-2 transition-colors ${
                      active ? "bg-[#F2F3F5] font-medium text-[#165DFF]" : "text-[#4E5969] hover:bg-[#F7F8FA]"
                    }`}>
                      <Link to={n.to} className="flex h-full flex-1 items-center gap-2.5 px-3 text-[14px]">
                        <n.icon size={16} strokeWidth={1.8} />
                        {n.label}
                        {badge > 0 && (
                          <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-[#F53F3F] px-1 text-[11px] text-white">{badge}</span>
                        )}
                      </Link>
                      {hasChildren && (
                        <button onClick={() => setOpenGroups((s) => ({ ...s, [n.to]: !open }))} className="rounded-[2px] p-0.5 text-[#86909C] hover:bg-[#E5E6EB]">
                          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      )}
                    </div>
                    {hasChildren && open && n.children!.map((c) => (
                      <Link key={c.to} to={c.to}
                        className={`mb-0.5 flex h-9 items-center gap-2 rounded-[2px] py-1 pl-9 pr-3 text-[13px] transition-colors ${
                          pathname === c.to ? "font-medium text-[#165DFF]" : "text-[#4E5969] hover:bg-[#F7F8FA]"
                        }`}>
                        <span className={`h-1 w-1 rounded-full ${pathname === c.to ? "bg-[#165DFF]" : "bg-[#C9CDD4]"}`} />
                        {c.label}
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-[#F2F3F5] p-3">
          <div className="flex items-center gap-2.5 px-1">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] text-[13px] font-medium text-white shadow-md">许</span>
            <div className="text-[12px] leading-tight">
              <div className="font-medium text-[#1D2129]">许晟熙</div>
              <div className="mt-0.5 text-[#86909C]">业务支撑部</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="ml-[220px] flex-1">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-[#E5E6EB] bg-white px-6">
          <div className="flex items-center gap-1.5 text-[14px]">
            <span className="text-[#86909C]">首页</span>
            <ChevronRight size={14} className="text-[#C9CDD4]" />
            <span className="text-[#1D2129]">{crumb}</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <GlobalSearch />
            <NoticeBell />
            <span className="hidden text-[13px] tabular-nums text-[#86909C] lg:block">{dateStr}</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] text-[13px] font-medium text-white shadow-md ring-2 ring-white">许</span>
          </div>
        </header>
        <BreadcrumbCtx.Provider value={crumb}>
          <SetBreadcrumbCtx.Provider value={setCrumb}>
            <Outlet />
          </SetBreadcrumbCtx.Provider>
        </BreadcrumbCtx.Provider>
      </div>
    </div>
  );
}
