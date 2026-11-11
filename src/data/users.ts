// 用户与角色（权限体系）：会话角色 / 角色权限（菜单粒度）/ 用户账号 / 部门
// 口径：
//   - 权限粒度 = 菜单 path（含子菜单），与 navConfig.ts 一一对应；导航过滤与路由守卫共用 allowed()
//   - 「角色」与「部门」是两个概念：角色 = 菜单权限 + 数据范围模板；部门 = 组织归属，挂在用户档案上
//   - 数据权限三档判定：仅本人 → 归属人 = 本人；本部门 → 归属人所在部门 = 本人所在部门（按用户档案 dept，不看角色）；全部 → 不限制
//   - 会话角色全局唯一（演示：顶栏/工作台切换，刷新保留）；正式环境对应登录用户的角色
//   - 角色、用户均持久化；权限矩阵调整即时生效（新发起的单据/下一次导航按最新权限）
import { useSyncExternalStore } from "react";
import { persistable } from "@/data/persist";
import { demoNow } from "@/data/settings";
import { notify } from "@/data/notices";
import { NAV_GROUPS } from "@/components/navConfig";

export interface Role {
  name: string;            // 角色名（唯一标识：业务支撑部 / 技术部 / 财务 / 管理层 / 销售部 / 系统管理员）—— 角色 ≠ 部门，部门挂在用户档案上
  desc: string;            // 职责说明
  menus: string[];         // 可见菜单 path（含子菜单）= 功能权限
  dataScope: DataScope;    // 数据权限：可见数据范围（本人 / 本部门 / 全部）
  builtin: boolean;        // 内置角色（不可删除；演示保留）
}
export type DataScope = "全部数据" | "本部门数据" | "仅本人数据";
export const DATA_SCOPE_DESC: Record<DataScope, string> = {
  全部数据: "可见全公司该模块的全部数据",
  本部门数据: "仅可见与本人同部门（按用户档案中的所属部门判定，与角色无关）成员名下的数据",
  仅本人数据: "仅可见本人名下的数据（客户/商机等的归属人 = 本人）",
};
/** 部门（组织归属）：挂在用户档案上，与角色解耦；数据权限中的「本部门」按此判定。
 *  部门主数据（可自定义维护）在 @/data/departments，此处仅保留类型；「本部门」按用户档案 dept 字段值判定，与主数据是否存在无关 */
export interface User {
  id: string;              // U-xxx
  name: string;
  role: string;            // 角色名（= Role.name）—— 决定菜单权限与数据范围模板
  dept: string;            // 所属部门（= DEPARTMENTS 之一）—— 决定「本部门数据」范围
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
  { name: "业务支撑部", desc: "交付运营主责：核算单填报、审批发起、开通工单协调、采购执行、应收跟进", builtin: true, dataScope: "全部数据",
    menus: ALL_PATHS.filter((p) => p !== "/system/users") },
  { name: "技术部", desc: "资源与实施：技术成本条目、资源分配与绑定、开通实施、到货入库、设备档案", builtin: true, dataScope: "全部数据",
    menus: ["/workbench", "/product", "/product/bom", "/materials", "/cost-items",
      "/resources/r1", "/resources/r2", "/resources/r3", "/resources/r4", "/resources/chain-map",
      "/purchase/reqs", "/purchase/orders", "/purchase/contracts", "/bills",
      "/", "/approval", "/delivery", "/cost", "/finance"] },
  { name: "财务", desc: "应收应付、开票收款、财务节点审批、月结跑批、欠费策略执行、坏账审批", builtin: true, dataScope: "全部数据",
    menus: ["/workbench", "/customer", "/contract", "/special", "/approval", "/cost",
      "/finance", "/finance/invoices", "/finance/payments", "/finance/overdue",
      "/billing", "/finance/settle", "/lifecycle", "/system/settings"] },
  { name: "管理层", desc: "经营视角：看全局指标、批大额度单据、审批流与策略查阅，不做日常录入", builtin: true, dataScope: "全部数据",
    menus: ALL_PATHS.filter((p) => p !== "/system/users") },
  { name: "销售部", desc: "售前与客情：客户、商机、特批、合同查阅；不进入核算与交付环节", builtin: true, dataScope: "仅本人数据",
    menus: ["/workbench", "/analytics", "/customer", "/opportunity", "/special", "/contract", "/finance"] },
  { name: "系统管理员", desc: "系统配置：用户与角色权限、审批流、策略参数、主体印章", builtin: true, dataScope: "全部数据",
    menus: ALL_PATHS },
]);

// ---------- 用户账号 ----------
export const USERS: User[] = persistable("users", () => [
  { id: "U-001", name: "许晟熙", role: "业务支撑部", dept: "业务支撑部", phone: "138-0000-0101", email: "xusx@dmt.example", status: "启用", lastLoginAt: "2026-11-10 08:52" },
  { id: "U-002", name: "张弛", role: "销售部", dept: "销售部", phone: "138-0000-0102", email: "zhangchi@dmt.example", status: "启用", lastLoginAt: "2026-11-09 18:20" },
  { id: "U-003", name: "李骁", role: "销售部", dept: "销售部", phone: "138-0000-0103", email: "lixiao@dmt.example", status: "启用", lastLoginAt: "2026-11-08 09:41" },
  { id: "U-004", name: "周远", role: "技术部", dept: "技术部", phone: "138-0000-0104", email: "zhouyuan@dmt.example", status: "启用", lastLoginAt: "2026-11-10 09:05" },
  { id: "U-005", name: "陈静", role: "财务", dept: "财务部", phone: "138-0000-0105", email: "chenjing@dmt.example", status: "启用", lastLoginAt: "2026-11-10 08:47" },
  { id: "U-006", name: "赵鹏", role: "管理层", dept: "综合管理部", phone: "138-0000-0106", email: "zhaopeng@dmt.example", status: "启用", lastLoginAt: "2026-11-07 14:12" },
  { id: "U-007", name: "王芳", role: "系统管理员", dept: "综合管理部", phone: "138-0000-0107", email: "wangfang@dmt.example", status: "启用", lastLoginAt: "2026-11-09 16:33" },
  { id: "U-008", name: "王敏", role: "技术部", dept: "技术部", phone: "138-0000-0108", email: "wangmin@dmt.example", status: "启用", lastLoginAt: "2026-11-06 11:26" },
]);

// ---------- 旧快照回填：用户补所属部门（部门与角色解耦前的快照没有 dept，按角色推断） ----------
const DEPT_BY_ROLE: Record<string, string> = { 业务支撑部: "业务支撑部", 技术部: "技术部", 财务: "财务部", 销售部: "销售部" };
USERS.forEach((u) => { if (!u.dept) u.dept = DEPT_BY_ROLE[u.role] ?? "综合管理部"; });

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

// ---------- 数据权限（旧快照回填：销售部默认仅本人，其余默认全部） ----------
ROLES.forEach((r) => {
  if (!r.dataScope) r.dataScope = r.name === "销售部" ? "仅本人数据" : "全部数据";
});

// ---------- 全局会话（当前演示角色） ----------
const sessionBox = persistable("session", () => ({ role: "业务支撑部" }));
let sVersion = 0;
const sListeners = new Set<() => void>();
const sBump = () => { sVersion += 1; sListeners.forEach((f) => f()); };
export const sessionRole = () => sessionBox.role;
export function setSessionRole(role: string) {
  sessionBox.role = role;
  sBump();
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
  log(`${patch.id ? "更新" : "新建"}账号「${patch.name}」（角色：${patch.role}）`);
  uBump();
}

export function toggleUserStatus(id: string) {
  const u = USERS.find((x) => x.id === id);
  if (u) {
    u.status = u.status === "启用" ? "停用" : "启用";
    log(`${u.status === "启用" ? "启用" : "停用"}账号「${u.name}」（${u.id}）`);
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
  sBump();
}

/** 批量勾选（按组全选/清空、快捷方案） */
export function setRoleMenus(roleName: string, paths: string[], on: boolean) {
  const r = ROLES.find((x) => x.name === roleName);
  if (!r) return;
  paths.forEach((p) => {
    const has = r.menus.includes(p);
    if (on && !has) r.menus.push(p);
    if (!on && has) r.menus.splice(r.menus.indexOf(p), 1);
  });
  notify({ level: "blue", group: "系统", title: "角色权限调整", text: `「${roleName}」批量${on ? "开通" : "关闭"} ${paths.length} 项菜单`, to: "/system/users", roles: ["系统管理员"] });
  sBump();
}

// ---------- 角色管理与操作日志 ----------
export interface PermLog { at: string; actor: string; action: string; }
export const PERM_LOGS: PermLog[] = persistable("permLogs", () => []);
const log = (action: string) => {
  PERM_LOGS.unshift({ at: demoNow(), actor: sessionBox.role, action });
  if (PERM_LOGS.length > 50) PERM_LOGS.length = 50; // 原地截断，保持快照引用稳定
};

export const roleMembers = (name: string) => USERS.filter((u) => u.role === name && u.status === "启用").length;

/** 新建 / 更新角色（oldName 存在 = 改名/改职责；改名同步迁移该角色下所有用户与会话） */
export function saveRole(patch: { oldName?: string; name: string; desc: string; dataScope?: DataScope }): string | null {
  const name = patch.name.trim();
  if (!name) return "角色名不能为空";
  if (patch.oldName) {
    const r = ROLES.find((x) => x.name === patch.oldName);
    if (!r) return "角色不存在";
    if (name !== patch.oldName && ROLES.some((x) => x.name === name)) return "角色名已存在";
    if (name !== patch.oldName) {
      USERS.forEach((u) => { if (u.role === patch.oldName) u.role = name; });
      if (sessionBox.role === patch.oldName) sessionBox.role = name;
      log(`角色「${patch.oldName}」更名为「${name}」`);
    }
    r.name = name;
    r.desc = patch.desc.trim() || r.desc;
    if (patch.dataScope) r.dataScope = patch.dataScope;
    log(`角色「${name}」资料更新（数据权限：${r.dataScope}）`);
  } else {
    if (ROLES.some((x) => x.name === name)) return "角色名已存在";
    ROLES.push({ name, desc: patch.desc.trim() || "（未填写职责说明）", builtin: false, dataScope: patch.dataScope ?? "全部数据", menus: ["/workbench"] });
    log(`新建角色「${name}」（数据权限：${patch.dataScope ?? "全部数据"}；默认仅工作台，请到权限矩阵配置菜单）`);
  }
  notify({ level: "blue", group: "系统", title: "角色变更", text: `角色「${name}」已${patch.oldName ? "更新" : "创建"}`, to: "/system/users", roles: ["系统管理员"] });
  sBump();
  uBump();
  return null;
}

/** 删除自定义角色（内置不可删；有成员不可删） */
export function deleteRole(name: string): string | null {
  const r = ROLES.find((x) => x.name === name);
  if (!r) return "角色不存在";
  if (r.builtin) return "内置角色不可删除";
  const n = USERS.filter((u) => u.role === name).length;
  if (n > 0) return `该角色下还有 ${n} 个账号，请先调整这些用户的角色`;
  const i = ROLES.findIndex((x) => x.name === name);
  ROLES.splice(i, 1);
  log(`删除角色「${name}」`);
  notify({ level: "orange", group: "系统", title: "角色已删除", text: `角色「${name}」已删除`, to: "/system/users", roles: ["系统管理员"] });
  sBump();
  return null;
}

/** 复制角色（菜单权限整套复制，快速派生新角色） */
export function duplicateRole(srcName: string, newName: string): string | null {
  const src = ROLES.find((x) => x.name === srcName);
  const name = newName.trim();
  if (!src) return "源角色不存在";
  if (!name) return "新角色名不能为空";
  if (ROLES.some((x) => x.name === name)) return "角色名已存在";
  ROLES.push({ name, desc: `${src.desc}（复制自「${srcName}」，可按需调整）`, builtin: false, dataScope: src.dataScope, menus: [...src.menus] });
  log(`复制角色「${srcName}」→ 新建「${name}」（${src.menus.length} 项菜单，数据权限：${src.dataScope}）`);
  notify({ level: "blue", group: "系统", title: "角色复制", text: `已由「${srcName}」复制创建「${name}」`, to: "/system/users", roles: ["系统管理员"] });
  sBump();
  return null;
}

// ---------- 数据权限判定 ----------
/** 演示身份：当前会话角色下第一个启用账号（正式环境 = 登录用户本人） */
export const currentUser = (): User | undefined => USERS.find((u) => u.role === sessionBox.role && u.status === "启用");
/** 指定角色（默认当前会话角色）的数据权限范围 */
export const dataScopeOf = (roleName?: string): DataScope =>
  ROLES.find((r) => r.name === (roleName ?? sessionBox.role))?.dataScope ?? "全部数据";
/**
 * 归属人是否在当前数据范围内。
 * 口径：全部数据 → 全可见；仅本人 → 归属人 = 当前演示身份；本部门 → 归属人所在部门 = 本人所在部门（按用户档案 dept 判定，与角色无关）；
 * 无归属人的记录仅「全部数据」可见（收敛默认，防越权）。
 */
export const deptOf = (name: string): string | undefined => USERS.find((u) => u.name === name)?.dept;
export function inDataScope(owner: string | undefined): boolean {
  const scope = dataScopeOf();
  if (scope === "全部数据") return true;
  if (!owner) return false;
  if (scope === "仅本人数据") return owner === currentUser()?.name;
  const cur = currentUser();
  return !!cur && deptOf(owner) === cur.dept;
}
/** 数据范围横幅文案（列表页头提示用；全部数据返回 null 不显示） */
export function scopeBanner(hidden: number): string | null {
  const scope = dataScopeOf();
  if (scope === "全部数据") return null;
  const who = scope === "仅本人数据" ? `当前身份：${currentUser()?.name ?? "—"}` : `当前部门：${currentUser()?.dept ?? "—"}`;
  return `数据范围：${scope} · ${who}${hidden > 0 ? ` · 已隐藏 ${hidden} 条范围外数据` : ""}`;
}
