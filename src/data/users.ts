// 用户与角色（权限体系）：会话角色 / 角色权限（菜单粒度）/ 用户账号
// 口径：
//   - 权限粒度 = 菜单 path（含子菜单），与 navConfig.ts 一一对应；导航过滤与路由守卫共用 allowed()
//   - 会话角色全局唯一（演示：顶栏/工作台切换，刷新保留）；正式环境对应登录用户的角色
//   - 角色、用户均持久化；权限矩阵调整即时生效（新发起的单据/下一次导航按最新权限）
import { useSyncExternalStore } from "react";
import { persistable } from "@/data/persist";
import { demoNow } from "@/data/settings";
import { notify } from "@/data/notices";
import { NAV_GROUPS } from "@/components/navConfig";

export interface Role {
  name: string;            // 角色名（唯一标识：业务支撑部 / 技术部 / 财务 / 管理层 / 销售部 / 系统管理员）
  desc: string;            // 职责说明
  menus: string[];         // 可见菜单 path（含子菜单）
  builtin: boolean;        // 内置角色（不可删除；演示保留）
}
export interface User {
  id: string;              // U-xxx
  name: string;
  role: string;            // 角色名（= Role.name）
  phone: string;
  email?: string;
  status: "启用" | "停用";
  lastLoginAt: string;
}

// ---------- 全量菜单（权限矩阵的行） ----------
const seen = new Map<string, { to: string; label: string; group: string }>();
for (const g of NAV_GROUPS) {
  for (const n of g.items) {
    if (!seen.has(n.to)) seen.set(n.to, { to: n.to, label: n.label, group: g.group });
    for (const c of n.children ?? []) {
      if (!seen.has(c.to)) seen.set(c.to, { to: c.to, label: `${n.label} / ${c.label}`, group: g.group });
    }
  }
}
export const ALL_MENUS = [...seen.values()];
const ALL_PATHS = ALL_MENUS.map((m) => m.to);

/** 路径是否命中菜单授权（"/" 仅精确匹配；其余支持前缀匹配详情页） */
export function pathAllowed(menus: string[], path: string): boolean {
  return menus.some((m) => (m === "/" ? path === "/" : path === m || path.startsWith(m + "/")));
}

// ---------- 角色（内置，可改权限不可删） ----------
export const ROLES: Role[] = persistable("roles", () => [
  { name: "业务支撑部", desc: "交付运营主责：核算单填报、审批发起、开通工单协调、采购执行、应收跟进", builtin: true,
    menus: ALL_PATHS.filter((p) => p !== "/system/users") },
  { name: "技术部", desc: "资源与实施：技术成本条目、资源分配与绑定、开通实施、到货入库、设备档案", builtin: true,
    menus: ["/workbench", "/product", "/product/bom", "/materials", "/cost-items",
      "/resources/r1", "/resources/r2", "/resources/r3", "/resources/r4", "/resources/chain-map",
      "/purchase/reqs", "/purchase/orders", "/purchase/contracts", "/bills",
      "/", "/approval", "/delivery", "/cost", "/finance"] },
  { name: "财务", desc: "应收应付、开票收款、财务节点审批、月结跑批、欠费策略执行、坏账审批", builtin: true,
    menus: ["/workbench", "/customer", "/contract", "/special", "/approval", "/cost",
      "/finance", "/finance/invoices", "/finance/payments", "/finance/overdue",
      "/billing", "/finance/settle", "/lifecycle", "/system/settings"] },
  { name: "管理层", desc: "经营视角：看全局指标、批大额度单据、审批流与策略查阅，不做日常录入", builtin: true,
    menus: ALL_PATHS.filter((p) => p !== "/system/users") },
  { name: "销售部", desc: "售前与客情：客户、商机、特批、合同查阅；不进入核算与交付环节", builtin: true,
    menus: ["/workbench", "/analytics", "/customer", "/opportunity", "/special", "/contract", "/finance"] },
  { name: "系统管理员", desc: "系统配置：用户与角色权限、审批流、策略参数、主体印章", builtin: true,
    menus: ALL_PATHS },
]);

// ---------- 用户账号 ----------
export const USERS: User[] = persistable("users", () => [
  { id: "U-001", name: "许晟熙", role: "业务支撑部", phone: "138-0000-0101", email: "xusx@dmt.example", status: "启用", lastLoginAt: "2026-11-10 08:52" },
  { id: "U-002", name: "张弛", role: "销售部", phone: "138-0000-0102", email: "zhangchi@dmt.example", status: "启用", lastLoginAt: "2026-11-09 18:20" },
  { id: "U-003", name: "李骁", role: "销售部", phone: "138-0000-0103", email: "lixiao@dmt.example", status: "启用", lastLoginAt: "2026-11-08 09:41" },
  { id: "U-004", name: "周远", role: "技术部", phone: "138-0000-0104", email: "zhouyuan@dmt.example", status: "启用", lastLoginAt: "2026-11-10 09:05" },
  { id: "U-005", name: "陈静", role: "财务", phone: "138-0000-0105", email: "chenjing@dmt.example", status: "启用", lastLoginAt: "2026-11-10 08:47" },
  { id: "U-006", name: "赵鹏", role: "管理层", phone: "138-0000-0106", email: "zhaopeng@dmt.example", status: "启用", lastLoginAt: "2026-11-07 14:12" },
  { id: "U-007", name: "王芳", role: "系统管理员", phone: "138-0000-0107", email: "wangfang@dmt.example", status: "启用", lastLoginAt: "2026-11-09 16:33" },
  { id: "U-008", name: "王敏", role: "技术部", phone: "138-0000-0108", email: "wangmin@dmt.example", status: "启用", lastLoginAt: "2026-11-06 11:26" },
]);

// ---------- 兼容旧快照：版本新增菜单的回填（老快照角色 menus 里没有后加的 path） ----------
const backfill = (roleName: string, paths: string[]) => {
  const r = ROLES.find((x) => x.name === roleName);
  if (!r) return;
  paths.forEach((p) => {
    if (!r.menus.includes(p)) r.menus.push(p);
  });
};
backfill("系统管理员", ALL_PATHS);
backfill("业务支撑部", ALL_PATHS.filter((p) => p !== "/system/users"));
backfill("管理层", ALL_PATHS.filter((p) => p !== "/system/users"));
backfill("财务", ["/finance/claims"]);

// ---------- 全局会话（当前演示角色） ----------
const sessionBox = persistable("session", () => ({ role: "业务支撑部" }));
let sVersion = 0;
const sListeners = new Set<() => void>();
export const sessionRole = () => sessionBox.role;
export function setSessionRole(role: string) {
  sessionBox.role = role;
  sVersion += 1;
  sListeners.forEach((f) => f());
}
export function useSessionRole(): string {
  useSyncExternalStore(
    (fn) => {
      sListeners.add(fn);
      return () => sListeners.delete(fn);
    },
    () => sVersion
  );
  return sessionBox.role;
}
export const currentRole = () => ROLES.find((r) => r.name === sessionBox.role) ?? ROLES[0];

// ---------- 用户 store ----------
let uVersion = 0;
const uListeners = new Set<() => void>();
const uBump = () => {
  uVersion += 1;
  uListeners.forEach((f) => f());
};
export const useUsers = (): number =>
  useSyncExternalStore(
    (fn) => {
      uListeners.add(fn);
      return () => uListeners.delete(fn);
    },
    () => uVersion
  );

/** 新建 / 更新用户（同 id 覆盖，原地写保证快照稳定） */
export function saveUser(patch: Omit<User, "id" | "lastLoginAt"> & { id?: string; lastLoginAt?: string }) {
  if (patch.id) {
    const u = USERS.find((x) => x.id === patch.id);
    if (u) Object.assign(u, patch);
  } else {
    USERS.unshift({ ...patch, id: `U-${String(USERS.length + 1).padStart(3, "0")}`, lastLoginAt: demoNow() });
  }
  notify({ level: "blue", group: "系统", title: "用户账号变更", text: `${patch.name}（${patch.role}）账号已${patch.id ? "更新" : "创建"}`, to: "/system/users", roles: ["系统管理员"] });
  uBump();
}

export function toggleUserStatus(id: string) {
  const u = USERS.find((x) => x.id === id);
  if (u) {
    u.status = u.status === "启用" ? "停用" : "启用";
    uBump();
  }
}

/** 权限矩阵勾选/取消（原地改角色 menus，持久化即时生效） */
export function setRoleMenu(roleName: string, menu: string, on: boolean) {
  const r = ROLES.find((x) => x.name === roleName);
  if (!r) return;
  const has = r.menus.includes(menu);
  if (on && !has) r.menus.push(menu);
  if (!on && has) {
    const i = r.menus.indexOf(menu);
    if (i >= 0) r.menus.splice(i, 1); // 原地删，保证快照引用稳定
  }
  notify({ level: "blue", group: "系统", title: "角色权限调整", text: `「${roleName}」${on ? "开通" : "关闭"}菜单「${ALL_MENUS.find((m) => m.to === menu)?.label ?? menu}」`, to: "/system/users", roles: ["系统管理员"] });
  sVersion += 1;
  sListeners.forEach((f) => f());
}
