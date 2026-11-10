// 用户与角色（/system/users）：账号管理 + 角色管理 + 权限矩阵 + 操作留痕
// 权限粒度 = 菜单（与 navConfig 一一对应）；矩阵调整即时生效：导航过滤 + 路由守卫共用 users.ts 的 pathAllowed()
// 仅「系统管理员」默认可见（导航过滤 + 路由守卫双重控制）
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Copy, Eye, Pencil, Plus, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ROLES, USERS, ALL_MENUS, PERM_LOGS, DEPARTMENTS, saveUser, saveRole, deleteRole, duplicateRole,
  setRoleMenu, setRoleMenus, toggleUserStatus, setSessionRole, roleMembers, useSessionRole, useUsers,
  DATA_SCOPE_DESC, type DataScope, type User,
} from "@/data/users";

type Tab = "users" | "roles" | "matrix";

export default function SystemUsers() {
  useUsers(); useSessionRole();
  const [tab, setTab] = useState<Tab>("users");
  const [editing, setEditing] = useState<Partial<User> | null>(null);
  const [roleEditing, setRoleEditing] = useState<{ oldName?: string; name: string; desc: string; dataScope?: DataScope } | null>(null);
  const [copying, setCopying] = useState<string | null>(null);
  const [preview, setPreview] = useState<User | null>(null);
  const [matrixRole, setMatrixRole] = useState("业务支撑部");

  const groups = useMemo(() => Array.from(new Set(ALL_MENUS.map((m) => m.group))), []);
  const activeRole = ROLES.find((r) => r.name === matrixRole) ?? ROLES[0];

  const save = () => {
    if (!editing?.name?.trim() || !editing?.role) return;
    saveUser({
      name: editing.name.trim(), role: editing.role, dept: editing.dept ?? DEPARTMENTS[0], phone: editing.phone ?? "",
      email: editing.email, status: editing.status ?? "启用", id: editing.id,
      lastLoginAt: editing.lastLoginAt,
    });
    setEditing(null);
  };

  return (
    <ArcoShell breadcrumb="用户与角色">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-[#1D2129]"><ShieldCheck size={15} className="text-[#165DFF]" /> 用户与角色</span>
            <div className="flex rounded-[4px] bg-[#F2F3F5] p-0.5">
              {([["users", `用户 ${USERS.length}`], ["roles", `角色 ${ROLES.length}`], ["matrix", "权限矩阵"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} className={`rounded-[3px] px-3 py-0.5 text-[12px] transition-colors ${tab === k ? "bg-white font-medium text-[#165DFF] shadow-sm" : "text-[#86909C] hover:text-[#4E5969]"}`}>{label}</button>
              ))}
            </div>
          </div>
          {tab === "users" && (
            <Button size="sm" onClick={() => setEditing({ name: "", role: ROLES[0]?.name ?? "业务支撑部", dept: DEPARTMENTS[0], phone: "", email: "", status: "启用" })}>
              <UserPlus size={13} className="mr-1" /> 新建用户
            </Button>
          )}
          {tab === "roles" && (
            <Button size="sm" onClick={() => setRoleEditing({ name: "", desc: "" })}><Plus size={13} className="mr-1" /> 新建角色</Button>
          )}
        </div>

        {tab === "users" && <UsersTab onEdit={(u) => setEditing({ ...u })} onPreview={(u) => setPreview(u)} />}

        {tab === "roles" && (
          <RolesTab onEdit={(r) => setRoleEditing({ oldName: r.name, name: r.name, desc: r.desc, dataScope: r.dataScope })}
            onCopy={(name) => setCopying(name)}
            onDelete={(name) => {
              const err = deleteRole(name);
              if (err) alert(err);
              else if (matrixRole === name) setMatrixRole(ROLES[0]?.name ?? "");
            }} />
        )}

        {tab === "matrix" && (
          <MatrixTab groups={groups} activeRole={activeRole} matrixRole={matrixRole} setMatrixRole={setMatrixRole} />
        )}
      </main>

      {/* 新建 / 编辑用户 */}
      {editing && (
        <CenterModal title={editing.id ? `编辑用户 · ${editing.id}` : "新建用户"} sub="角色决定可见菜单（功能权限）；部门是组织归属，决定数据权限中「本部门」的范围" width={520} onClose={() => setEditing(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">姓名 <span className="text-[#F53F3F]">*</span></div>
                <Input autoFocus value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">角色 <span className="text-[#F53F3F]">*</span></div>
                <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={editing.role ?? ROLES[0]?.name} onChange={(e) => setEditing({ ...editing, role: e.target.value })}>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">部门 <span className="text-[#F53F3F]">*</span></div>
                <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={editing.dept ?? DEPARTMENTS[0]} onChange={(e) => setEditing({ ...editing, dept: e.target.value })}>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">状态</div>
                <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={editing.status ?? "启用"} onChange={(e) => setEditing({ ...editing, status: e.target.value as User["status"] })}>
                  <option>启用</option><option>停用</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>取消</Button>
              <Button size="sm" onClick={save}>保存</Button>
            </div>
          </div>
        </CenterModal>
      )}

      {/* 新建 / 编辑角色 */}
      {roleEditing && (
        <CenterModal title={roleEditing.oldName ? `编辑角色 · ${roleEditing.oldName}` : "新建角色"}
          sub={roleEditing.oldName ? "改名会同步迁移该角色下所有用户" : "新建角色默认仅可见工作台，请到权限矩阵配置菜单"}
          width={520} onClose={() => setRoleEditing(null)}>
          <div className="space-y-3">
            <div>
              <div className="mb-0.5 text-xs text-[#4E5969]">角色名 <span className="text-[#F53F3F]">*</span></div>
              <Input autoFocus value={roleEditing.name} onChange={(e) => setRoleEditing({ ...roleEditing, name: e.target.value })} />
            </div>
            <div>
              <div className="mb-0.5 text-xs text-[#4E5969]">职责说明</div>
              <Input value={roleEditing.desc} onChange={(e) => setRoleEditing({ ...roleEditing, desc: e.target.value })} placeholder="如：华东区销售主管——负责…" />
            </div>
            <div>
              <div className="mb-1 text-xs text-[#4E5969]">数据权限 <span className="text-[#F53F3F]">*</span>
                <span className="ml-2 font-normal text-[#86909C]">控制角色在客户 / 商机等列表中能看到谁的数据（功能权限外的第二道权限）</span>
              </div>
              <div className="space-y-1.5">
                {(Object.keys(DATA_SCOPE_DESC) as DataScope[]).map((s) => (
                  <label key={s} className={`flex cursor-pointer items-start gap-2 rounded-[2px] border px-3 py-2 ${(roleEditing.dataScope ?? "全部数据") === s ? "border-[#165DFF] bg-[#F0F5FF]" : "border-[#E5E6EB] hover:border-[#BEDAFF]"}`}>
                    <input type="radio" name="dataScope" className="mt-0.5 accent-[#165DFF]" checked={(roleEditing.dataScope ?? "全部数据") === s}
                      onChange={() => setRoleEditing({ ...roleEditing, dataScope: s })} />
                    <span>
                      <span className={`text-xs font-medium ${(roleEditing.dataScope ?? "全部数据") === s ? "text-[#165DFF]" : "text-[#1D2129]"}`}>{s}</span>
                      <span className="block text-[10px] leading-4 text-[#86909C]">{DATA_SCOPE_DESC[s]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <Button variant="outline" size="sm" onClick={() => setRoleEditing(null)}>取消</Button>
              <Button size="sm" onClick={() => {
                const err = saveRole(roleEditing);
                if (err) alert(err);
                else setRoleEditing(null);
              }}>保存</Button>
            </div>
          </div>
        </CenterModal>
      )}

      {/* 复制角色 */}
      {copying && (
        <CenterModal title={`复制角色 · ${copying}`} sub="菜单权限整套复制，快速派生新角色" width={440} onClose={() => setCopying(null)}>
          <CopyRoleBody src={copying} onDone={() => setCopying(null)} />
        </CenterModal>
      )}

      {/* 用户权限预览 */}
      {preview && (
        <CenterModal title={`权限预览 · ${preview.name}`} sub={`${preview.id} · 部门「${preview.dept}」 · 角色「${preview.role}」`} width={560} onClose={() => setPreview(null)}>
          <PreviewBody user={preview} onClose={() => setPreview(null)} />
        </CenterModal>
      )}
    </ArcoShell>
  );
}

// ---------- 用户页签：统计 + 筛选 + 账号表 ----------
function UsersTab({ onEdit, onPreview }: { onEdit: (u: User) => void; onPreview: (u: User) => void }) {
  const [kw, setKw] = useState("");
  const [fRole, setFRole] = useState("全部");
  const [fDept, setFDept] = useState("全部");
  const [fStatus, setFStatus] = useState("全部");

  const rows = USERS.filter((u) => {
    if (fRole !== "全部" && u.role !== fRole) return false;
    if (fDept !== "全部" && u.dept !== fDept) return false;
    if (fStatus !== "全部" && u.status !== fStatus) return false;
    if (kw && ![u.name, u.id, u.phone, u.email ?? "", u.dept].some((x) => x.includes(kw))) return false;
    return true;
  });

  return (
    <>
      <section className="grid gap-3 md:grid-cols-4">
        {[
          { t: "账号总数", v: USERS.length, c: "text-[#1D2129]" },
          { t: "启用", v: USERS.filter((u) => u.status === "启用").length, c: "text-[#00B42A]" },
          { t: "停用", v: USERS.filter((u) => u.status === "停用").length, c: "text-[#F53F3F]" },
          { t: "角色数", v: ROLES.length, c: "text-[#165DFF]" },
        ].map((k) => (
          <div key={k.t} className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
            <div className="text-xs text-[#86909C]">{k.t}</div>
            <div className={`mt-1 text-2xl font-bold ${k.c}`}>{k.v}</div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-2 rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
        <Input className="w-56" placeholder="搜索姓名 / 账号 / 手机号 / 邮箱" value={kw} onChange={(e) => setKw(e.target.value)} />
        <select className="rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-xs" value={fRole} onChange={(e) => setFRole(e.target.value)}>
          <option>全部</option>
          {ROLES.map((r) => <option key={r.name}>{r.name}</option>)}
        </select>
        <select className="rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-xs" value={fDept} onChange={(e) => setFDept(e.target.value)}>
          <option>全部</option>
          {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select className="rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-xs" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option>全部</option><option>启用</option><option>停用</option>
        </select>
        <span className="ml-auto text-[11px] text-[#86909C]">命中 {rows.length} 个账号</span>
      </div>

      <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th className="px-3 py-2">账号</th><th className="px-3 py-2">姓名</th><th className="px-3 py-2">部门</th><th className="px-3 py-2">角色</th>
              <th className="px-3 py-2">联系方式</th><th className="px-3 py-2">最近登录</th><th className="px-3 py-2">状态</th><th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                <td className="px-3 py-2.5 font-mono text-[#86909C]">{u.id}</td>
                <td className="px-3 py-2.5 font-medium text-[#1D2129]">{u.name}</td>
                <td className="px-3 py-2.5">
                  <span className="rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[11px] text-[#4E5969]">{u.dept}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="rounded-[2px] bg-[#F0F5FF] px-1.5 py-0.5 text-[11px] text-[#165DFF]">{u.role}</span>
                </td>
                <td className="px-3 py-2.5 text-[#4E5969]">{u.phone}{u.email ? ` · ${u.email}` : ""}</td>
                <td className="px-3 py-2.5 font-mono text-[#86909C]">{u.lastLoginAt}</td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${u.status === "启用" ? "bg-[#E8F8F2] text-[#00B42A]" : "bg-[#F2F3F5] text-[#86909C]"}`}>{u.status}</span>
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <button onClick={() => onPreview(u)} className="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]"><Eye size={11} className="mr-0.5 inline" />权限</button>
                  <button onClick={() => onEdit(u)} className="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]"><Pencil size={11} className="mr-0.5 inline" />编辑</button>
                  <button onClick={() => toggleUserStatus(u.id)} className={`rounded-[2px] border px-2 py-0.5 text-[11px] ${u.status === "启用" ? "border-[#E5E6EB] text-[#F53F3F] hover:border-[#F53F3F]" : "border-[#E5E6EB] text-[#00B42A] hover:border-[#00B42A]"}`}>
                    {u.status === "启用" ? "停用" : "启用"}
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="px-3 py-10 text-center text-[#86909C]">无匹配账号</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
        用户同时挂「部门」与「角色」：部门 = 组织归属，决定数据权限中「本部门数据」的范围；角色 = 菜单权限 + 数据范围模板（权限矩阵页签维护）。
        一人多岗时给账号配多个角色（后续版本支持）；停用账号即时失去入口；演示环境工作台右上可切换演示角色体验不同权限视图。
      </div>
    </>
  );
}

// ---------- 角色页签 ----------
function RolesTab({ onEdit, onCopy, onDelete }: {
  onEdit: (r: (typeof ROLES)[number]) => void;
  onCopy: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  return (
    <>
      <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th className="px-3 py-2">角色</th><th className="px-3 py-2">职责说明</th><th className="px-3 py-2 text-center">数据权限</th><th className="px-3 py-2 text-center">启用成员</th>
              <th className="px-3 py-2 text-center">菜单数</th><th className="px-3 py-2 text-center">类型</th><th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((r) => (
              <tr key={r.name} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                <td className="px-3 py-2.5 font-medium text-[#1D2129]">{r.name}</td>
                <td className="max-w-[360px] px-3 py-2.5 text-[#4E5969]">{r.desc}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${
                    r.dataScope === "全部数据" ? "bg-[#E8F3FF] text-[#165DFF]"
                    : r.dataScope === "本部门数据" ? "bg-[#FFF3E8] text-[#FF7D00]"
                    : "bg-[#FFECE8] text-[#F53F3F]"}`} title={DATA_SCOPE_DESC[r.dataScope]}>{r.dataScope}</span>
                </td>
                <td className="px-3 py-2.5 text-center font-mono">{roleMembers(r.name)}</td>
                <td className="px-3 py-2.5 text-center font-mono text-[#165DFF]">{r.menus.length}</td>
                <td className="px-3 py-2.5 text-center">
                  {r.builtin
                    ? <span className="rounded-[2px] bg-[#F0F5FF] px-1.5 py-0.5 text-[10px] text-[#165DFF]">内置</span>
                    : <span className="rounded-[2px] bg-[#FFF3E8] px-1.5 py-0.5 text-[10px] text-[#FF7D00]">自定义</span>}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <button onClick={() => onEdit(r)} className="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]"><Pencil size={11} className="mr-0.5 inline" />编辑</button>
                  <button onClick={() => onCopy(r.name)} className="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]"><Copy size={11} className="mr-0.5 inline" />复制</button>
                  {!r.builtin && (
                    <button onClick={() => { if (confirm(`删除角色「${r.name}」？\n\n仅可删除无成员的自定义角色。`)) onDelete(r.name); }}
                      className="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#F53F3F] hover:border-[#F53F3F]"><Trash2 size={11} className="mr-0.5 inline" />删除</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
        内置角色不可删除（保证系统基本分工可用），权限可在权限矩阵页签调整；自定义角色可删除（需无成员）。
        「复制」把源角色的整套菜单权限与数据权限复制给新角色，适合从相近岗位快速派生。
        数据权限（本人/本部门/全部）在角色编辑弹窗维护，控制客户、商机等列表可见的数据范围。
      </div>
    </>
  );
}

// ---------- 权限矩阵页签 ----------
function MatrixTab({ groups, activeRole, matrixRole, setMatrixRole }: {
  groups: string[];
  activeRole: (typeof ROLES)[number];
  matrixRole: string;
  setMatrixRole: (s: string) => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[12px]">
        <span className="text-[#86909C]">选择角色</span>
        {ROLES.map((r) => (
          <button key={r.name} onClick={() => setMatrixRole(r.name)}
            className={`rounded-[2px] px-2.5 py-1 ${matrixRole === r.name ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>
            {r.name}<span className={`ml-1 text-[10px] ${matrixRole === r.name ? "text-[#BEDAFF]" : "text-[#C9CDD4]"}`}>{roleMembers(r.name)}人</span>
          </button>
        ))}
        <span className="ml-auto flex max-w-[460px] items-center gap-2 truncate text-[11px] text-[#86909C]">
          <span className={`shrink-0 rounded-[2px] px-1.5 py-0.5 text-[10px] ${
            activeRole.dataScope === "全部数据" ? "bg-[#E8F3FF] text-[#165DFF]"
            : activeRole.dataScope === "本部门数据" ? "bg-[#FFF3E8] text-[#FF7D00]"
            : "bg-[#FFECE8] text-[#F53F3F]"}`}>{activeRole.dataScope}</span>
          <span className="truncate">{activeRole.desc}</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px]">
        <span className="text-[#86909C]">快捷方案：</span>
        <button onClick={() => setRoleMenus(activeRole.name, ALL_MENUS.map((m) => m.to).filter((p) => p !== "/system/users"), true)}
          className="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">全开（不含系统管理）</button>
        <button onClick={() => setRoleMenus(activeRole.name, ALL_MENUS.map((m) => m.to), false)}
          className="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">全部清空</button>
        <button onClick={() => setRoleMenus(activeRole.name, ["/workbench"], true)}
          className="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">仅工作台</button>
        <span className="mx-1 text-[#C9CDD4]">|</span>
        <span className="text-[#86909C]">复制自</span>
        <select className="rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-0.5 text-[#4E5969]"
          value="" onChange={(e) => {
            const src = ROLES.find((r) => r.name === e.target.value);
            if (src && src.name !== activeRole.name) {
              setRoleMenus(activeRole.name, ALL_MENUS.map((m) => m.to), false);
              setRoleMenus(activeRole.name, src.menus, true);
            }
          }}>
          <option value="">选择源角色…</option>
          {ROLES.filter((r) => r.name !== activeRole.name).map((r) => <option key={r.name} value={r.name}>{r.name}（{r.menus.length} 项）</option>)}
        </select>
        <span className="ml-auto font-mono text-[#86909C]">{activeRole.menus.length} / {ALL_MENUS.length} 项</span>
      </div>

      <div className="overflow-hidden rounded-[4px] border border-[#E5E6EB] bg-white">
        {groups.map((g) => {
          const items = ALL_MENUS.filter((m) => m.group === g);
          const onCount = items.filter((m) => activeRole.menus.includes(m.to)).length;
          const allOn = onCount === items.length;
          return (
            <div key={g} className="border-b last:border-0">
              <label className="flex cursor-pointer items-center gap-2.5 bg-[#F7F8FA] px-4 py-1.5 text-[12px] font-semibold text-[#4E5969] hover:bg-[#F2F3F5]">
                <input type="checkbox" className="h-3.5 w-3.5 accent-[#165DFF]" checked={allOn}
                  onChange={(e) => setRoleMenus(activeRole.name, items.map((m) => m.to), e.target.checked)} />
                {g}
                <span className="ml-2 font-mono text-[10px] font-normal text-[#86909C]">{onCount}/{items.length}</span>
              </label>
              {items.map((m) => {
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
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          勾选即时生效：左侧导航按新权限过滤，已打开的页面刷新后由路由守卫校验；内置角色不可删除。
          「/」= 核算单录入（仅精确匹配），其余菜单含其下所有详情页（前缀匹配）——新增详情页请挂在已有菜单路径下。
        </div>
        <div className="rounded-[4px] border border-[#E5E6EB] bg-white">
          <div className="border-b px-4 py-2 text-[12px] font-semibold text-[#1D2129]">最近变更（操作留痕）</div>
          <div className="max-h-44 overflow-y-auto px-4 py-2">
            {PERM_LOGS.length === 0 && <div className="py-3 text-center text-[11px] text-[#86909C]">暂无记录</div>}
            {PERM_LOGS.slice(0, 12).map((l, i) => (
              <div key={i} className="flex items-baseline gap-2 border-b border-[#F7F8FA] py-1.5 text-[11px] last:border-0">
                <span className="font-mono text-[10px] text-[#C9CDD4]">{l.at}</span>
                <span className="text-[#1D2129]">{l.action}</span>
                <span className="ml-auto shrink-0 rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[9px] text-[#86909C]">{l.actor}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ---------- 复制角色弹窗 ----------
function CopyRoleBody({ src, onDone }: { src: string; onDone: () => void }) {
  const [name, setName] = useState(`${src}-副本`);
  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-[2px] bg-[#F7F8FA] px-3 py-2 text-[#4E5969]">源角色「{src}」的 {ROLES.find((r) => r.name === src)?.menus.length ?? 0} 项菜单权限将整套复制给新角色。</div>
      <div>
        <div className="mb-0.5 text-[#4E5969]">新角色名 <span className="text-[#F53F3F]">*</span></div>
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
        <Button variant="outline" size="sm" onClick={onDone}>取消</Button>
        <Button size="sm" onClick={() => {
          const err = duplicateRole(src, name);
          if (err) alert(err);
          else onDone();
        }}>复制创建</Button>
      </div>
    </div>
  );
}

// ---------- 用户权限预览弹窗 ----------
function PreviewBody({ user, onClose }: { user: User; onClose: () => void }) {
  const nav = useNavigate();
  const role = ROLES.find((r) => r.name === user.role);
  if (!role) return <div className="py-6 text-center text-xs text-[#86909C]">角色「{user.role}」不存在（可能已被删除）</div>;
  const groups = Array.from(new Set(ALL_MENUS.map((m) => m.group)));
  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-[2px] bg-[#F7F8FA] px-3 py-2 leading-5 text-[#4E5969]">{role.desc}</div>
      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {groups.map((g) => {
          const items = ALL_MENUS.filter((m) => m.group === g && role.menus.includes(m.to));
          if (!items.length) return null;
          return (
            <div key={g}>
              <div className="mb-1 text-[11px] font-semibold text-[#4E5969]">{g}（{items.length}）</div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((m) => (
                  <span key={m.to} className="rounded-[2px] bg-[#F0F5FF] px-1.5 py-0.5 text-[10px] text-[#165DFF]">{m.label}</span>
                ))}
              </div>
            </div>
          );
        })}
        {!role.menus.length && <div className="py-4 text-center text-[#86909C]">该角色未配置任何菜单</div>}
      </div>
      <div className="flex items-center justify-between border-t border-[#F2F3F5] pt-3">
        <span className="text-[10px] text-[#86909C]">切换后以该角色视角浏览整个系统（工作台右上角可切回）</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>关闭</Button>
          <Button size="sm" onClick={() => { setSessionRole(user.role); onClose(); nav("/workbench"); }}>以该角色进入系统</Button>
        </div>
      </div>
    </div>
  );
}
