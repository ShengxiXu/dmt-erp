// 经营分析（/analytics）：面向管理层的一页式经营视图
// 数据全部从现有台账推导：应收（收入趋势）、商机（pipeline）、合同（合同额）、出口资源池（成本/利用率）、月结批次（毛利）
// 财务 KPI / 账龄 / DSO 一律取 finance.ts 共享派生层（口径唯一出处），本页不重算，与财务中心严格一致
import { useMemo } from "react";
import { Link } from "react-router";
import ArcoShell from "@/components/ArcoShell";
import { CONTRACTS, fmtMoney, expiringContracts, daysToEnd } from "@/data/contracts";
import { getOpps } from "@/data/customers";
import { RECEIVABLES } from "@/data/receivables";
import { agingBuckets, dsoDays, badDebtRisk, financeKPIs, FIN_TODAY } from "@/data/finance";
import { R1_ROWS } from "@/data/resources";
import { getBatches } from "@/data/settle";
import { DEMO_TODAY } from "@/data/settings";

const fmt = (n: number) => fmtMoney(Math.round(n));

/** 简易横向条形图 */
function Bars({ rows, color = "#165DFF", money = true }: { rows: { label: string; value: number }[]; color?: string; money?: boolean }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-0.5 flex justify-between text-[11px]">
            <span className="text-[#4E5969]">{r.label}</span>
            <span className="font-mono text-[#1D2129]">{money ? `${fmt(r.value)} 元` : r.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-[2px] bg-[#F2F3F5]">
            <div className="h-full rounded-[2px] transition-all" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const data = useMemo(() => {
    // ① 月度收入趋势（应收口径，按应收日期归月）
    const byMonth = new Map<string, { amount: number; received: number }>();
    for (const r of RECEIVABLES) {
      const m = r.dueDate.slice(0, 7);
      const cur = byMonth.get(m) ?? { amount: 0, received: 0 };
      cur.amount += r.amount; cur.received += r.received;
      byMonth.set(m, cur);
    }
    const months = [...byMonth.keys()].sort();
    const revenueTrend = months.map((m) => ({ label: m, value: byMonth.get(m)!.amount, received: byMonth.get(m)!.received }));

    // ② 商机 pipeline 漏斗（按阶段合计预计合同额）
    const opps = getOpps();
    const STAGES = ["线索", "跟进中", "已报价", "赢单", "输单"] as const;
    const stageOf = (s: string) => (STAGES as readonly string[]).includes(s) ? s : "跟进中";
    const pipeline = STAGES.map((st) => ({
      label: st,
      count: opps.filter((d) => stageOf(d.stage) === st).length,
      value: opps.filter((d) => stageOf(d.stage) === st).reduce((s, d) => s + (d.expectAmount || 0), 0),
    }));

    // ③ 合同额 vs 成本（已生效合同月租合计 vs 在用出口池月租成本）
    const activeContracts = CONTRACTS.filter((c) => c.status === "已生效");
    const monthlyRevenue = activeContracts.reduce((s, c) => s + c.amount, 0);
    const monthlyExitCost = R1_ROWS.filter((r) => r.status === "生效").reduce((s, r) => s + r.monthlyCost, 0);
    const grossMargin = monthlyRevenue - monthlyExitCost;
    const marginRate = monthlyRevenue ? Math.round((grossMargin / monthlyRevenue) * 1000) / 10 : 0;

    // ④ 出口池利用率
    const pools = R1_ROWS.map((r) => ({ label: r.name, value: r.capacityM ? Math.round((r.dynamic.usedM / r.capacityM) * 1000) / 10 : 0, used: r.dynamic.usedM, cap: r.capacityM }));

    // ⑤ 应收账龄 / 财务 KPI / DSO —— 全部取 finance.ts 共享口径（唯一出处，本页不重算）
    const aging = agingBuckets();
    const agingTotal = aging.reduce((s, b) => s + b.amount, 0);
    const kpi = financeKPIs();
    const dso = dsoDays();
    const bdr = badDebtRisk();
    const outstandingN = RECEIVABLES.filter((r) => r.received < r.amount).length;

    // ⑥ 已跑月结批次的毛利（若用户在月结页跑过）
    const batches = getBatches().slice(-3);

    // ⑦ 合同到期看板（未来 90 天，按剩余天数分桶；续签在途 = 已有续签单但未生效）
    const expiring = expiringContracts(90);
    const expBuckets = [
      { label: "30 天内", hint: "需立即启动续签谈判", rows: expiring.filter((c) => daysToEnd(c) <= 30), color: "#F53F3F", bg: "#FFECE8" },
      { label: "31–60 天", hint: "可启动续签谈判", rows: expiring.filter((c) => { const d = daysToEnd(c); return d > 30 && d <= 60; }), color: "#FF7D00", bg: "#FFF3E8" },
      { label: "61–90 天", hint: "纳入续签计划", rows: expiring.filter((c) => { const d = daysToEnd(c); return d > 60 && d <= 90; }), color: "#165DFF", bg: "#E8F3FF" },
    ];
    const renewedIds = new Set(CONTRACTS.filter((c) => c.renewOf).map((c) => c.renewOf!));
    const renewingOf = (id: string) => CONTRACTS.find((c) => c.renewOf === id && c.status !== "已终止");

    return { revenueTrend, pipeline, monthlyRevenue, monthlyExitCost, grossMargin, marginRate, pools, aging, agingTotal, kpi, dso, bdr, outstandingN, batches, activeContracts, opps, expiring, expBuckets, renewedIds, renewingOf };
  }, []);

  const maxTrend = Math.max(...data.revenueTrend.map((r) => r.value), 1);

  return (
    <ArcoShell breadcrumb="概览 / 经营分析">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div>
            <span className="text-sm font-semibold text-[#1D2129]">经营分析</span>
            <span className="ml-2 text-[11px] text-[#86909C]">面向管理层的经营一页式视图 · 数据实时取自各业务台账（应收 / 商机 / 合同 / 出口资源池 / 月结批次）</span>
          </div>
          <span className="rounded-[2px] bg-[#F7F8FA] px-2 py-0.5 text-[11px] text-[#86909C]">账龄基准日 {FIN_TODAY} · 与财务中心同口径</span>
        </div>

        {/* 顶部 KPI */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["生效合同月租（元/月）", fmt(data.monthlyRevenue), `${data.activeContracts.length} 份生效合同`, "#165DFF"],
            ["出口池月成本（元/月）", fmt(data.monthlyExitCost), `${R1_ROWS.filter((r) => r.status === "生效").length} 个出口池（带宽成本）`, "#0D9488"],
            ["带宽毛利（元/月）", fmt(data.grossMargin), `毛利率 ${data.marginRate}%（合同额 vs 出口带宽成本，未含线路/机房等）`, data.grossMargin >= 0 ? "#00B42A" : "#F53F3F"],
            ["应收 / 回款率", fmt(data.kpi.应收总额), `已收 ${fmt(data.kpi.已收金额)} 元 · 回款率 ${Math.round(data.kpi.回款率 * 100)}% · 逾期率 ${Math.round(data.kpi.逾期率 * 100)}%`, "#FF7D00"],
          ].map(([k, v, sub, color]) => (
            <div key={k as string} className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
              <div className="text-[11px] text-[#86909C]">{k}</div>
              <div className="mt-1 font-mono text-xl font-semibold" style={{ color: color as string }}>{v}</div>
              <div className="mt-1 text-[10px] text-[#86909C]">{sub}</div>
            </div>
          ))}
        </div>

        {/* 合同到期看板（未来 90 天） */}
        <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-[#1D2129]">合同到期看板（未来 90 天 · 基准日 {DEMO_TODAY}）</span>
            <Link to="/contract" className="text-[11px] text-[#165DFF] hover:underline">合同管理 →</Link>
          </div>
          <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3">
            {data.expBuckets.map((b) => (
              <div key={b.label} className="flex items-center gap-3 rounded-[4px] px-3 py-2.5" style={{ background: b.bg }}>
                <span className="font-mono text-lg font-semibold" style={{ color: b.color }}>{b.rows.length}</span>
                <div className="text-[11px] leading-4">
                  <div className="font-medium text-[#1D2129]">{b.label}到期</div>
                  <div className="text-[#86909C]">月租 {fmt(b.rows.reduce((s, c) => s + c.amount, 0))} 元 · {b.hint}</div>
                </div>
              </div>
            ))}
          </div>
          {data.expiring.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                    <th className="px-3 py-1.5">合同号</th><th className="px-3 py-1.5">客户</th><th className="px-3 py-1.5">到期日</th>
                    <th className="px-3 py-1.5 text-right">剩余</th><th className="px-3 py-1.5 text-right">月租（元/月）</th><th className="px-3 py-1.5">续签状态</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expiring.map((c) => {
                    const d = daysToEnd(c);
                    const renew = data.renewingOf(c.id);
                    return (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-[#F7FAFF]">
                        <td className="px-3 py-2 font-mono"><Link to={`/contract/detail?id=${c.id}`} className="text-[#165DFF] hover:underline">{c.id}</Link></td>
                        <td className="px-3 py-2 font-medium text-[#1D2129]">{c.customer}</td>
                        <td className="px-3 py-2 text-[#4E5969]">{c.end}</td>
                        <td className={`px-3 py-2 text-right font-mono font-semibold ${d <= 30 ? "text-[#F53F3F]" : d <= 60 ? "text-[#FF7D00]" : "text-[#165DFF]"}`}>{d} 天</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(c.amount)}</td>
                        <td className="px-3 py-2">
                          {renew
                            ? <span className="rounded-[2px] bg-[#E8F3FF] px-1.5 py-0.5 text-[10px] text-[#165DFF]">续签在途：{renew.id}（{renew.status}）</span>
                            : data.renewedIds.has(c.id)
                              ? <span className="rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] text-[#86909C]">已由新合同承接</span>
                              : <span className="rounded-[2px] bg-[#FFECE8] px-1.5 py-0.5 text-[10px] text-[#F53F3F]">待发起续签</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-[2px] bg-[#F7F8FA] px-3 py-4 text-center text-[11px] text-[#86909C]">未来 90 天内无到期合同，续签压力可控。</div>
          )}
          <div className="mt-2 border-t border-dashed border-[#F2F3F5] pt-2 text-[11px] text-[#86909C]">
            到期前 90 天可发起续签（合同详情页「发起续签」）；续签单生效时源合同自动终止并停止出账，防双算。
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* 月度收入趋势 */}
          <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-[#1D2129]">月度应收趋势</span>
              <Link to="/finance?tab=pay" className="text-[11px] text-[#165DFF] hover:underline">收款管理 →</Link>
            </div>
            <div className="flex h-40 items-end gap-4 border-b border-[#F2F3F5] pb-0">
              {data.revenueTrend.map((r) => (
                <div key={r.label} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-32 w-full items-end justify-center gap-1">
                    <div className="w-6 rounded-t-[2px] bg-[#165DFF]" style={{ height: `${(r.value / maxTrend) * 100}%` }} title={`应收 ${fmt(r.value)} 元`} />
                    <div className="w-6 rounded-t-[2px] bg-[#BEDAFF]" style={{ height: `${(r.received / maxTrend) * 100}%` }} title={`已收 ${fmt(r.received)} 元`} />
                  </div>
                  <span className="text-[10px] text-[#86909C]">{r.label}</span>
                </div>
              ))}
              {!data.revenueTrend.length && <div className="py-10 text-center text-xs text-[#86909C]">暂无应收数据</div>}
            </div>
            <div className="mt-2 flex gap-4 text-[10px] text-[#86909C]">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 bg-[#165DFF]" />账单金额</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 bg-[#BEDAFF]" />已收金额</span>
            </div>
          </div>

          {/* 商机 pipeline */}
          <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-[#1D2129]">商机 Pipeline（按阶段 · 预计合同额）</span>
              <Link to="/opportunity" className="text-[11px] text-[#165DFF] hover:underline">商机管理 →</Link>
            </div>
            <Bars rows={data.pipeline.map((p) => ({ label: `${p.label}（${p.count} 个）`, value: p.value }))} color="#7B61FF" />
            <div className="mt-3 border-t border-dashed border-[#F2F3F5] pt-2 text-[11px] text-[#86909C]">
              进行中商机合计预计合同额 <span className="font-mono font-semibold text-[#1D2129]">{fmt(data.pipeline.filter((p) => p.label !== "输单").reduce((s, p) => s + p.value, 0))}</span> 元；赢单未签约 {data.opps.filter((d) => d.stage === "赢单" && !CONTRACTS.some((c) => c.dealId === d.id)).length} 个
            </div>
          </div>

          {/* 出口池利用率 */}
          <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-[#1D2129]">出口池利用率</span>
              <Link to="/resources/r1" className="text-[11px] text-[#165DFF] hover:underline">R1 出口资源池 →</Link>
            </div>
            <div className="space-y-2.5">
              {data.pools.map((p) => (
                <div key={p.label}>
                  <div className="mb-0.5 flex justify-between text-[11px]">
                    <span className="text-[#4E5969]">{p.label}</span>
                    <span className="font-mono text-[#1D2129]">{p.used}M / {p.cap}M · <span className={p.value >= 80 ? "text-[#F53F3F]" : p.value >= 60 ? "text-[#FF7D00]" : "text-[#00B42A]"}>{p.value}%</span></span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-[2px] bg-[#F2F3F5]">
                    <div className={`h-full rounded-[2px] ${p.value >= 80 ? "bg-[#F53F3F]" : p.value >= 60 ? "bg-[#FF7D00]" : "bg-[#00B42A]"}`} style={{ width: `${Math.min(p.value, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-dashed border-[#F2F3F5] pt-2 text-[11px] text-[#86909C]">
              ≥80% 提示扩容评估，60–80% 关注增长；闲置容量 = 空转成本，见「成本怎么算」
            </div>
          </div>

          {/* 应收账龄 */}
          <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-[#1D2129]">应收账龄（余额 {fmt(data.agingTotal)} 元）</span>
              <Link to="/finance?tab=collect" className="text-[11px] text-[#165DFF] hover:underline">欠费与坏账 →</Link>
            </div>
            <Bars rows={data.aging.map((b) => ({ label: `${b.label}（${b.n} 笔）`, value: b.amount }))} color="#FF7D00" />
            <div className="mt-3 border-t border-dashed border-[#F2F3F5] pt-2 text-[11px] text-[#86909C]">
              未结清账单 {data.outstandingN} 笔 · DSO（平均回款延迟）<span className="font-mono font-semibold text-[#1D2129]">{data.dso}</span> 天 · 坏账候选余额{" "}
              <span className={`font-mono font-semibold ${data.bdr > 0 ? "text-[#F53F3F]" : "text-[#1D2129]"}`}>{fmt(data.bdr)}</span> 元；
              逾期 &gt;90 天建议按 P10 流程发起坏账处理（停机 / 催收 / 核销）
            </div>
          </div>
        </div>

        {/* 月结毛利（已跑批次） */}
        <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-[#1D2129]">月结毛利（按客户，取自已锁定月结批次）</span>
            <Link to="/finance/settle" className="text-[11px] text-[#165DFF] hover:underline">月结 →</Link>
          </div>
          {data.batches.length ? (
            <div className="space-y-4">
              {data.batches.map((b) => (
                <div key={b.batchNo}>
                  <div className="mb-1.5 text-[11px] text-[#4E5969]">批次 {b.batchNo} · 账期 {b.period} · 跑批 {b.runAt}</div>
                  <Bars rows={b.margins.slice(0, 8).map((m) => ({ label: m.customer, value: m.margin }))} color={b.totals.margin >= 0 ? "#00B42A" : "#F53F3F"} />
                  <div className="mt-1.5 text-[11px] text-[#86909C]">
                    当期收入 {fmt(b.totals.revenue)} · 直接成本 {fmt(b.totals.direct)} · 间接分摊 {fmt(b.totals.indirect)} · <span className={`font-mono font-semibold ${b.totals.margin >= 0 ? "text-[#00B42A]" : "text-[#F53F3F]"}`}>毛利 {fmt(b.totals.margin)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[2px] bg-[#F7F8FA] px-3 py-4 text-center text-[11px] leading-5 text-[#86909C]">
              暂无已锁定的月结批次。到「月结」页选择账期跑月结后，这里自动展示按客户的收入 / 直接成本 / 间接分摊 / 毛利明细。<br />
              上方「带宽毛利」卡片为简化口径（生效合同月租 − 出口池月成本），正式毛利以月结批次为准（含全部成本条目与间接分摊）。
            </div>
          )}
        </div>
      </main>
    </ArcoShell>
  );
}
