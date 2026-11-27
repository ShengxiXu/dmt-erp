// 部门管理（/system/departments）—— 部门主数据维护
// 联动范围：用户档案.dept / 数据权限「本部门」判定 / 审批链「部门负责人」节点解析 全部读这份主数据
// 口径：改名同步迁移所有用户档案；有成员的部门不可停用/删除；内置部门不可删除
import { useState } from "react";
import { useDepartments, DEPTS, DEPT_LOGS, deptMemberCount, saveDept, toggleDeptStatus, deleteDept, type Department } from "@/data/departments";
import { USERS, useUsers } from "@/data/users";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const selCls = "rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm";

function DeptForm({ initial, onClose }: { initial?: Department; onClose: () => void }) {
  useUsers();
  const [name, setName] = useState(initial?.name ?? "");
  const [leader, setLeader] = useState(initial?.leader ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const members = USERS.filter((u) => u.dept === (initial?.name ?? name));
  const save = () => {
    const err = saveDept({ oldName: initial?.name, name, leader, note });
    if (err) return alert(err);
    onClose();
  };
  return (
    <CenterModal title={initial ? `编辑部门 · ${initial.name}` : "新建部门"} sub="部门主数据：用户档案、数据权限「本部门」、审批链「部门负责人」节点全部联动" width={520} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">部门名称 <span className="text-[#F53F3F]">*</span></div>
            <Input autoFocus placeholder="如 网络运维部" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">部门负责人</div>
            <select className={`${selCls} w-full`} value={leader} onChange={(e) => setLeader(e.target.value)}>
              <option value="">（未指定，按部门内第一个启用账号兜底）</option>
              {(initial ? members : USERS).filter((u) => u.status === "启用").map((u) => <option key={u.id} value={u.name}>{u.name}（{u.role}）</option>)}
            </select>
          </div>
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">职责说明</div>
          <Input placeholder="该部门在交付流程中的职责" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {initial && (
          <div className="rounded-[4px] bg-[#F7F8FA] px-3 py-2 text-[11px] leading-5 text-[#4E5969]">
            现有成员 {members.length} 人{members.length ? "：" : ""}{members.map((u) => `${u.name}（${u.role}）`).join("、")}
            <div className="text-[#86909C]">改名将同步迁移以上成员的所属部门；负责人从本部门成员中选择。</div>
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={save}>保存</Button>
        </div>
      </div>
    </CenterModal>
  );
}

export default function Departments() {
  useDepartments();
  useUsers();
  const [form, setForm] = useState<{ open: boolean; initial?: Department }>({ open: false });

  return (
    <ArcoShell breadcrumb="系统管理 / 部门管理">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#1D2129]">部门管理</span>
            <span className="text-[11px] text-[#86909C]">部门主数据：用户档案、数据权限「本部门」、审批链「部门负责人」节点全部从这里取数——原来写死在代码里，现在可自主维护</span>
          </div>
          <Button size="sm" onClick={() => setForm({ open: true })}>＋ 新建部门</Button>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          {DEPTS.map((d) => {
            const n = deptMemberCount(d.name);
            return (
              <div key={d.name} className={`rounded-[4px] border bg-white p-4 ${d.status === "启用" ? "border-[#E5E6EB]" : "border-dashed border-[#E5E6EB] opacity-60"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-[#1D2129]">{d.name}</span>
                  {d.builtin && <span className="rounded-[2px] bg-[#F2F3F5] px-1 py-0.5 text-[10px] text-[#86909C]">内置</span>}
                  <span className={`ml-auto rounded-[2px] px-1.5 py-0.5 text-[10px] ${d.status === "启用" ? "bg-[#E8F8F2] text-[#00B42A]" : "bg-[#F2F3F5] text-[#86909C]"}`}>{d.status}</span>
                </div>
                <div className="mt-1.5 text-xs text-[#4E5969]">
                  负责人：<span className="font-medium text-[#1D2129]">{d.leader ?? "未指定（兜底解析）"}</span>
                  <span className="mx-2 text-[#E5E6EB]">|</span>成员 {n} 人
                </div>
                <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#86909C]">{d.note}</div>
                <div className="mt-2.5 flex items-center gap-2 border-t border-[#F2F3F5] pt-2 text-xs">
                  <span className="text-[10px] text-[#C9CDD4]">更新于 {d.updatedAt}</span>
                  <span className="ml-auto flex gap-2">
                    <button className="text-[#165DFF] hover:underline" onClick={() => setForm({ open: true, initial: d })}>编辑</button>
                    <button className="text-[#4E5969] hover:underline" onClick={() => { const err = toggleDeptStatus(d.name); if (err) alert(err); }}>
                      {d.status === "启用" ? "停用" : "启用"}
                    </button>
                    {!d.builtin && (
                      <button className="text-[#F53F3F] hover:underline" onClick={() => { if (confirm(`删除部门「${d.name}」？变更留痕。`)) { const err = deleteDept(d.name); if (err) alert(err); } }}>删除</button>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
          <div className="mb-2 text-[13px] font-semibold text-[#1D2129]">变更留痕</div>
          <div className="space-y-1.5 text-xs">
            {DEPT_LOGS.slice(0, 10).map((l, i) => (
              <div key={i} className="flex gap-2">
                <span className="shrink-0 text-[10px] text-[#86909C]">{l.at}</span>
                <span className="text-[#4E5969]">{l.action}</span>
              </div>
            ))}
            {!DEPT_LOGS.length && <div className="py-4 text-center text-[#C9CDD4]">暂无变更记录</div>}
          </div>
        </div>
      </main>

      {form.open && <DeptForm initial={form.initial} onClose={() => setForm({ open: false })} />}
    </ArcoShell>
  );
}
