// 消息通知中心（/notifications）：业务事件全量列表
// 与铃铛下拉的关系：铃铛看「现在要办的事」（实时台账派生）+ 最近通知；本页是事件留痕的完整检索
// 支持：按分类/级别/已读筛选、单条已读、全部已读、点击跳转处理页
import { useState } from "react";
import { useNavigate } from "react-router";
import { CheckCheck, Filter } from "lucide-react";
import ArcoShell from "@/components/ArcoShell";
import { getNotices, markAllRead, markRead, useNotices, type NoticeLevel } from "@/data/notices";
import { Button } from "@/components/ui/button";

const LVL_DOT: Record<NoticeLevel, string> = { red: "bg-[#F53F3F]", orange: "bg-[#FF7D00]", blue: "bg-[#165DFF]", green: "bg-[#00B42A]" };
const LVL_TXT: Record<NoticeLevel, string> = { red: "紧急", orange: "预警", blue: "普通", green: "完成" };

export default function Notifications() {
  useNotices();
  const navigate = useNavigate();
  const notices = getNotices();
  const [group, setGroup] = useState("全部");
  const [level, setLevel] = useState("全部");
  const [readFilter, setReadFilter] = useState<"全部" | "未读" | "已读">("全部");

  const groups = ["全部", ...Array.from(new Set(notices.map((n) => n.group)))];
  const levels = ["全部", "red", "orange", "blue", "green"];
  const shown = notices.filter((n) =>
    (group === "全部" || n.group === group) &&
    (level === "全部" || n.level === level) &&
    (readFilter === "全部" || (readFilter === "未读" ? !n.read : n.read)));

  return (
    <ArcoShell breadcrumb="消息通知中心">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#1D2129]">消息通知中心</span>
            <span className="text-[11px] text-[#86909C]">
              业务事件留痕（谁、何时、做了什么）；待办请看顶栏铃铛「待办」页签
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={() => markAllRead()}>
            <CheckCheck size={13} className="mr-1" /> 全部标记已读
          </Button>
        </div>

        {/* 筛选行 */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[12px]">
          <span className="flex items-center gap-1.5 text-[#86909C]"><Filter size={13} /> 筛选</span>
          <span className="flex items-center gap-1.5">
            <span className="text-[#86909C]">分类</span>
            {groups.map((g) => (
              <button key={g} onClick={() => setGroup(g)} className={`rounded-[2px] px-2 py-0.5 ${group === g ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{g}</button>
            ))}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[#86909C]">级别</span>
            {levels.map((l) => (
              <button key={l} onClick={() => setLevel(l)} className={`flex items-center gap-1 rounded-[2px] px-2 py-0.5 ${level === l ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>
                {l !== "全部" && <span className={`h-1.5 w-1.5 rounded-full ${LVL_DOT[l as NoticeLevel]}`} />}
                {l === "全部" ? "全部" : LVL_TXT[l as NoticeLevel]}
              </button>
            ))}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[#86909C]">状态</span>
            {(["全部", "未读", "已读"] as const).map((r) => (
              <button key={r} onClick={() => setReadFilter(r)} className={`rounded-[2px] px-2 py-0.5 ${readFilter === r ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{r}</button>
            ))}
          </span>
          <span className="ml-auto text-[11px] text-[#86909C]">共 {shown.length} 条</span>
        </div>

        {/* 列表 */}
        <div className="overflow-hidden rounded-[4px] border border-[#E5E6EB] bg-white">
          {shown.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 border-b px-4 py-3 last:border-0 hover:bg-[#F7F8FA] ${n.read ? "opacity-65" : ""}`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${LVL_DOT[n.level]}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {!n.read && <span className="rounded-[2px] bg-[#FFECE8] px-1 py-0.5 text-[10px] text-[#F53F3F]">未读</span>}
                  <span className="rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] text-[#4E5969]">{n.group}</span>
                  <span className={`text-[13px] ${n.read ? "text-[#4E5969]" : "font-semibold text-[#1D2129]"}`}>{n.title}</span>
                  <span className="ml-auto shrink-0 font-mono text-[11px] text-[#C9CDD4]">{n.at}</span>
                </div>
                <div className="mt-1 text-[12px] leading-5 text-[#86909C]">{n.text}</div>
              </div>
              <div className="flex shrink-0 gap-1.5 pt-0.5">
                <button onClick={() => { markRead(n.id); navigate(n.to); }} className="rounded-[2px] border border-[#165DFF] px-2 py-0.5 text-[11px] text-[#165DFF] hover:bg-[#F0F5FF]">去处理 →</button>
                {!n.read && (
                  <button onClick={() => markRead(n.id)} className="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#86909C] hover:border-[#165DFF] hover:text-[#165DFF]">标为已读</button>
                )}
              </div>
            </div>
          ))}
          {!shown.length && <div className="py-12 text-center text-[12px] text-[#C9CDD4]">没有符合筛选条件的通知</div>}
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          通知由业务动作自动产生（提交审批 / 审批通过或驳回 / 开票 / 回款 / 红冲 / 欠停复机 / 逾期扫描 / 采购下单 / 审批流配置变更等），
          与「待办」的区别：待办 = 台账里当前还挂着、需要你处理的事；通知 = 已经发生的事件留痕，用于追溯与知会。
        </div>
      </main>
    </ArcoShell>
  );
}
