// 计价字典 · 跨资源共用的计价规则（价格规则下沉后，条目库只保留这类「不带具体资源」的规则）
// 当前收录：工时费率。具体资源的价格（月租 / 单价 / 采购价）挂在 R1~R4 资源档案与采购合同上，不进本字典。
import { useState } from "react";
import { useRates, getRates, saveRate, addRate, type EngineerRate } from "@/data/dicts";
import { DEMO_TODAY } from "@/data/settings";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const fmt = (n: number) => n.toLocaleString("zh-CN");

export function DictsPanel() {
  useRates();
  const [editing, setEditing] = useState<(EngineerRate & { isNew?: boolean; idx?: number }) | null>(null);

  const save = () => {
    if (!editing) return;
    if (!editing.role.trim()) return alert("请填写岗位 / 级别");
    if (!(editing.rate > 0)) return alert("请填写费率（元/人天）");
    const row: EngineerRate = { role: editing.role.trim(), rate: editing.rate, effect: editing.effect || DEMO_TODAY, status: editing.status ?? "启用", remark: editing.remark || undefined };
    if (editing.isNew) addRate(row);
    else saveRate(editing.idx ?? 0, row);
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
        <div>
          <span className="text-sm font-semibold text-[#1D2129]">计价标准</span>
          <span className="ml-2 text-[11px] text-[#86909C]">跨资源共用的计价规则：工时费率（开通实施 / 安装调测 / 运维投入共用一条费率线）。具体资源的价格（月租 / 单价 / 采购价）挂在 R1~R4 资源档案与采购合同上，不在此维护</span>
        </div>
          <Button size="sm" onClick={() => setEditing({ role: "", rate: 0, effect: DEMO_TODAY, status: "启用", isNew: true })}>＋ 新增费率</Button>
        </div>

        <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">岗位 / 级别</th><th className="px-3 py-2 text-right">费率（元/人天）</th>
                <th className="px-3 py-2">生效日期</th><th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">备注</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {getRates().map((r, i) => (
                <tr key={i} className={`border-b last:border-0 ${r.status === "停用" ? "opacity-55" : ""}`}>
                  <td className="px-3 py-2.5 font-medium text-[#1D2129]">{r.role}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-[#1D2129]">{fmt(r.rate)}</td>
                  <td className="px-3 py-2.5 font-mono text-[#4E5969]">{r.effect}</td>
                  <td className="px-3 py-2.5">
                    {r.status === "停用"
                      ? <span className="rounded-[2px] bg-[#FFECE8] px-1.5 py-0.5 text-[10px] text-[#F53F3F]">已停用</span>
                      : <span className="rounded-[2px] bg-[#E8F8F2] px-1.5 py-0.5 text-[10px] text-[#00B42A]">启用</span>}
                  </td>
                  <td className="max-w-[240px] truncate px-3 py-2.5 text-[#86909C]" title={r.remark}>{r.remark ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <button className="mr-2 text-[#165DFF] hover:underline" onClick={() => setEditing({ ...r, idx: i, isNew: false })}>编辑</button>
                    <button className={`hover:underline ${r.status === "停用" ? "text-[#00B42A]" : "text-[#FF7D00]"}`}
                      onClick={() => saveRate(i, { status: r.status === "停用" ? "启用" : "停用" })}>
                      {r.status === "停用" ? "启用" : "停用"}
                    </button>
                  </td>
                </tr>
              ))}
              {!getRates().length && <tr><td colSpan={6} className="px-3 py-10 text-center text-[#C9CDD4]">暂无费率记录，点右上角「新增费率」创建</td></tr>}
            </tbody>
          </table>
          <div className="border-t border-dashed border-[#F2F3F5] px-4 py-2 text-[10px] leading-4 text-[#C9CDD4]">
            取数规则：条目库「工时计价」的试算与核算填报，默认取本表中第一条「启用」的费率；按岗位细分取数是未来增强（核算填报时按投入岗位选人天）。
          </div>
        </div>

      {editing && (
        <CenterModal title={editing.isNew ? "新增费率" : "编辑费率"} sub="工时费率：开通实施 / 安装调测 / 运维投入共用" onClose={() => setEditing(null)} width={440}>
          <div className="space-y-3 text-xs">
            <div>
              <div className="mb-0.5 text-[#4E5969]">岗位 / 级别 <span className="text-[#F53F3F]">*</span></div>
              <Input autoFocus placeholder="如：网络工程师（实施 / 运维）" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-0.5 text-[#4E5969]">费率（元/人天）<span className="text-[#F53F3F]"> *</span></div>
                <Input type="number" placeholder="如 800" value={editing.rate || ""} onChange={(e) => setEditing({ ...editing, rate: Number(e.target.value) })} />
              </div>
              <div>
                <div className="mb-0.5 text-[#4E5969]">生效日期</div>
                <Input placeholder="YYYY-MM-DD" value={editing.effect} onChange={(e) => setEditing({ ...editing, effect: e.target.value })} />
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">备注（可空）</div>
              <Input placeholder="如：开通实施与安装调测共用" value={editing.remark ?? ""} onChange={(e) => setEditing({ ...editing, remark: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>取消</Button>
              <Button size="sm" onClick={save}>保存费率</Button>
            </div>
          </div>
        </CenterModal>
      )}
    </div>
  );
}
