// 用户与角色（/system/users）：账号管理 + 角色权限矩阵
// 权限粒度 = 菜单（与 navConfig 一一对应）；矩阵调整即时生效：导航过滤 + 路由守卫共用 users.ts 的 allowed()
// 仅「系统管理员」默认可见（导航过滤 + 路由守卫双重控制）
import { useState } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ROLES, USERS, ALL_MENUS, saveUser, setRoleMenu, toggleUserStatus, useSessionRole, useUsers,
  type User,
} from "@/data/users";

export default function SystemUsers() {
  useUsers(); useSessionRole();
  const [tab, setTab] = useState<"users" | "matrix">("users");
  const [editing, setEditing] = useState<Partial<User> | null>(null);
  const [matrixRole, setMatrixRole] = useState("业务支撑部");

  const save = () => {
    if (!editing?.name || !editing?.role) return;
    saveUser({
      name: editing.name, role: editing.role, phone: editing.phone ?? "",
      email: editing.email, status: editing.status ?? "启用", id: editing.id,
      lastLoginAt: editing.lastLoginAt,
    });
    setEditing(null);
  };

  // 权限矩阵按导航分组聚合
  const groups = Array.from(new Set(ALL_MENUS.map((m) => m.group)));
  const activeRole = ROLES.find((r) => r.name === matrixRole) ?? ROLES[0];

  return (
    <ArcoShell breadcrumb="用户与角色">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-[#1D2129]"><ShieldCheck size={15} className="text-[#165DFF]" /> 用户与角色</span>
            <div className="flex rounded-[4px] bg-[#F2F3F5] p-0.5">
              {([["users", `用户 ${USERS.length}`], ["matrix", "权限矩阵"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} className={`rounded-[3px] px-3 py-0.5 text-[12px] transition-colors ${tab === k ? "bg-white font-medium text-[#165DFF] shadow-sm" : "text-[#86909C] hover:text-[#4E5969]"}`}>{label}</button>
              ))}
            </div>
          </div>
          {tab === "users" && (
            <Button size="sm" onClick={() => setEditing({ name: "", role: "业务支撑部", phone: "", email: "", status: "启用" })}>
              <UserPlus size={13} className="mr-1" /> 新建用户
            </Button>
          )}
        </div>

        {tab === "users" ? (
          <>
            <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                    <th className="px-3 py-2">账号</th><th className="px-3 py-2">姓名</th><th className="px-3 py-2">角色</th>
                    <th className="px-3 py-2">联系方式</th><th className="px-3 py-2">最近登录</th><th className="px-3 py-2">状态</th><th className="px-3 py-2 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {USERS.map((u) => {
                    const r = ROLES.find((x) => x.name === u.role);
                    return (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                        <td className="px-3 py-2.5 font-mono text-[#86909C]">{u.id}</td>
                        <td className="px-3 py-2.5 font-medium text-[#1D2129]">{u.name}</td>
                        <td className="px-3 py-2.5">
                          <span className="rounded-[2px] bg-[#F0F5FF] px-1.5 py-0.5 text-[11px] text-[#165DFF]">{u.role}</span>
                          {r && <span className="ml-1.5 hidden text-[10px] text-[#C9CDD4] xl:inline">{r.desc.slice(0, 24)}…</span>}
                        </td>
                        <td className="px-3 py-2.5 text-[#4E5969]">{u.phone}{u.email ? ` · ${u.email}` : ""}</td>
                        <td className="px-3 py-2.5 font-mono text-[#86909C]">{u.lastLoginAt}</td>
                        <td className="px-3 py-2.5">
                          <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${u.status === "启用" ? "bg-[#E8F8F2] text-[#00B42A]" : "bg-[#F2F3F5] text-[#86909C]"}`}>{u.status}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button onClick={() => setEditing({ ...u })} className="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">编辑</button>
                          <button onClick={() => toggleUserStatus(u.id)} className={`rounded-[2px] border px-2 py-0.5 text-[11px] ${u.status === "启用" ? "border-[#E5E6EB] text-[#F53F3F] hover:border-[#F53F3F]" : "border-[#E5E6EB] text-[#00B42A] hover:border-[#00B42A]"}`}>
                            {u.status === "启用" ? "停用" : "启用"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
              用户归属角色，角色决定可见菜单（权限矩阵页签维护）。停用账号即时失去入口；
              演示环境的「角色」等同正式环境的登录账号，工作台右上可切换演示角色体验不同权限视图。
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[12px]">
              <span className="text-[#86909C]">选择角色</span>
              {ROLES.map((r) => (
                <button key={r.name} onClick={() => setMatrixRole(r.name)}
                  className={`rounded-[2px] px-2.5 py-1 ${matrixRole === r.name ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>
                  {r.name}
                </button>
              ))}
              <span className="ml-auto max-w-[460px] truncate text-[11px] text-[#86909C]">{activeRole.desc}</span>
            </div>
            <div className="overflow-hidden rounded-[4px] border border-[#E5E6EB] bg-white">
              {groups.map((g) => (
                <div key={g} className="border-b last:border-0">
                  <div className="bg-[#F7F8FA] px-4 py-1.5 text-[12px] font-semibold text-[#4E5969]">{g}</div>
                  {ALL_MENUS.filter((m) => m.group === g).map((m) => {
                    const on = activeRole.menus.includes(m.to);
                    return (
                      <label key={m.to} className="flex cursor-pointer items-center gap-2.5 border-b border-[#F7F8FA] px-4 py-2 text-[12px] last:border-0 hover:bg-[#F7F8FA]">
                        <input type="checkbox" checked={on} onChange={(e) => setRoleMenu(activeRole.name, m.to, e.target.checked)}
                          className="h-3.5 w-3.5 accent-[#165DFF]" />
                        <span className={on ? "text-[#1D2129]" : "text-[#86909C]"}>{m.label}</span>
                        <span className="ml-auto font-mono text-[10px] text-[#C9CDD4]">{m.to}</span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
              勾选即时生效：左侧导航按新权限过滤，已打开的页面刷新后由路由守卫校验；内置角色不可删除。
              「/」= 核算单录入（仅精确匹配），其余菜单含其下所有详情页（前缀匹配）。
            </div>
          </>
        )}
      </main>

      {editing && (
        <CenterModal title={editing.id ? `编辑用户 · ${editing.id}` : "新建用户"} sub="用户归属角色后即拥有该角色的菜单权限" width={520} onClose={() => setEditing(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">姓名 <span className="text-[#F53F3F]">*</span></div>
                <Input autoFocus value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">角色 <span className="text-[#F53F3F]">*</span></div>
                <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={editing.role ?? "业务支撑部"} onChange={(e) => setEditing({ ...editing, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r.name} value={r.name}>{r.name}（{r.menus.length} 项菜单）</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">手机号</div>
                <Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">邮箱</div>
                <Input value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-xs text-[#4E5969]">状态</div>
              <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={editing.status ?? "启用"} onChange={(e) => setEditing({ ...editing, status: e.target.value as User["status"] })}>
                <option>启用</option><option>停用</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>取消</Button>
              <Button size="sm" onClick={save}>保存</Button>
            </div>
          </div>
        </CenterModal>
      )}
    </ArcoShell>
  );
}
