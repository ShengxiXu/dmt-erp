// P07 月结（/finance/settle）：跑月结 → 出口成本两阶段分摊 + 测算差异比对 + 间接费用分配 → 客户毛利；跑完锁账
import { useState } from "react";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettle, getBatches, runSettle, preIndirect, saveDiffNote, type SettleBatch, type DiffRow } from "@/data/settle";
import { cfgNum } from "@/data/settings";

const LEVEL_CLS: Record<DiffRow["level"], string> = {
  正常: "bg-[#E8F8F2] text-[#00B42A]",
  黄: "bg-[#FFF3E8] text-[#FF7D00]",
  红: "bg-[#FFECE8] text-[#F53F3F]",
};

// ---------- 跑月结 ----------
function RunForm({ onClose, onDone }: { onClose: () => void; onDone: (b: SettleBatch) => void }) {
  const [period, setPeriod] = useState("2026-10");
  const [indirect, setIndirect] = useState(() => String(preIndirect("2026-10")));
  const [err, setErr] = useState<string | null>(null);
  return (
    <CenterModal title="跑月结" sub={`月结完成即锁账：账期 ${period} 的账单/收款不可再改，改动只能红冲。差异预警阈值（A5）：黄 ±${cfgNum("settle.diffYellow")}% / 红 ±${cfgNum("settle.diffRed")}%`} width={520} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div>
          <div className="mb-0.5 text-[#4E5969]">账期 <span className="text-[#F53F3F]">*</span>（月结日：每月 {cfgNum("settle.closeDay")} 号，A5 可配）</div>
          <Input placeholder="2026-10" value={period} onChange={(e) => { setPeriod(e.target.value); setIndirect(String(preIndirect(e.target.value))); }} />
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">当期间接费用总额（元）</div>
          <Input type="number" value={indirect} onChange={(e) => setIndirect(e.target.value)} />
          <div className="mt-1 text-[10px] text-[#86909C]">预填 = 成本中心当月归集数（无当月归集时取各中心最近一次），可按实际调整；按各客户收入占比分配。</div>
        </div>
        <div className="rounded-[2px] bg-[#FFF7E8] px-2 py-1.5 text-[10px] leading-4 text-[#4E5969]">
          算法：① 出口月租按各产品类型占用带宽占比拆进类型池（共用出口同算法）；② 类型池成本 ÷ 池内已售带宽 = 统一单位成本，逐订单分摊；
          ③ 无订单出口的月租进该类型「空载成本」，不摊给客户；④ 核算单测算 vs 实际差异超阈值标黄/标红，只记录说明、不自动调账。
        </div>
        <div className="rounded-[2px] bg-[#F2F3F5] px-2 py-1.5 text-[10px] leading-4 text-[#86909C]">
          年度归属：年末触发一次，年度采购差异（含返点、调价）滚动进下一年度成本池，不追溯已出账单与已归属客户。本期仅预留口径，不实现（详见设计文档十九章）。
        </div>
        {err && <div className="rounded-[2px] bg-[#FFECE8] px-2 py-1.5 text-[#F53F3F]">{err}</div>}
        <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={() => {
            const r = runSettle(period.trim(), Number(indirect) || 0);
            if (r.error) return setErr(r.error);
            onDone(r.batch!);
          }}>确认跑月结并锁账</Button>
        </div>
      </div>
    </CenterModal>
  );
}

// ---------- 批次详情：出口成本池 / 客户毛利 / 测算差异 ----------
function BatchDetail({ b, onClose }: { b: SettleBatch; onClose: () => void }) {
  const [tab, setTab] = useState<"出口成本池" | "客户毛利表" | "测算差异表">("出口成本池");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const flagCount = b.diffs.filter((d) => d.level !== "正常").length;

  return (
    <CenterModal title={`月结批次 · ${b.batchNo}`} sub={`账期 ${b.period} · ${b.status} · ${b.runAt} · 操作人 ${b.operator}`} width={880} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-4 gap-2">
          {[
            ["当期收入", b.totals.revenue], ["直接成本", b.totals.direct],
            ["间接分摊", b.totals.indirect], ["毛利", b.totals.margin],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-[2px] bg-[#F7F8FA] px-3 py-2">
              <div className="text-[10px] text-[#86909C]">{k}</div>
              <div className={`text-base font-semibold ${k === "毛利" ? (b.totals.margin >= 0 ? "text-[#00B42A]" : "text-[#F53F3F]") : "text-[#1D2129]"}`}>
                {(v as number).toLocaleString("zh-CN")}
              </div>
            </div>
          ))}
        </div>

        <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
          {(["出口成本池", "客户毛利表", "测算差异表"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 rounded-[2px] px-2 py-1 ${tab === t ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>
              {t}{t === "测算差异表" && flagCount > 0 ? `（${flagCount} 项超阈值）` : ""}
            </button>
          ))}
        </div>

        {tab === "出口成本池" && (
          <>
            <div className="overflow-x-auto rounded-[2px] border border-[#E5E6EB]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                    <th className="px-2 py-1.5">产品类型池</th><th className="px-2 py-1.5">池成本</th><th className="px-2 py-1.5">已售带宽</th>
                    <th className="px-2 py-1.5">统一单位成本</th><th className="px-2 py-1.5">分摊小计</th><th className="px-2 py-1.5">空载成本</th>
                  </tr>
                </thead>
                <tbody>
                  {b.pools.map((p) => (
                    <tr key={p.type} className="border-b last:border-0">
                      <td className="px-2 py-1.5 font-medium text-[#1D2129]">{p.type}</td>
                      <td className="px-2 py-1.5">{p.poolCost.toLocaleString("zh-CN")}</td>
                      <td className="px-2 py-1.5">{p.soldBW} M</td>
                      <td className="px-2 py-1.5 text-[#165DFF]">{p.unitCost.toLocaleString("zh-CN")} 元/M</td>
                      <td className="px-2 py-1.5">{p.orderCost.toLocaleString("zh-CN")}</td>
                      <td className={`px-2 py-1.5 ${p.idleCost ? "font-medium text-[#FF7D00]" : "text-[#C9CDD4]"}`}>{p.idleCost ? p.idleCost.toLocaleString("zh-CN") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto rounded-[2px] border border-[#E5E6EB]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                    <th className="px-2 py-1.5">出口线路</th><th className="px-2 py-1.5">月租</th><th className="px-2 py-1.5">占用带宽</th><th className="px-2 py-1.5">类型拆分</th>
                  </tr>
                </thead>
                <tbody>
                  {b.exitSplits.map((e) => (
                    <tr key={e.exitId} className="border-b last:border-0">
                      <td className="px-2 py-1.5 font-medium text-[#1D2129]">{e.exitName}</td>
                      <td className="px-2 py-1.5">{e.monthlyCost.toLocaleString("zh-CN")}</td>
                      <td className="px-2 py-1.5">{e.totalBW ? `${e.totalBW} M` : <span className="text-[#FF7D00]">无订单（空载）</span>}</td>
                      <td className="px-2 py-1.5 text-[#4E5969]">
                        {e.splits.map((s) => `${s.type} ${s.bw}M`).join("、") || `空载成本 ${e.idleCost.toLocaleString("zh-CN")} 元`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "客户毛利表" && (
          <div className="overflow-x-auto rounded-[2px] border border-[#E5E6EB]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                  <th className="px-2 py-1.5">客户</th><th className="px-2 py-1.5">收入</th><th className="px-2 py-1.5">直接成本</th>
                  <th className="px-2 py-1.5">间接分摊</th><th className="px-2 py-1.5">毛利</th><th className="px-2 py-1.5">毛利率</th>
                </tr>
              </thead>
              <tbody>
                {b.margins.map((m) => (
                  <tr key={m.customer} className="border-b last:border-0">
                    <td className="px-2 py-1.5 font-medium text-[#1D2129]">{m.customer}</td>
                    <td className="px-2 py-1.5">{m.revenue.toLocaleString("zh-CN")}</td>
                    <td className="px-2 py-1.5">{m.directCost.toLocaleString("zh-CN")}</td>
                    <td className="px-2 py-1.5 text-[#86909C]">{m.indirectAlloc.toLocaleString("zh-CN")}</td>
                    <td className={`px-2 py-1.5 font-medium ${m.margin >= 0 ? "text-[#00B42A]" : "text-[#F53F3F]"}`}>{m.margin.toLocaleString("zh-CN")}</td>
                    <td className="px-2 py-1.5">{m.marginRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "测算差异表" && (
          <div className="overflow-x-auto rounded-[2px] border border-[#E5E6EB]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                  <th className="px-2 py-1.5">核算单</th><th className="px-2 py-1.5">客户</th><th className="px-2 py-1.5">测算月成本</th>
                  <th className="px-2 py-1.5">实际直接成本</th><th className="px-2 py-1.5">差异</th><th className="px-2 py-1.5">级别</th><th className="px-2 py-1.5">说明</th>
                </tr>
              </thead>
              <tbody>
                {b.diffs.map((d) => (
                  <tr key={d.sheetId} className="border-b last:border-0">
                    <td className="px-2 py-1.5 font-mono text-[#165DFF]">{d.sheetId}</td>
                    <td className="px-2 py-1.5 font-medium text-[#1D2129]">{d.customer}</td>
                    <td className="px-2 py-1.5">{d.estMonthly.toLocaleString("zh-CN")}</td>
                    <td className="px-2 py-1.5">{d.actualDirect.toLocaleString("zh-CN")}</td>
                    <td className={`px-2 py-1.5 font-medium ${d.diff >= 0 ? "text-[#F53F3F]" : "text-[#00B42A]"}`}>
                      {d.diff >= 0 ? "+" : ""}{d.diff.toLocaleString("zh-CN")}（{d.diffPct}%）
                    </td>
                    <td className="px-2 py-1.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${LEVEL_CLS[d.level]}`}>{d.level}</span></td>
                    <td className="max-w-[180px] px-2 py-1.5">
                      {d.note ? <span className="text-[#4E5969]">{d.note}</span> : d.level !== "正常" ? (
                        <button className="text-[#165DFF] hover:underline" onClick={() => { setNoteFor(d.sheetId); setNote(""); setErr(null); }}>补说明</button>
                      ) : <span className="text-[#C9CDD4]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {noteFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setNoteFor(null)}>
          <div className="w-[420px] rounded-[6px] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 text-sm font-semibold">差异说明 · {noteFor}</div>
            <Input placeholder="差异原因与处理（必填，留痕进快照）" value={note} onChange={(e) => setNote(e.target.value)} />
            {err && <div className="mt-2 rounded-[2px] bg-[#FFECE8] px-2 py-1.5 text-xs text-[#F53F3F]">{err}</div>}
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setNoteFor(null)}>取消</Button>
              <Button size="sm" onClick={() => {
                const e = saveDiffNote(b.batchNo, noteFor, note);
                if (e) return setErr(e);
                setNoteFor(null);
              }}>保存</Button>
            </div>
          </div>
        </div>
      )}
    </CenterModal>
  );
}

export default function Settle() {
  useSettle();
  const [kw, setKw] = useState("");
  const [running, setRunning] = useState(false);
  const [viewing, setViewing] = useState<SettleBatch | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const batches = getBatches().filter((b) => !kw || b.batchNo.includes(kw) || b.period.includes(kw));

  return (
    <ArcoShell breadcrumb="财务 / 月结">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-[#1D2129]">月结</span>
            <Input className="w-48" placeholder="搜索批次号 / 账期" value={kw} onChange={(e) => setKw(e.target.value)} />
          </div>
          <Button size="sm" onClick={() => setRunning(true)}>跑月结</Button>
        </div>

        {msg && <div className="rounded-[4px] border border-[#BEDAFF] bg-[#E8F3FF] px-4 py-2 text-xs text-[#0E42D2]">{msg}</div>}

        <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">批次号</th><th className="px-3 py-2">账期</th><th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">收入</th><th className="px-3 py-2">直接成本</th><th className="px-3 py-2">间接分摊</th>
                <th className="px-3 py-2">毛利</th><th className="px-3 py-2">差异超阈值</th><th className="px-3 py-2">跑结时间 / 操作人</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const flags = b.diffs.filter((d) => d.level !== "正常").length;
                return (
                  <tr key={b.batchNo} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                    <td className="px-3 py-2.5 font-mono font-semibold text-[#165DFF]">{b.batchNo}</td>
                    <td className="px-3 py-2.5 font-medium text-[#1D2129]">{b.period}</td>
                    <td className="px-3 py-2.5"><span className="rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] text-[#4E5969]">{b.status}</span></td>
                    <td className="px-3 py-2.5">{b.totals.revenue.toLocaleString("zh-CN")}</td>
                    <td className="px-3 py-2.5">{b.totals.direct.toLocaleString("zh-CN")}</td>
                    <td className="px-3 py-2.5 text-[#86909C]">{b.totals.indirect.toLocaleString("zh-CN")}</td>
                    <td className={`px-3 py-2.5 font-medium ${b.totals.margin >= 0 ? "text-[#00B42A]" : "text-[#F53F3F]"}`}>{b.totals.margin.toLocaleString("zh-CN")}</td>
                    <td className="px-3 py-2.5">{flags ? <span className="rounded-[2px] bg-[#FFECE8] px-1.5 py-0.5 text-[10px] text-[#F53F3F]">{flags} 项</span> : <span className="text-[#C9CDD4]">—</span>}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[#86909C]">{b.runAt} · {b.operator}</td>
                    <td className="px-3 py-2.5 text-right"><button className="text-[#165DFF] hover:underline" onClick={() => setViewing(b)}>查看</button></td>
                  </tr>
                );
              })}
              {!batches.length && <tr><td colSpan={10} className="px-3 py-10 text-center text-[#C9CDD4]">暂无月结批次，点右上角「跑月结」生成（每账期一个批次，跑完锁账）</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          ① 出口成本两阶段分摊：出口月租按各产品类型占用带宽占比拆进类型池（同一出口挂多产品类型的共用出口同算法）→ 类型池成本 ÷ 池内已售带宽 = 统一单位成本 → 逐订单分摊；
          成本与物理出口解耦，避免「负载高的出口摊薄、负载低的出口摊高」的扭曲；② 无订单出口的月租进「空载成本」不摊给客户（扩容/缩容信号）；
          ③ 核算单测算 vs 实际直接成本差异超阈值（A5：黄 {cfgNum("settle.diffYellow")}% / 红 {cfgNum("settle.diffRed")}%）标黄/标红，只记录说明、不自动调账；
          ④ 间接费用按客户收入占比分配；⑤ 月结完成即锁账，改动只能红冲。月结日在 A5（当前：每月 {cfgNum("settle.closeDay")} 号）。
        </div>
      </main>
      {running && <RunForm onClose={() => setRunning(false)} onDone={(b) => { setRunning(false); setViewing(b); setMsg(`✓ 月结完成：${b.batchNo}（账期 ${b.period}）已锁账 → 收入 ${b.totals.revenue.toLocaleString("zh-CN")} / 毛利 ${b.totals.margin.toLocaleString("zh-CN")} 元`); }} />}
      {viewing && <BatchDetail b={viewing} onClose={() => setViewing(null)} />}
    </ArcoShell>
  );
}
