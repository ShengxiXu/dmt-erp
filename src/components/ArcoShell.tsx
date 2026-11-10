import { createContext, useContext, useState, type ReactNode } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { ShieldAlert } from "lucide-react";
import { DEMO_TODAY } from "@/data/settings";
import { ChevronRight, ChevronDown } from "lucide-react";
import { SHEETS } from "@/data/sheets";
import GlobalSearch from "@/components/GlobalSearch";
import NoticeBell from "@/components/NoticeBell";
import { NAV_GROUPS } from "@/components/navConfig";
import { currentRole, pathAllowed, useSessionRole } from "@/data/users";

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
 * 权限：菜单按当前角色过滤；直达无权限的 URL 由路由守卫拦截。
 */
export function ShellLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [crumb, setCrumb] = useState("工作台");
  useSessionRole(); // 角色切换即时重渲染导航与守卫
  const role = currentRole();
  const pendingCount = SHEETS.filter((s) => s.status === "审批中").length;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const wd = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date(`${DEMO_TODAY}T00:00:00`).getDay()];
  const dateStr = `${DEMO_TODAY} ${wd}`;

  // 菜单可见性：自身命中授权，或有任一子菜单命中（父级展示、子级再过滤）
  const canSee = (to: string, children?: { to: string }[]) =>
    pathAllowed(role.menus, to) || (children?.some((c) => pathAllowed(role.menus, c.to)) ?? false);

  // 路由守卫：通知中心与工作台全员可用；其余按角色菜单鉴权
  const guardOk = pathname === "/workbench" || pathname === "/notifications" || pathAllowed(role.menus, pathname);

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
          {NAV_GROUPS.map((g) => {
            const items = g.items.filter((n) => canSee(n.to, n.children));
            if (!items.length) return null;
            return (
            <div key={g.group} className="mb-2">
              <div className="px-3 pb-1 pt-2 text-[12px] text-[#86909C]">{g.group}</div>
              {items.map((n) => {
                const hasChildren = !!n.children?.length;
                const visibleChildren = (n.children ?? []).filter((c) => pathAllowed(role.menus, c.to));
                const childActive = visibleChildren.some((c) => pathname === c.to || pathname.startsWith(c.to));
                const active = n.to === "/" ? pathname === "/" : (pathname === n.to || !!childActive);
                const badge = n.label === "审批中心" ? pendingCount : 0;
                const open = openGroups[n.to] ?? !!childActive;
                return (
                  <div key={n.to}>
                    <div className={`mb-0.5 flex h-10 items-center gap-2.5 rounded-[2px] pr-2 transition-colors ${
                      active ? "bg-[#F2F3F5] font-medium text-[#165DFF]" : "text-[#4E5969] hover:bg-[#F7F8FA]"
                    }`}>
                      <Link to={n.to} className="flex h-full flex-1 items-center gap-2.5 px-3 text-[14px]">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(() => { const Icon = n.icon as any; return <Icon size={16} strokeWidth={1.8} />; })()}
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
                    {hasChildren && open && visibleChildren.map((c) => (
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
            );
          })}
        </nav>

        <div className="border-t border-[#F2F3F5] p-3">
          <div className="flex items-center gap-2.5 px-1">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] text-[13px] font-medium text-white shadow-md">许</span>
            <div className="text-[12px] leading-tight">
              <div className="font-medium text-[#1D2129]">许晟熙</div>
              <div className="mt-0.5 flex items-center gap-1 text-[#86909C]">
                <span>{role.name}</span>
                <button onClick={() => navigate("/workbench")} title="到工作台切换演示角色" className="rounded-[2px] border border-[#E5E6EB] px-1 text-[10px] text-[#165DFF] hover:bg-[#F0F5FF]">切换</button>
              </div>
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
            <span className="hidden rounded-[2px] bg-[#F0F5FF] px-1.5 py-0.5 text-[11px] text-[#165DFF] lg:block">{role.name}</span>
            <span className="hidden text-[13px] tabular-nums text-[#86909C] lg:block">{dateStr}</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] text-[13px] font-medium text-white shadow-md ring-2 ring-white">许</span>
          </div>
        </header>
        <BreadcrumbCtx.Provider value={crumb}>
          <SetBreadcrumbCtx.Provider value={setCrumb}>
            {guardOk ? (
              <Outlet />
            ) : (
              <main className="flex min-h-[70vh] items-center justify-center p-6">
                <div className="w-[420px] rounded-[8px] border border-[#E5E6EB] bg-white p-8 text-center shadow-sm">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FFECE8] text-[#F53F3F]"><ShieldAlert size={22} /></span>
                  <div className="mt-3 text-[15px] font-semibold text-[#1D2129]">当前角色无权访问该页面</div>
                  <div className="mt-1.5 text-[12px] leading-5 text-[#86909C]">
                    你正以「{role.name}」身份查看系统，该角色未开通「{crumb}」的菜单权限。
                    如需访问，请联系系统管理员（用户与角色 → 权限矩阵）开通，或切换演示角色。
                  </div>
                  <div className="mt-4 flex justify-center gap-2">
                    <button onClick={() => navigate("/workbench")} className="rounded-[2px] bg-[#165DFF] px-3 py-1.5 text-[12px] text-white hover:bg-[#4080FF]">返回工作台</button>
                    <button onClick={() => navigate("/system/users")} className="rounded-[2px] border border-[#E5E6EB] px-3 py-1.5 text-[12px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">查看权限矩阵</button>
                  </div>
                </div>
              </main>
            )}
          </SetBreadcrumbCtx.Provider>
        </BreadcrumbCtx.Provider>
      </div>
    </div>
  );
}
