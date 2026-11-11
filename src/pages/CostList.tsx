import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { SHEETS, fmt, type SheetStatus } from "@/data/sheets";
import { CONTRACTS } from "@/data/contracts";
import { inDataScope, scopeBanner } from "@/data/users";
import { ownerOfDeal } from "@/data/ownership";
import ArcoShell from "@/components/ArcoShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

const STATUS_COLOR: Record<SheetStatus, string > = {
  待填写: "bg-[#F2F3F5] text-[#4E5969]",
  待对方提交: "bg-[#FFF3E8] text-[#FF7D00]",
  审批中: "bg-[#E8F3FF] text-[#165DFF]",
  已通过: "bg-[#E8F8F2] text-[#00B42A]",
  已驳回: "bg-[#FFECE8] text-[#F53F3F]",
  变更中: "bg-[#FEF0FF] text-[#CB26FF]",
};
const FILTERS: ("全部" | SheetStatus)[] = ["全部", "待填写", "待对方提交", "审批中", "已通过", "已驳回", "变更中"];

export default function CostList() {
  const nav = useNavigate();
  /** 支持工作台待办深链：?status=审批中&kw=CE-2026-1008&pending=1 */
  const [sp] = useSearchParams();
  const initStatus = sp.get("status") as (typeof FILTERS)[number] | null;
  const [f, setF] = useState<(typeof FILTERS)[number]>(initStatus && FILTERS.includes(initStatus) ? initStatus : "全部");
  const [onlyPending, setOnlyPending] = useState(sp.get("pending") === "1");
  const [kw, setKw] = useState(sp.get("kw") ?? "");
  // 数据权限：核算单沿「合同 → 商机 / 客户」链路解析归属人后按角色数据范围过滤
  const sheetOwner = (s: (typeof SHEETS)[number]) => {
    const cid = s.contract.split(" ")[0];
    const c = CONTRACTS.find((x) => x.id === cid);
    return ownerOfDeal(c?.dealId, s.customer);
  };
  // scoped 不做 memo：会话角色切换时数据范围要即时重算（数组很小，每次渲染重算无压力）
  const scoped = SHEETS.filter((s) => inDataScope(sheetOwner(s)));
  const banner = scopeBanner(SHEETS.length - scoped.length);
  const rows = useMemo(() => scoped.filter((s) => (f === "全部" || s.status === f) && (!onlyPending || (s.pendingLink ?? 0) > 0) && (!kw || s.id.includes(kw) || s.customer.includes(kw) || s.contract.includes(kw))), [f, onlyPending, kw]); // eslint-disable-line react-hooks/exhaustive-deps
  const pendingCount = scoped.filter((s) => (s.pendingLink ?? 0) > 0).length;
  const stats = {
    pending: scoped.filter((s) => s.status === "审批中").length,
    todo: scoped.filter((s) => s.status === "待填写" || s.status === "待对方提交").length,
    pass: scoped.filter((s) => s.status === "已通过").length,
    reject: scoped.filter((s) => s.status === "已驳回").length,
  };

  return (
    <ArcoShell breadcrumb="成本台账">
      <main className="space-y-4 p-6">
        <section className="grid gap-3 md:grid-cols-4">
          {[
            { t: "审批中", v: stats.pending, c: "text-[#165DFF]" },
            { t: "待填写 / 待对方提交", v: stats.todo, c: "text-[#FF7D00]" },
            { t: "本月已通过", v: stats.pass, c: "text-[#00B42A]" },
            { t: "本月已驳回", v: stats.reject, c: "text-[#F53F3F]" },
          ].map((k) => (
            <div key={k.t} className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 ">
              <div className="text-xs text-[#86909C]">{k.t}</div>
              <div className={`mt-1 text-2xl font-bold ${k.c}`}>{k.v} <span className="text-xs font-normal text-[#86909C]">单</span></div>
            </div>
          ))}
        </section>

        <section className="rounded-[4px] border border-[#E5E6EB] bg-white ">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
            <span className="text-sm font-semibold">核算单台账</span>
            <div className="ml-4 flex gap-1">
              {FILTERS.map((x) => (
                <button key={x} onClick={() => setF(x)}
                  className={`rounded-[2px] px-2.5 py-1 text-xs ${f === x ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>
                  {x}
                </button>
              ))}
            </div>
            <Input className="ml-2 w-48" placeholder="搜索核算单号 / 客户 / 合同" value={kw} onChange={(e) => setKw(e.target.value)} />
            <button onClick={() => setOnlyPending(!onlyPending)}
              className={`rounded-[2px] border px-2.5 py-1 text-xs ${onlyPending ? "border-[#FFCF8B] bg-[#FFF7E8] text-[#FF7D00]" : "border-[#E5E6EB] text-[#4E5969] hover:bg-[#F2F3F5]"}`}>
              待补关联{pendingCount > 0 ? `（${pendingCount}）` : ""}
            </button>
            <span className="ml-auto text-xs text-[#86909C]">月成本 = 周期性条目合计；毛利 = 1 − 月成本÷合同月额（简化口径）</span>
          </div>
          {banner && (
            <div className="border-b border-[#FFECE8] bg-[#FFF7F5] px-4 py-2 text-[11px] text-[#F53F3F]">🔒 {banner}</div>
          )}
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">核算单号</th><th className="px-3 py-2">客户 / 合同</th>
                <th className="px-3 py-2">订单行</th><th className="px-3 py-2">月成本(元)</th><th className="px-3 py-2">合同月额(元)</th>
                <th className="px-3 py-2">毛利</th><th className="px-3 py-2">两部门填报</th>
                <th className="px-3 py-2">状态 / 当前节点</th><th className="px-3 py-2">更新时间</th><th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]"
                  onClick={() => nav(["审批中", "已通过", "已驳回", "变更中"].includes(s.status) ? `/approval?id=${s.id}` : "/")}>
                  <td className="px-3 py-2.5 font-mono font-medium text-[#165DFF]">{s.id}</td>
                  <td className="px-3 py-2.5"><div className="font-medium text-[#1D2129]">{s.customer}</div><div className="text-[#86909C]">{s.contract}</div></td>
                  <td className="px-3 py-2.5">{s.lines}</td>
                  <td className="px-3 py-2.5 font-mono">{fmt(s.monthlyCost)}</td>
                  <td className="px-3 py-2.5 font-mono">{fmt(s.contractValue)}</td>
                  <td className={`px-3 py-2.5 font-mono font-semibold ${s.margin >= 40 ? "text-[#00B42A]" : s.margin >= 20 ? "text-[#FF7D00]" : "text-[#F53F3F]"}`}>{s.margin}%</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[#4E5969]">支撑部</span>
                      {s.opsDone ? <span className="text-[#00B42A]">✓</span> : <Progress value={s.techDone ? 60 : 20} className="h-1 w-12" />}
                      <span className="text-[#4E5969]">技术部</span>
                      {s.techDone ? <span className="text-[#00B42A]">✓</span> : <Progress value={s.opsDone ? 60 : 10} className="h-1 w-12" />}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge className={`${STATUS_COLOR[s.status]} hover:bg-inherit`}>{s.status}</Badge>
                    {(s.pendingLink ?? 0) > 0 && <Badge className="ml-1 border border-[#FFCF8B] bg-[#FFF7E8] text-[10px] font-normal text-[#FF7D00] hover:bg-[#FFF7E8]">待补关联 ×{s.pendingLink}</Badge>}
                    {s.curNode && <div className="mt-0.5 text-[10px] text-[#165DFF]">当前节点：{s.curNode}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-[#86909C]">{s.updated}</td>
                  <td className="px-3 py-2.5">
                    {(s.pendingLink ?? 0) > 0 && <Button size="sm" variant="outline" className="mr-1 border-[#FFCF8B] text-[#FF7D00] hover:bg-[#FFF7E8]" onClick={(e) => { e.stopPropagation(); nav("/"); }}>补关联</Button>}
                    {s.status === "审批中" && <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); nav(`/approval?id=${s.id}`); }}>去审批</Button>}
                    {(s.status === "待填写" || s.status === "待对方提交") && <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); nav("/"); }}>去填写</Button>}
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={10} className="px-3 py-10 text-center text-[#86909C]">无匹配核算单</td></tr>}
            </tbody>
          </table>
        </section>
      </main>
    </ArcoShell>
  );
}
