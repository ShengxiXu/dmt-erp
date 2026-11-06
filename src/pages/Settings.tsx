// A5 策略中心（/system/settings）：系统行为参数的唯一维护处
// 保存即生效（内存 store + 订阅广播）；影响 P03 计费 / P04 欠费 / P05 变更测算 / P06 违约金参考的全部消费方。
// 边界：不做按客户/合同覆盖、不做灰度与审批流；危险项（直接影响停机/计费）保存前二次确认；全部修改留痕。
import { useState } from "react";
import ArcoShell from "@/components/ArcoShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CFG_GROUPS, CFG_LOGS, getCfg, saveCfg, useSettings, type CfgDef } from "@/data/settings";

// ---------- 单个配置项行（独立本地态，逐项保存） ----------
function CfgRow({ def }: { def: CfgDef }) {
  const [val, setVal] = useState(getCfg(def.key));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = () => {
    if (def.danger) {
      const cur = getCfg(def.key);
      if (cur === val.trim()) { setMsg({ ok: false, text: "值未变化" }); return; }
      if (!window.confirm(`「${def.label}」直接影响停机/计费行为：\n\n当前值：${cur} ${def.unit}\n拟修改为：${val.trim()} ${def.unit}\n\n保存后立即生效并留痕，确认修改？`)) return;
      const e = saveCfg(def.key, val, "系统管理员", true);
      setMsg(e ? { ok: false, text: e } : { ok: true, text: "已保存，即时生效" });
      return;
    }
    const e = saveCfg(def.key, val, "系统管理员", true);
    setMsg(e ? { ok: false, text: e } : { ok: true, text: "已保存，即时生效" });
  };

  return (
    <div className="flex items-start gap-3 border-b border-[#F2F3F5] py-3 last:border-0">
      <div className="w-56 shrink-0">
        <div className="text-xs font-medium text-[#1D2129]">
          {def.label}
          {def.danger && <span className="ml-1 rounded-[2px] bg-[#FFECE8] px-1 py-0.5 text-[9px] text-[#F53F3F]">危险</span>}
        </div>
        <div className="mt-0.5 text-[10px] leading-4 text-[#86909C]">{def.hint}</div>
      </div>
      <div className="flex items-center gap-2">
        {def.type === "select" ? (
          <select className="w-64 rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-xs" value={val} onChange={(e) => { setVal(e.target.value); setMsg(null); }}>
            {def.options?.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
        ) : (
          <div className="flex items-center gap-1">
            <Input className="w-28 text-xs" value={val}
              onChange={(e) => { setVal(e.target.value); setMsg(null); }}
              onKeyDown={(e) => e.key === "Enter" && save()} />
            {def.unit && <span className="text-xs text-[#4E5969]">{def.unit}</span>}
          </div>
        )}
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={save}>保存</Button>
        {msg && <span className={`text-[11px] ${msg.ok ? "text-[#00B42A]" : "text-[#F53F3F]"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}

export default function Settings() {
  useSettings();
  return (
    <ArcoShell breadcrumb="系统管理 / 策略中心">
      <main className="space-y-4 p-6">
        <div className="rounded-[4px] border border-[#BEDAFF] bg-[#E8F3FF] px-4 py-2.5 text-xs leading-5 text-[#0E42D2]">
          保存即生效：本页参数被 P03 计费（应收日期 / 欠停计费）、P04 欠费（宽限期 / 停机条件 / 滞纳金 / 坏账门槛）、
          P05 变更测算单价、P06 违约金参考实时读取；标「危险」的项直接影响停机与计费，保存前需二次确认。
          仅系统管理员可维护；正式环境建议增加变更审批。
        </div>

        {CFG_GROUPS.map((g) => (
          <div key={g.id} className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
            <div className="mb-1 flex items-baseline gap-2">
              <span className="text-[13px] font-semibold text-[#1D2129]">{g.name}</span>
              <span className="text-[11px] text-[#86909C]">{g.desc}</span>
            </div>
            {g.items.map((def) => <CfgRow key={def.key} def={def} />)}
          </div>
        ))}

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
          <div className="mb-2 text-[13px] font-semibold text-[#1D2129]">变更留痕</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                  <th className="px-3 py-2">时间</th><th className="px-3 py-2">操作人</th>
                  <th className="px-3 py-2">配置项</th><th className="px-3 py-2">原值</th>
                  <th className="px-3 py-2"></th><th className="px-3 py-2">新值</th>
                </tr>
              </thead>
              <tbody>
                {CFG_LOGS.map((l, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-[#86909C]">{l.at}</td>
                    <td className="px-3 py-2">{l.operator}</td>
                    <td className="px-3 py-2 font-medium text-[#1D2129]">{l.label}</td>
                    <td className="px-3 py-2 text-[#4E5969]">{l.from}</td>
                    <td className="px-3 py-2 text-[#C9CDD4]">→</td>
                    <td className="px-3 py-2 font-medium text-[#165DFF]">{l.to}</td>
                  </tr>
                ))}
                {!CFG_LOGS.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-[#C9CDD4]">暂无变更记录</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </ArcoShell>
  );
}
