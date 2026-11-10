// 合同管理列表（/contract）
// 页签 + 搜索；合同号链接进详情；新建合同（合同+订单合二为一）
// 布局口径：6 列主表（合同 / 订单内容 / 商务条件 / 期限 / 进度 / 操作），签署链路用迷你步点呈现
import { useState } from "react";
import { useNavigate } from "react-router";
import { CONTRACTS, fmtMoney, expiringContracts, daysToEnd, type ContractStatus } from "@/data/contracts";
import { ENTITY_NAME } from "@/data/entities";
import ArcoShell from "@/components/ArcoShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const STATUS_CLS: Record<ContractStatus, string> = {
  审批中: "bg-[#E8F3FF] text-[#165DFF]",
  已驳回: "bg-[#FFECE8] text-[#F53F3F]",
  待出合同: "bg-[#E8F8F2] text-[#00701A]",
  待用章: "bg-[#F2F3F5] text-[#4E5969]",
  签署中: "bg-[#E8F3FF] text-[#165DFF]",
  已生效: "bg-[#E8F8F2] text-[#00B42A]",
  待修订: "bg-[#FFF3E8] text-[#FF7D00]",
  已终止: "bg-[#FFECE8] text-[#F53F3F]",
};

const TABS: (ContractStatus | "全部")[] = ["全部", "审批中", "待出合同", "待用章", "签署中", "已生效", "待修订", "已终止"];

/** 签署链路迷你步点：仅在待用章 / 签署中展示，4 步进度一目了然 */
const SignDots = ({ step, seal }: { step: number; seal: "online" | "offline" }) => (
  <span className="inline-flex items-center gap-1" title={seal === "online" ? "线上 · 契约锁" : "线下 · 实物章"}>
    {[0, 1, 2, 3].map((i) => (
      <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < step ? "bg-[#00B42A]" : i === step ? "bg-[#165DFF]" : "bg-[#E5E6EB]"}`} />
    ))}
    <span className="ml-0.5 text-[10px] text-[#86909C]">{step + 1}/4</span>
  </span>
);

export default function ContractList() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]>("全部");
  const [kw, setKw] = useState("");
  const shown = CONTRACTS.filter((c) => (tab === "全部" || c.status === tab) && (!kw || c.id.includes(kw) || c.customer.includes(kw)));
  const expiring = expiringContracts(90);
  const tabCount = (t: (typeof TABS)[number]) => (t === "全部" ? CONTRACTS.length : CONTRACTS.filter((c) => c.status === t).length);

  return (
    <ArcoShell breadcrumb="合同管理">
      <main className="space-y-3 p-6">
        {expiring.length > 0 && (
          <div className="flex items-center justify-between rounded-[4px] border border-[#FFE1B3] bg-[#FFF7E8] px-4 py-2.5 text-[12px]">
            <span className="text-[#B25E00]">
              ⏳ <strong>{expiring.length}</strong> 份生效合同将于 90 天内到期（合计月租 <strong className="font-mono">{fmtMoney(expiring.reduce((s, c) => s + c.amount, 0))}</strong> 元/月）
              {expiring.slice(0, 3).map((c) => <span key={c.id} className="ml-3 text-[#4E5969]">{c.id}（{c.customer}，剩 {daysToEnd(c)} 天）</span>)}
              {expiring.length > 3 && <span className="ml-1 text-[#86909C]">等</span>}
            </span>
            <button onClick={() => { setTab("已生效"); }} className="shrink-0 text-[#165DFF] hover:underline">查看生效合同 →</button>
          </div>
        )}

        {/* 工具栏：标题 + 当前范围汇总 | 搜索 + 新建 */}
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-3">
          <div>
            <span className="text-sm font-semibold text-[#1D2129]">合同管理</span>
            <span className="ml-3 text-xs text-[#86909C]">
              当前范围 <strong className="text-[#1D2129]">{shown.length}</strong> 份 · 月租合计
              <strong className="ml-1 font-mono text-[#1D2129]">{fmtMoney(shown.reduce((s, c) => s + c.amount, 0))}</strong> 元/月
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Input className="w-56" placeholder="搜索合同号 / 客户" value={kw} onChange={(e) => setKw(e.target.value)} />
            <Button size="sm" onClick={() => navigate("/contract/edit")}>＋ 新建合同</Button>
          </div>
        </div>

        {/* 状态页签：独立成行，徽标计数 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map((t) => {
            const n = tabCount(t);
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  active ? "border-[#165DFF] bg-[#165DFF] text-white" : "border-[#E5E6EB] bg-white text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]"
                }`}>
                {t}
                <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-white/20 text-white" : "bg-[#F2F3F5] text-[#86909C]"}`}>{n}</span>
              </button>
            );
          })}
        </div>

        {/* 主表：6 列，行点击进详情 */}
        <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-4 py-2.5">合同</th>
                <th className="px-3 py-2.5">订单内容</th>
                <th className="px-3 py-2.5 text-right">月租（元/月）</th>
                <th className="px-3 py-2.5">期限</th>
                <th className="px-3 py-2.5">进度</th>
                <th className="px-3 py-2.5 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const left = daysToEnd(c);
                const signing = c.status === "待用章" || c.status === "签署中";
                const action = c.status === "审批中" ? "去审批" : signing ? "去签署" : c.status === "已生效" ? "查看" : "查看";
                return (
                  <tr key={c.id} className="cursor-pointer border-b last:border-0 hover:bg-[#F7FAFF]" onClick={() => navigate(`/contract/detail?id=${c.id}`)}>
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-[#165DFF]">{c.id}</div>
                      <div className="mt-0.5 font-medium text-[#1D2129]">{c.customer}</div>
                      <div className="mt-0.5 text-[10px] text-[#86909C]">{ENTITY_NAME(c.entityId)}</div>
                    </td>
                    <td className="max-w-[260px] px-3 py-3">
                      <div className="truncate text-[#1D2129]" title={c.lines.map((l) => l.ptype).join(" + ")}>{c.lines.map((l) => l.ptype).join(" + ")}</div>
                      <div className="mt-0.5 text-[10px] text-[#86909C]">{c.lines.length} 个订单行 · {c.pay}{c.discount ? ` · 折扣 ${c.discount}%` : " · 标准价"}{c.specialId ? `（${c.specialId}）` : ""}</div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm font-semibold text-[#1D2129]">{fmtMoney(c.amount)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-[#4E5969]">
                      <div>{c.start} ~ {c.end}</div>
                      {c.status === "已生效" && left <= 90 && (
                        <span className={`mt-1 inline-block rounded-[2px] px-1.5 py-0.5 text-[10px] ${left <= 30 ? "bg-[#FFECE8] text-[#F53F3F]" : "bg-[#FFF3E8] text-[#FF7D00]"}`}>
                          剩 {left} 天到期
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${STATUS_CLS[c.status]}`}>{c.status}</span>
                        <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${c.seal === "online" ? "bg-[#E8F3FF] text-[#165DFF]" : "bg-[#FFF3E8] text-[#FF7D00]"}`}>
                          {c.seal === "online" ? "契约锁" : "实物章"}
                        </span>
                      </div>
                      {signing && <div className="mt-1.5"><SignDots step={Math.min(c.step, 3)} seal={c.seal} /></div>}
                      {c.status === "已生效" && c.renewOf && <div className="mt-1 text-[10px] text-[#86909C]">续签自 {c.renewOf}</div>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button className="rounded-[2px] border border-[#E5E6EB] px-2.5 py-1 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]"
                        onClick={(e) => { e.stopPropagation(); navigate(`/contract/detail?id=${c.id}`); }}>
                        {action}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!shown.length && (
                <tr><td colSpan={6} className="px-3 py-12 text-center text-[#86909C]">
                  {kw ? `未找到匹配「${kw}」的合同` : "该状态下暂无合同"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          合同与订单合二为一：订单行在合同起草时一次填齐，合同生效即订单生效，售价取合同约定价直接进入成本核算；
          续签合同生效时源合同自动终止并停止出账。上传正式合同时校验折扣率与特批单一致，不一致拦截。
        </div>
      </main>
    </ArcoShell>
  );
}
