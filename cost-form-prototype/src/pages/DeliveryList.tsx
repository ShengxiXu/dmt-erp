import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { WORK_ORDERS, STEP_NAMES } from "@/data/delivery";
import ArcoShell from "@/components/ArcoShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ClipboardCheck, FileSearch, Wrench, CircleCheck, AlarmClock } from "lucide-react";

const STEP_COLOR = ["bg-[#E8F3FF] text-[#165DFF]", "bg-[#E8F3FF] text-[#165DFF]", "bg-[#E8F3FF] text-[#165DFF]", "bg-[#BEDAFF] text-[#165DFF]", "bg-[#FFF3E8] text-[#FF7D00]", "bg-[#FFF3E8] text-[#FF7D00]", "bg-[#E8F8F2] text-[#00B42A]"];

const TODAY = new Date("2026-10-23");
/** 临期：距要求完成 ≤ 7 天且未完工 */
const isUrgent = (deadline: string, step: number) => {
  if (step >= 6) return false;
  const diff = (new Date(deadline).getTime() - TODAY.getTime()) / 86400000;
  return diff <= 7;
};

export default function DeliveryList() {
  const nav = useNavigate();
  const [kw, setKw] = useState("");
  const shown = WORK_ORDERS.filter((w) => !kw || w.id.includes(kw) || w.sheetId.includes(kw) || w.customer.includes(kw) || w.contract.includes(kw) || w.line.includes(kw) || w.assignee.includes(kw));
  const stats = useMemo(() => ({
    check: WORK_ORDERS.filter((w) => w.step === 0).length,
    applying: WORK_ORDERS.filter((w) => w.step >= 1 && w.step <= 2).length,
    doing: WORK_ORDERS.filter((w) => w.step >= 3 && w.step <= 5).length,
    done: WORK_ORDERS.filter((w) => w.step >= 6).length,
    urgent: WORK_ORDERS.filter((w) => isUrgent(w.deadline, w.step)).length,
  }), []);

  return (
    <ArcoShell breadcrumb="开通工单">
      <main className="space-y-4 p-6">
        {/* 统计卡行：先回答"哪些工单需要我盯" */}
        <section className="grid gap-3 md:grid-cols-5">
          {[
            { t: "待可用性检查", v: stats.check, icon: FileSearch, c: "bg-[#E8F3FF] text-[#165DFF]", n: "text-[#165DFF]" },
            { t: "分配申请 / 审批中", v: stats.applying, icon: ClipboardCheck, c: "bg-[#E8F3FF] text-[#165DFF]", n: "text-[#165DFF]" },
            { t: "实施 / 确认中", v: stats.doing, icon: Wrench, c: "bg-[#FFF3E8] text-[#FF7D00]", n: "text-[#FF7D00]" },
            { t: "已开通", v: stats.done, icon: CircleCheck, c: "bg-[#E8F8F2] text-[#00B42A]", n: "text-[#00B42A]" },
            { t: "临期（≤7 天）", v: stats.urgent, icon: AlarmClock, c: "bg-[#FFECE8] text-[#F53F3F]", n: "text-[#F53F3F]" },
          ].map((k) => (
            <div key={k.t} className="flex items-center gap-3 rounded-[4px] border border-[#E5E6EB] bg-white p-4">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] ${k.c}`}>
                <k.icon size={16} />
              </span>
              <div>
                <div className={`text-xl font-semibold leading-6 ${k.n}`}>{k.v}</div>
                <div className="text-xs text-[#86909C]">{k.t}</div>
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 text-xs leading-5 text-[#4E5969]">
          <span className="font-semibold text-[#1D2129]">流程：</span>
          成本核算审批通过 → 系统自动生成开通工单 → ①资源可用性检查（出口负载由工程师评估，IP/CPE 余量系统自动校验）→ ②资源分配申请 → ③资源分配审批（审批流可配置）→ ④资源绑定与扣减（②层数据在此刻写入）→ ⑤开通实施 → ⑥开通确认 → ⑦激活计费（计费起点，账期按开通日滚动）。
          <span className="ml-2 text-[#86909C]">注意：资源占用的生效点在成本核算审批通过（预选锁定），绑定扣减是物理资源落位。</span>
        </section>

        <section className="rounded-[4px] border border-[#E5E6EB] bg-white">
          <div className="flex h-12 items-center justify-between border-b border-[#F2F3F5] px-5">
            <span className="text-[16px] font-medium">开通工单台账</span>
            <div className="flex items-center gap-3">
              <Input className="w-56" placeholder="搜索工单号 / 核算单 / 客户 / 开通对象" value={kw} onChange={(e) => setKw(e.target.value)} />
              <span className="text-[13px] text-[#86909C]">{shown.length} 单 · 整行可点进入处理</span>
            </div>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">工单号</th><th className="px-3 py-2">关联核算单</th><th className="px-3 py-2">客户 / 合同</th>
                <th className="px-3 py-2">开通对象</th><th className="px-3 py-2">进度</th>
                <th className="px-3 py-2">当前环节</th><th className="px-3 py-2">负责人</th><th className="px-3 py-2">要求完成</th><th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((w) => {
                const urgent = isUrgent(w.deadline, w.step);
                return (
                  <tr key={w.id} className="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]" onClick={() => nav(`/delivery/detail?id=${w.id}`)}>
                    <td className="px-3 py-2.5 font-mono font-medium text-[#165DFF]">{w.id}</td>
                    <td className="px-3 py-2.5 font-mono text-[#4E5969]">{w.sheetId}</td>
                    <td className="px-3 py-2.5"><div className="font-medium text-[#1D2129]">{w.customer}</div><div className="text-[#86909C]">{w.contract}</div></td>
                    <td className="px-3 py-2.5">{w.line}</td>
                    <td className="px-3 py-2.5"><div className="flex items-center gap-1.5"><Progress value={(w.step / 6) * 100} className="h-1.5 w-20" /><span className="text-[#86909C]">{w.step}/6</span></div></td>
                    <td className="px-3 py-2.5"><Badge className={`${STEP_COLOR[w.step]} hover:bg-inherit`}>{STEP_NAMES[w.step]}</Badge></td>
                    <td className="px-3 py-2.5">{w.assignee}</td>
                    <td className="px-3 py-2.5">
                      <span className={urgent ? "font-medium text-[#F53F3F]" : "text-[#86909C]"}>{w.deadline}</span>
                      {urgent && <Badge className="ml-1.5 bg-[#FFECE8] text-[#F53F3F] hover:bg-[#FFECE8]">临期</Badge>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); nav(`/delivery/detail?id=${w.id}`); }}>处理</Button>
                    </td>
                  </tr>
                );
              })}
              {!shown.length && <tr><td colSpan={9} className="px-3 py-10 text-center text-[#86909C]">无匹配工单</td></tr>}
            </tbody>
          </table>
        </section>
      </main>
    </ArcoShell>
  );
}
