// 部门主数据：组织归属的可维护台账（原来写死在代码里的 DEPARTMENTS 常量）
// 联动关系：用户档案.dept / 数据权限「本部门」判定 / 审批链「部门负责人」节点 / 部门负责人解析 全部读这份主数据
// 口径：部门 ≠ 角色。改名同步迁移用户档案；有成员或内置的部门不可删；停用后不可再分配给新用户，历史数据不受影响
import { useSyncExternalStore } from "react";
import { persistable } from "@/data/persist";
import { demoNow } from "@/data/settings";
import { notify } from "@/data/notices";
import { USERS } from "@/data/users";

export interface Department {
  name: string;             // 部门名（唯一标识）
  leader?: string;          // 部门负责人（= 用户姓名；审批链「部门负责人」节点按此解析，空则按部门内第一个启用账号兜底）
  note?: string;            // 职责说明
  builtin: boolean;         // 内置部门（不可删除；演示保留）
  status: "启用" | "停用";
  updatedAt: string;
}

export const DEPTS: Department[] = persistable("departments", () => [
  { name: "业务支撑部", leader: "许晟熙", note: "交付运营主责：核算填报、审批发起、开通协调、采购执行", builtin: true, status: "启用", updatedAt: "2026-10-20 14:00" },
  { name: "技术部", leader: "赵鹏", note: "资源与实施：技术成本条目、资源分配绑定、开通实施", builtin: true, status: "启用", updatedAt: "2026-10-20 14:00" },
  { name: "财务部", leader: "陈静", note: "应收应付、开票收款、财务节点审批、月结跑批", builtin: true, status: "启用", updatedAt: "2026-10-20 14:00" },
  { name: "销售部", leader: "张弛", note: "售前与客情：客户、商机、特批、合同查阅", builtin: true, status: "启用", updatedAt: "2026-10-20 14:00" },
  { name: "综合管理部", leader: "王芳", note: "行政人事与系统管理", builtin: true, status: "启用", updatedAt: "2026-10-20 14:00" },
]);

// ---------- store ----------
let version = 0;
const listeners = new Set<() => void>();
const bump = () => { version += 1; listeners.forEach((fn) => fn()); };
export function useDepartments(): number {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => version,
  );
}
export const deptNames = (onlyEnabled = true) =>
  DEPTS.filter((d) => !onlyEnabled || d.status === "启用").map((d) => d.name);
export const DEPT_OF = (name: string) => DEPTS.find((d) => d.name === name);
export const deptMembers = (name: string) => USERS.filter((u) => u.dept === name);
export const deptMemberCount = (name: string) => deptMembers(name).length;

/** 解析部门负责人：优先主数据 leader，兜底取部门内第一个启用账号 */
export function resolveDeptLeader(deptName: string): { name: string; from: "主数据" | "兜底" } | null {
  const d = DEPT_OF(deptName);
  if (!d) return null;
  if (d.leader) return { name: d.leader, from: "主数据" };
  const u = USERS.find((x) => x.dept === deptName && x.status === "启用");
  return u ? { name: u.name, from: "兜底" } : null;
}

// ---------- 维护 ----------
export interface DeptLog { at: string; action: string }
export const DEPT_LOGS: DeptLog[] = persistable("deptLogs", () => []);
const log = (action: string) => {
  DEPT_LOGS.unshift({ at: demoNow(), action });
  if (DEPT_LOGS.length > 50) DEPT_LOGS.length = 50;
};

/** 新建 / 更新部门（oldName 存在 = 改名/改负责人；改名同步迁移所有用户档案的 dept） */
export function saveDept(patch: { oldName?: string; name: string; leader?: string; note?: string }): string | null {
  const name = patch.name.trim();
  if (!name) return "部门名称不能为空";
  if (patch.oldName) {
    const d = DEPT_OF(patch.oldName);
    if (!d) return "部门不存在";
    if (name !== patch.oldName && DEPT_OF(name)) return "部门名称已存在";
    if (name !== patch.oldName) {
      USERS.forEach((u) => { if (u.dept === patch.oldName) u.dept = name; });
      log(`部门「${patch.oldName}」更名为「${name}」，已同步迁移 ${deptMemberCount(name)} 个用户档案`);
    }
    d.name = name;
    if (patch.leader !== undefined) d.leader = patch.leader || undefined;
    if (patch.note !== undefined) d.note = patch.note;
    d.updatedAt = demoNow();
    log(`更新部门「${name}」（负责人：${d.leader ?? "未指定"}）`);
  } else {
    if (DEPT_OF(name)) return "部门名称已存在";
    DEPTS.push({ name, leader: patch.leader || undefined, note: patch.note?.trim() || "（未填写职责说明）", builtin: false, status: "启用", updatedAt: demoNow() });
    log(`新建部门「${name}」`);
  }
  notify({ level: "blue", group: "系统", title: "部门主数据变更", text: `部门「${name}」已${patch.oldName ? "更新" : "创建"}，用户档案 / 数据权限 / 审批链即时联动`, to: "/system/departments", roles: ["系统管理员"] });
  bump();
  return null;
}

export function toggleDeptStatus(name: string): string | null {
  const d = DEPT_OF(name);
  if (!d) return "部门不存在";
  if (d.status === "启用" && deptMemberCount(name) > 0)
    return `该部门下还有 ${deptMemberCount(name)} 个账号，请先迁移这些用户再停用`;
  d.status = d.status === "启用" ? "停用" : "启用";
  d.updatedAt = demoNow();
  log(`${d.status === "启用" ? "启用" : "停用"}部门「${name}」`);
  notify({ level: "orange", group: "系统", title: `部门已${d.status}`, text: `部门「${name}」已${d.status}${d.status === "停用" ? "：不可再分配给新用户，历史数据不受影响" : ""}`, to: "/system/departments", roles: ["系统管理员"] });
  bump();
  return null;
}

export function deleteDept(name: string): string | null {
  const d = DEPT_OF(name);
  if (!d) return "部门不存在";
  if (d.builtin) return "内置部门不可删除";
  const n = deptMemberCount(name);
  if (n > 0) return `该部门下还有 ${n} 个账号，请先迁移这些用户`;
  DEPTS.splice(DEPTS.indexOf(d), 1);
  log(`删除部门「${name}」`);
  notify({ level: "orange", group: "系统", title: "部门已删除", text: `部门「${name}」已删除`, to: "/system/departments", roles: ["系统管理员"] });
  bump();
  return null;
}
