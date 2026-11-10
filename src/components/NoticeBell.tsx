// 顶栏通知铃铛：双页签 —— 「待办」跨模块实时台账提醒；「通知」业务事件留痕（已读未读持久化）
// 数据：待办实时取自各台账内存 store；通知取自 notices.ts（persistable），点击进入处理页并标记已读
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Bell, CheckCheck } from "lucide-react";
import { SHEETS } from "@/data/sheets";
import { RECEIVABLES, useReceivables } from "@/data/receivables";
import { dueFollowUps, promiseBroken, promiseOverDays } from "@/data/finance";
import { expiringContracts, daysToEnd } from "@/data/contracts";
import { WORK_ORDERS } from "@/data/delivery";
import { getOpps, useOpps } from "@/data/customers";
import { getNotices, markRead, markAllRead, unreadCount, useNotices } from "@/data/notices";

interface Todo { level: "red" | "orange" | "blue"; group: string; text: string; to: string }

export default function NoticeBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"todo" | "notice">("todo");
  const boxRef = useRef<HTMLDivElement>(null);
  const v = useReceivables(); useOpps(); useNotices(); // 订阅响应式台账/通知刷新

  const todos = useMemo<Todo[]>(() => {
    const list: Todo[] = [];
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

  const notices = getNotices();
  const unread = unreadCount();
  const badge = todos.length + unread;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const DOT = { red: "bg-[#F53F3F]", orange: "bg-[#FF7D00]", blue: "bg-[#165DFF]", green: "bg-[#00B42A]" } as const;
  const LVL_TXT = { red: "text-[#F53F3F]", orange: "text-[#FF7D00]", blue: "text-[#165DFF]", green: "text-[#00B42A]" } as const;

  return (
    <div ref={boxRef} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#4E5969] transition-colors hover:bg-[#F2F3F5]">
        <Bell size={17} strokeWidth={1.8} />
        {badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-[8px] bg-[#E11D48] px-1 text-[10px] font-semibold text-white ring-2 ring-white">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[420px] overflow-hidden rounded-[8px] border border-[#E5E6EB] bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#F2F3F5] px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-semibold text-[#1D2129]">消息</span>
              <div className="flex rounded-[4px] bg-[#F2F3F5] p-0.5">
                {([["todo", `待办 ${todos.length}`], ["notice", `通知 ${unread ? `(${unread})` : ""}`]] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setTab(k)} className={`rounded-[3px] px-2.5 py-0.5 text-[11px] transition-colors ${tab === k ? "bg-white font-medium text-[#165DFF] shadow-sm" : "text-[#86909C] hover:text-[#4E5969]"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {tab === "notice" && unread > 0 && (
              <button onClick={() => markAllRead()} className="flex items-center gap-1 text-[11px] text-[#86909C] hover:text-[#165DFF]">
                <CheckCheck size={12} /> 全部已读
              </button>
            )}
          </div>

          {tab === "todo" ? (
            <div className="max-h-[340px] overflow-y-auto py-1">
              {todos.map((n, i) => (
                <button key={i} onClick={() => { setOpen(false); navigate(n.to); }} className="flex w-full items-start gap-2.5 px-4 py-2 text-left hover:bg-[#F7F8FA]">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT[n.level]}`} />
                  <span className="min-w-0">
                    <span className="mr-1.5 rounded-[2px] bg-[#F2F3F5] px-1 py-0.5 text-[10px] text-[#4E5969]">{n.group}</span>
                    <span className="text-[12px] text-[#1D2129]">{n.text}</span>
                  </span>
                </button>
              ))}
              {!todos.length && <div className="px-4 py-8 text-center text-[12px] text-[#C9CDD4]">暂无待办，一切正常</div>}
            </div>
          ) : (
            <div className="max-h-[340px] overflow-y-auto py-1">
              {notices.slice(0, 20).map((n) => (
                <button key={n.id} onClick={() => { markRead(n.id); setOpen(false); navigate(n.to); }} className={`flex w-full items-start gap-2.5 px-4 py-2 text-left hover:bg-[#F7F8FA] ${n.read ? "opacity-60" : ""}`}>
                  <span className={`mt-0.5 shrink-0 rounded-[2px] px-1 py-0.5 text-[10px] font-medium ${LVL_TXT[n.level]} bg-[#F7F8FA]`}>{n.group}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E11D48]" />}
                      <span className={`text-[12px] ${n.read ? "text-[#4E5969]" : "font-medium text-[#1D2129]"}`}>{n.title}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-[#C9CDD4]">{n.at.slice(5)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-[#86909C]">{n.text}</span>
                  </span>
                </button>
              ))}
              {!notices.length && <div className="px-4 py-8 text-center text-[12px] text-[#C9CDD4]">暂无通知</div>}
            </div>
          )}

          <button onClick={() => { setOpen(false); navigate("/notifications"); }} className="block w-full border-t border-[#F2F3F5] py-2 text-center text-[11px] text-[#165DFF] hover:bg-[#F7F8FA]">
            查看全部通知 →
          </button>
        </div>
      )}
    </div>
  );
}
