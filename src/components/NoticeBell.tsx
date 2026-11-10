// 顶栏通知铃铛：跨模块待办提醒下拉（核算单待办 / 审批中 / 待补关联 / 逾期账单 / 待处理工单）
// 数据实时取自各台账内存 store（订阅 useXxx 刷新）；点击进入处理页面
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Bell } from "lucide-react";
import { SHEETS } from "@/data/sheets";
import { RECEIVABLES, useReceivables } from "@/data/receivables";
import { dueFollowUps, promiseBroken, promiseOverDays } from "@/data/finance";
import { expiringContracts, daysToEnd } from "@/data/contracts";
import { WORK_ORDERS } from "@/data/delivery";
import { getOpps, useOpps } from "@/data/customers";

interface Notice { level: "red" | "orange" | "blue"; group: string; text: string; to: string }

export default function NoticeBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const v = useReceivables(); useOpps(); // 订阅响应式台账刷新（SHEETS / 工单为静态演示数据）

  const notices = useMemo<Notice[]>(() => {
    const list: Notice[] = [];
    RECEIVABLES.filter((r) => r.status === "逾期" || r.status === "欠停").forEach((r) =>
      list.push({ level: "red", group: "欠费", text: `${r.customer} ${r.invNo} 逾期 ${(r.amount - r.received).toLocaleString("zh-CN")} 元`, to: "/finance?tab=collect" }));
    RECEIVABLES.filter((r) => promiseBroken(r)).forEach((r) =>
      list.push({ level: "orange", group: "破约", text: `${r.customer} ${r.invNo} 承诺付款日 ${r.promiseDate} 已破约 ${promiseOverDays(r)} 天，需升级催收`, to: "/finance?tab=collect" }));
    dueFollowUps().forEach((c) =>
      list.push({ level: "blue", group: "催收", text: `${c.customer} ${c.invNo} 催收跟进到期（${c.by} 上次${c.channel}跟进约定 ${c.nextFollowAt} 复查）`, to: "/finance?tab=collect" }));
    SHEETS.filter((s) => s.status === "审批中" || s.status === "变更中").forEach((s) =>
      list.push({ level: "orange", group: "审批", text: `核算单 ${s.id}（${s.customer}）待审批：${s.curNode ?? ""}`, to: `/approval?id=${s.id}` }));
    SHEETS.filter((s) => (s.pendingLink ?? 0) > 0).forEach((s) =>
      list.push({ level: "blue", group: "补关联", text: `核算单 ${s.id} 有 ${s.pendingLink} 条手工暂填待补关联`, to: "/cost" }));
    WORK_ORDERS.filter((w) => w.step < 6).slice(0, 5).forEach((w) =>
      list.push({ level: "orange", group: "工单", text: `开通工单 ${w.id}（${w.customer}）执行中`, to: `/delivery/detail?id=${w.id}` }));
    getOpps().filter((d) => d.stage === "赢单").slice(0, 3).forEach((d) =>
      list.push({ level: "blue", group: "商机", text: `商机 ${d.id} 已赢单待签约：${d.name}`, to: "/opportunity" }));
    expiringContracts(90).slice(0, 5).forEach((c) =>
      list.push({ level: daysToEnd(c) <= 30 ? "orange" : "blue", group: "到期", text: `合同 ${c.id}（${c.customer}）将于 ${c.end} 到期，剩 ${daysToEnd(c)} 天，月租 ${c.amount.toLocaleString("zh-CN")} 元/月`, to: "/contract" }));
    return list;
  }, [v]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const DOT = { red: "bg-[#F53F3F]", orange: "bg-[#FF7D00]", blue: "bg-[#165DFF]" } as const;

  return (
    <div ref={boxRef} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#4E5969] transition-colors hover:bg-[#F2F3F5]">
        <Bell size={17} strokeWidth={1.8} />
        {notices.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#E11D48] ring-2 ring-white" />}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[400px] overflow-hidden rounded-[8px] border border-[#E5E6EB] bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#F2F3F5] px-4 py-2.5">
            <span className="text-[13px] font-semibold text-[#1D2129]">待办提醒</span>
            <span className="text-[11px] text-[#86909C]">{notices.length} 项</span>
          </div>
          <div className="max-h-[340px] overflow-y-auto py-1">
            {notices.map((n, i) => (
              <button key={i} onClick={() => { setOpen(false); navigate(n.to); }} className="flex w-full items-start gap-2.5 px-4 py-2 text-left hover:bg-[#F7F8FA]">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT[n.level]}`} />
                <span className="min-w-0">
                  <span className="mr-1.5 rounded-[2px] bg-[#F2F3F5] px-1 py-0.5 text-[10px] text-[#4E5969]">{n.group}</span>
                  <span className="text-[12px] text-[#1D2129]">{n.text}</span>
                </span>
              </button>
            ))}
            {!notices.length && <div className="px-4 py-8 text-center text-[12px] text-[#C9CDD4]">暂无待办，一切正常</div>}
          </div>
        </div>
      )}
    </div>
  );
}
