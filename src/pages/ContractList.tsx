// 合同管理列表（/contract）
// 状态页签 + 搜索；合同号链接进详情；新建合同（合同+订单合二为一）
import { useState } from "react";
import { useNavigate } from "react-router";
import { Download } from "lucide-react";
import { CONTRACTS, ONLINE_STEPS, OFFLINE_STEPS, fmtMoney, expiringContracts, daysToEnd, type ContractStatus } from "@/data/contracts";
import { ENTITY_NAME } from "@/data/entities";
import { inDataScope, scopeBanner } from "@/data/users";
import { ownerOfDeal } from "@/data/ownership";
import { DEMO_TODAY } from "@/data/settings";
import { exportCsv } from "@/utils/exportCsv";
import ArcoShell from "@/components/ArcoShell";
import ExpiryBadge from "@/components/ExpiryBadge";
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

export default function ContractList() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]>("全部");
  const [kw, setKw] = useState("");
  const [onlyExpiring, setOnlyExpiring] = useState(false);
  // 数据权限：合同沿「商机 → 客户」链路解析归属人后按角色数据范围过滤
  const scoped = CONTRACTS.filter((c) => inDataScope(ownerOfDeal(c.dealId, c.customer)));
  const expiringScoped = scoped.filter((c) => c.status === "已生效" && daysToEnd(c) <= 90);
  const shown = scoped.filter((c) => (tab === "全部" || c.status === tab) && (!kw || c.id.includes(kw) || c.customer.includes(kw)))
    .filter((c) => !onlyExpiring || (c.status === "已生效" && daysToEnd(c) <= 90));
  const banner = scopeBanner(CONTRACTS.length - scoped.length);
  const expiring = expiringContracts(90);

  return (
    <ArcoShell breadcrumb="合同管理">
      <main className="space-y-4 p-6">
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
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#1D2129]">合同管理</span>
            <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
              {TABS.map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`rounded-[2px] px-2.5 py-1 text-xs ${tab === t ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>
                  {t}{t !== "全部" ? `（${scoped.filter((c) => c.status === t).length}）` : ""}
                </button>
              ))}
            </div>
            <Input className="w-52" placeholder="搜索合同号 / 客户" value={kw} onChange={(e) => setKw(e.target.value)} />
            <button onClick={() => setOnlyExpiring(!onlyExpiring)} title="只看 90 天内到期 / 已逾期的生效合同"
              className={`rounded-[2px] border px-2.5 py-1.5 text-xs transition-colors ${onlyExpiring ? "border-[#FF7D00] bg-[#FFF7E8] font-medium text-[#FF7D00]" : "border-[#E5E6EB] text-[#4E5969] hover:border-[#FF7D00] hover:text-[#FF7D00]"}`}>
              ⏳ 临期预警{expiringScoped.length ? `（${expiringScoped.length}）` : ""}
            </button>
            <button onClick={() => exportCsv(`合同台账_${DEMO_TODAY}`, ["合同号", "客户", "订单内容", "月租合计(元)", "付款方式", "折扣", "签约主体", "状态", "合同期限"],
              shown.map((c) => [c.id, c.customer, c.lines.map((l) => l.ptype).join("+"), c.amount, c.pay, c.discount ? `${c.discount}%` : "标准", ENTITY_NAME(c.entityId), c.status, `${c.start} ~ ${c.end}`]))}
              className="flex items-center gap-1 rounded-[2px] border border-[#E5E6EB] px-2.5 py-1.5 text-xs text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">
              <Download size={12} /> 导出
            </button>
          </div>
          <Button size="sm" onClick={() => navigate("/contract/edit")}>＋ 新建合同</Button>
        </div>

        {banner && (
          <div className="rounded-[4px] border border-[#FFECE8] bg-[#FFF7F5] px-4 py-2 text-[11px] text-[#F53F3F]">🔒 {banner}</div>
        )}

        <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">合同号</th><th className="px-3 py-2">客户</th><th className="px-3 py-2">订单内容摘要</th>
                <th className="px-3 py-2 text-right">月租合计（元）</th><th className="px-3 py-2">付款方式</th><th className="px-3 py-2">折扣</th>
                <th className="px-3 py-2">签约主体</th><th className="px-3 py-2">用章方式</th><th className="px-3 py-2">状态 / 签署进度</th><th className="px-3 py-2">合同期限</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const steps = c.seal === "online" ? ONLINE_STEPS : OFFLINE_STEPS;
                return (
                  <tr key={c.id} className="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]" onClick={() => navigate(`/contract/detail?id=${c.id}`)}>
                    <td className="px-3 py-2.5 font-mono text-[#165DFF]">{c.id}</td>
                    <td className="px-3 py-2.5 font-medium text-[#1D2129]">{c.customer}</td>
                    <td className="max-w-[220px] truncate px-3 py-2.5 text-[#4E5969]">{c.lines.map((l) => l.ptype).join(" + ")}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmtMoney(c.amount)}</td>
                    <td className="px-3 py-2.5 text-[#4E5969]">{c.pay}</td>
                    <td className="px-3 py-2.5 font-mono text-[#4E5969]">{c.discount ? `${c.discount}%${c.specialId ? `（${c.specialId}）` : ""}` : "标准"}</td>
                    <td className="px-3 py-2.5 text-[#4E5969]">{ENTITY_NAME(c.entityId)}</td>
                    <td className="px-3 py-2.5 text-[#4E5969]">{c.seal === "online" ? "线上·契约锁" : "线下·实物章"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${STATUS_CLS[c.status]}`}>{c.status}</span>
                      {c.status === "签署中" && <span className="ml-1.5 text-[10px] text-[#86909C]">{steps[c.step]} · {c.step + 1}/4</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[#86909C]">
                      {c.start} ~ {c.end}
                      {c.status === "已生效" && <ExpiryBadge days={daysToEnd(c)} />}
                    </td>
                    <td className="px-3 py-2.5 text-right"><button className="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">{c.status === "审批中" ? "去审批" : c.status === "待用章" || c.status === "签署中" ? "去签署" : "查看"}</button></td>
                  </tr>
                );
              })}
              {!shown.length && <tr><td colSpan={11} className="px-3 py-10 text-center text-[#86909C]">该状态下暂无合同</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          合同与订单合二为一：订单行在合同起草时一次填齐，合同生效即订单生效，售价取合同约定价直接进入成本核算；
          合同生效同时启动到期提醒与回收倒计时。上传正式合同时校验折扣率与特批单一致，不一致拦截。
        </div>
      </main>
    </ArcoShell>
  );
}
