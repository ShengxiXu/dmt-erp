// 客户档案（/customer）：主数据独立维护页；特批申请 / 新建合同时只能选择，不手动录入
// 客户下挂「商机」（一个客户可有多个，特批必须挂在具体商机上），统一在 /opportunity 维护，本页提供跳转入口
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Download } from "lucide-react";
import { CUSTOMERS, useOpps, OPPS_OF, type Customer } from "@/data/customers";
import { inDataScope, scopeBanner, currentUser } from "@/data/users";
import { CONTRACTS, fmtMoney, nearestActiveEnd, daysToEnd } from "@/data/contracts";
import { RECEIVABLES, PAYMENTS, invBalance } from "@/data/receivables";
import { customerFinance, FIN_TODAY } from "@/data/finance";
import { R1_ROWS } from "@/data/resources";
import { DEMO_TODAY } from "@/data/settings";
import { exportCsv } from "@/utils/exportCsv";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import ExpiryBadge from "@/components/ExpiryBadge";
import { RegionCascader } from "@/components/RegionCascader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LEVEL_CLS: Record<string, string> = { A: "bg-[#FFECE8] text-[#F53F3F]", B: "bg-[#FFF3E8] text-[#FF7D00]", C: "bg-[#F2F3F5] text-[#4E5969]" };

export default function Customer() {
  useOpps(); // 商机数实时刷新
  const [list, setList] = useState<Customer[]>(CUSTOMERS);
  const [kw, setKw] = useState("");
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [viewTab, setViewTab] = useState<"overview" | "opps" | "contracts" | "bills" | "resources" | "timeline">("overview");
  const navigate = useNavigate();
  const shownAll = list.filter((c) => !kw || c.name.includes(kw) || c.contact.includes(kw) || (c.creditCode ?? "").includes(kw));
  const shown = shownAll.filter((c) => inDataScope(c.sales));
  const banner = scopeBanner(shownAll.length - shown.length);

  const save = () => {
    if (!editing?.name) return;
    if (editing.id) {
      // 原地写回数据源（persistable 快照引用稳定），同时刷新本地列表
      const c = CUSTOMERS.find((x) => x.id === editing.id);
      if (c) Object.assign(c, editing);
      setList([...CUSTOMERS]);
    } else {
      CUSTOMERS.unshift({ ...editing, id: `CU-0${String(CUSTOMERS.length + 1).padStart(2, "0")}`, createdAt: "2026-11-10", status: editing.status ?? "潜在" } as Customer);
      setList([...CUSTOMERS]);
    }
    setEditing(null);
  };

  return (
    <ArcoShell breadcrumb="客户档案">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#1D2129]">客户档案</span>
            <Input className="w-56" placeholder="搜索客户 / 联系人 / 信用代码" value={kw} onChange={(e) => setKw(e.target.value)} />
            <button onClick={() => exportCsv(`客户档案_${DEMO_TODAY}`, ["客户编号", "客户名称", "等级", "行业", "联系人", "归属销售", "商机数", "状态", "最近跟进"],
              shown.map((c) => [c.id, c.name, c.level ?? "", c.industry, c.contact, c.sales, `${OPPS_OF(c.id).length}`, c.status, c.createdAt]))}
              className="flex items-center gap-1 rounded-[2px] border border-[#E5E6EB] px-2.5 py-1.5 text-xs text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">
              <Download size={12} /> 导出
            </button>
          </div>
          <Button size="sm" onClick={() => setEditing({ name: "", creditCode: "", level: "C", industry: "", source: "", address: "", contact: "", contactTitle: "", phone: "", email: "", sales: currentUser()?.name ?? "张弛", status: "潜在" })}>＋ 新建客户</Button>
        </div>

        {banner && (
          <div className="rounded-[4px] border border-[#FFECE8] bg-[#FFF7F5] px-4 py-2 text-[11px] text-[#F53F3F]">🔒 {banner}</div>
        )}

        <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">客户编码</th><th className="px-3 py-2">客户名称</th><th className="px-3 py-2">等级</th>
                <th className="px-3 py-2">联系人 / 电话</th><th className="px-3 py-2">行业</th><th className="px-3 py-2">归属销售</th>
                <th className="px-3 py-2">商机</th><th className="px-3 py-2">状态</th><th className="px-3 py-2">合同到期</th><th className="px-3 py-2">建档时间</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                  <td className="px-3 py-2.5 font-mono text-[#86909C]">{c.id}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => { setViewing(c); setViewTab("overview"); }} className="text-left font-medium text-[#1D2129] hover:text-[#165DFF]" title="打开 360° 视图">{c.name}</button>
                    {c.remark && <div className="mt-0.5 max-w-[200px] truncate text-[10px] text-[#86909C]" title={c.remark}>{c.remark}</div>}
                  </td>
                  <td className="px-3 py-2.5">{c.level ? <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] font-semibold ${LEVEL_CLS[c.level]}`}>{c.level} 级</span> : "—"}</td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{c.contact}{c.contactTitle ? `（${c.contactTitle}）` : ""} · {c.phone}</td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{c.industry}</td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{c.sales}</td>
                  <td className="px-3 py-2.5">
                    <Link to={`/opportunity?customer=${c.id}`} className="rounded-[2px] bg-[#F7FAFF] px-1.5 py-0.5 text-[11px] text-[#165DFF] hover:bg-[#BEDAFF]">
                      {OPPS_OF(c.id).length} 个商机
                    </Link>
                  </td>
                  <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${c.status === "合作中" ? "bg-[#E8F8F2] text-[#00B42A]" : "bg-[#F2F3F5] text-[#4E5969]"}`}>{c.status}</span></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[#86909C]">{(() => { const ne = nearestActiveEnd(c.name); return ne ? <>{ne.end}<ExpiryBadge days={ne.days} /></> : "—"; })()}</td>
                  <td className="px-3 py-2.5 text-[#86909C]">{c.createdAt}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button onClick={() => setViewing(c)} className="mr-1 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#0D9488] hover:text-[#0D9488]">360° 视图</button>
                    <button onClick={() => setEditing({ ...c })} className="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">编辑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          客户为主数据：在此统一建档维护（含开票抬头 / 税号，开票申请自动带出）；特批申请与合同起草时<strong>只能搜索选择</strong>客户，不允许手动录入，保证客户口径唯一（编码 CU-xxx）。点击客户名称或「360° 视图」打开客户驾驶舱（健康度 / 商机 / 合同 / 应收 / 资源 / 动态时间线一页汇总，可下钻跳转）。
        </div>
      </main>

      {viewing && (() => {
        const v = viewing;
        const opps = OPPS_OF(v.id);
        const contracts = CONTRACTS.filter((c) => c.customer === v.name);
        const invs = RECEIVABLES.filter((r) => r.customer === v.name);
        const pays = PAYMENTS.filter((p) => p.customer === v.name);
        const resources = R1_ROWS.flatMap((r) => r.dynamic.orders.filter((o) => o.customer.startsWith(v.name)).map((o) => ({ pool: r.name, ...o })));
        const cf = customerFinance(v.name);   // 财务口径唯一出处（finance.ts）：DSO / 逾期 / 账龄 / 催收
        const invTotal = cf.invTotal;
        const recvTotal = cf.recvTotal;
        const activeRent = contracts.filter((c) => c.status === "已生效").reduce((s, c) => s + c.amount, 0);
        const wonUnsigned = opps.filter((d) => d.stage === "赢单" && !CONTRACTS.some((c) => c.dealId === d.id));
        // 催收关注映射（账单号 → 阶段/天数/破约），供应收表与催收卡使用
        const collectMap = new Map(cf.collect.map((c) => [c.inv.invNo, c]));
        // 客户健康度：A/B/C 级 × 欠费 × 商机活跃度 的综合评分（演示口径）
        const levelScore = { A: 40, B: 28, C: 16 }[v.level ?? "C"] ?? 16;
        const payScore = invTotal === 0 ? 30 : Math.round((recvTotal / invTotal) * 30);
        const activeScore = Math.min(opps.filter((d) => !["赢单", "输单"].includes(d.stage)).length * 8, 20) + (opps.some((d) => d.stage === "赢单") ? 10 : 0);
        const health = Math.min(levelScore + payScore + activeScore, 100);
        const healthColor = health >= 75 ? "#00B42A" : health >= 50 ? "#FF7D00" : "#F53F3F";
        // 时间线：商机创建 / 合同版本 / 收款 汇总按时间倒序
        const timeline = [
          ...opps.map((d) => ({ at: d.createdAt, icon: "商机", text: `创建商机「${d.name}」（${d.products.map((p) => p.ptype).join("+")}）`, link: `/opportunity?customer=${v.id}`, color: "#165DFF" })),
          ...contracts.flatMap((c) => c.versions.map((ver) => ({ at: ver.at, icon: "合同", text: `${c.id} · ${ver.note}`, link: `/contract/detail?id=${c.id}`, color: "#0D9488" }))),
          ...pays.map((p) => ({ at: p.paidAt.slice(0, 10), icon: "收款", text: `回款 ${fmtMoney(p.amount)} 元（${p.method}${p.referenceNo ? ` · ${p.referenceNo}` : ""}）`, link: "/finance?tab=pay", color: "#00B42A" })),
        ].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 12);

        const TABS = [
          ["overview", "总览"], ["opps", `商机 ${opps.length}`], ["contracts", `合同 ${contracts.length}`],
          ["bills", `应收 ${invs.length}`], ["resources", `资源 ${resources.length}`], ["timeline", "动态"],
        ] as const;

        const STAGE_CLS: Record<string, string> = { 赢单: "bg-[#E8F8F2] text-[#00B42A]", 输单: "bg-[#F2F3F5] text-[#86909C]", 跟进中: "bg-[#E8F3FF] text-[#165DFF]", 已报价: "bg-[#FFF3E8] text-[#FF7D00]", 线索: "bg-[#F2F3F5] text-[#4E5969]" };
        const INV_CLS: Record<string, string> = { 已收讫: "bg-[#E8F8F2] text-[#00B42A]", 逾期: "bg-[#FFECE8] text-[#F53F3F]", 欠停: "bg-[#FFECE8] text-[#F53F3F]", 部分收款: "bg-[#FFF3E8] text-[#FF7D00]" };
        const COLLECT_CLS: Record<string, string> = { 正常: "bg-[#F2F3F5] text-[#4E5969]", 宽限提醒: "bg-[#FFF3E8] text-[#FF7D00]", 催收跟进: "bg-[#FFECE8] text-[#F53F3F]", 停机预警: "bg-[#F53F3F] text-white", 坏账候选: "bg-[#722ED1] text-white" };

        return (
          <CenterModal title={`客户 360° 视图 · ${v.name}`} sub={`${v.id} · ${v.level ?? "C"} 级 · ${v.industry} · 归属销售 ${v.sales} · 联系人 ${v.contact}（${v.contactTitle || "—"}）${v.phone ? ` · ${v.phone}` : ""}`} width={880} onClose={() => { setViewing(null); setViewTab("overview"); }}>
            {/* 头部：健康度环 + 快捷动作 */}
            <div className="flex items-center gap-4 rounded-[4px] bg-gradient-to-r from-[#F0F5FF] to-[#F7F8FA] px-4 py-3">
              <div className="flex items-center gap-3">
                <svg width="64" height="64" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="#E5E6EB" strokeWidth="6" />
                  <circle cx="32" cy="32" r="26" fill="none" stroke={healthColor} strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${(health / 100) * 163.4} 163.4`} transform="rotate(-90 32 32)" style={{ transition: "stroke-dasharray .6s" }} />
                  <text x="32" y="36" textAnchor="middle" fontSize="13" fontWeight="700" fill={healthColor}>{health}</text>
                </svg>
                <div>
                  <div className="text-[11px] text-[#86909C]">客户健康度</div>
                  <div className="text-[10px] text-[#86909C]">{health >= 75 ? "优质客户，重点关注续扩" : health >= 50 ? "正常经营，关注回款" : "存在风险，需重点关注"}</div>
                </div>
              </div>
              <div className="mx-2 h-10 w-px bg-[#E5E6EB]" />
              <div className="flex flex-1 flex-wrap gap-2">
                {wonUnsigned.length > 0 && (
                  <button onClick={() => { setViewing(null); navigate(`/contract/edit?customer=${encodeURIComponent(v.name)}&deal=${wonUnsigned[0].id}`); }}
                    className="rounded-[2px] bg-[#165DFF] px-3 py-1.5 text-[11px] text-white hover:bg-[#4080FF]">✍ 去签约（{wonUnsigned[0].id}）→</button>
                )}
                <button onClick={() => { setViewing(null); navigate(`/opportunity?customer=${v.id}`); }} className="rounded-[2px] border border-[#165DFF] px-3 py-1.5 text-[11px] text-[#165DFF] hover:bg-[#F0F5FF]">商机管理 →</button>
                <button onClick={() => { setViewing(null); navigate("/finance?tab=invoice"); }} className="rounded-[2px] border border-[#E5E6EB] px-3 py-1.5 text-[11px] text-[#4E5969] hover:border-[#0D9488] hover:text-[#0D9488]">开票管理</button>
                <button onClick={() => { setViewing(null); navigate("/finance?tab=pay"); }} className="rounded-[2px] border border-[#E5E6EB] px-3 py-1.5 text-[11px] text-[#4E5969] hover:border-[#00B42A] hover:text-[#00B42A]">收款管理</button>
                <button onClick={() => { setEditing({ ...v }); setViewing(null); }} className="rounded-[2px] border border-[#E5E6EB] px-3 py-1.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">编辑主数据</button>
              </div>
            </div>

            {/* KPI 条（点击切换页签） */}
            <div className="mt-3 grid grid-cols-4 gap-2">
              {([
                ["contracts", "生效合同月租", `${fmtMoney(activeRent)} 元`, contracts.length ? `${contracts.length} 份 · ${v.status}` : "暂无合同", "#165DFF"],
                ["opps", "商机管线", `${opps.filter((d) => !["赢单", "输单"].includes(d.stage)).length} 个进行中`, `赢单 ${opps.filter((d) => d.stage === "赢单").length} · 预计合同额 ${fmtMoney(opps.filter((d) => d.stage !== "输单").reduce((s, d) => s + (d.expectAmount || 0), 0))} 元`, "#7B61FF"],
                ["bills", "应收 / 回款率", `${fmtMoney(invTotal)} / ${invTotal ? Math.round((recvTotal / invTotal) * 100) : 0}%`, cf.overdueAmt > 0 ? <span className="text-[#F53F3F]">逾期余额 {fmtMoney(cf.overdueAmt)} 元（{Math.round(cf.overdueRate * 100)}%）· DSO {cf.dso} 天</span> : `无逾期 · DSO ${cf.dso} 天`, "#FF7D00"],
                ["resources", "在用资源", `${resources.length} 条出口订单`, `带宽合计 ${resources.reduce((s, o) => s + o.bw, 0)}M`, "#0D9488"],
              ] as const).map(([tab, k, val, sub, color]) => (
                <button key={tab} onClick={() => setViewTab(tab)} className={`rounded-[4px] border px-3 py-2 text-left transition-all ${viewTab === tab ? "border-[#165DFF] bg-[#F0F5FF] shadow-sm" : "border-[#E5E6EB] bg-white hover:border-[#BEDAFF]"}`}>
                  <div className="flex items-center justify-between"><span className="text-[10px] text-[#86909C]">{k}</span><span className="text-[10px]" style={{ color }}>●</span></div>
                  <div className="mt-0.5 font-mono text-sm font-semibold text-[#1D2129]">{val}</div>
                  <div className="mt-0.5 truncate text-[10px] text-[#86909C]">{sub}</div>
                </button>
              ))}
            </div>

            {/* 页签 */}
            <div className="mt-3 flex gap-1 border-b border-[#E5E6EB]">
              {TABS.map(([k, label]) => (
                <button key={k} onClick={() => setViewTab(k)} className={`relative px-3 py-1.5 text-xs transition-colors ${viewTab === k ? "font-semibold text-[#165DFF]" : "text-[#4E5969] hover:text-[#165DFF]"}`}>
                  {label}
                  {viewTab === k && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[#165DFF]" />}
                </button>
              ))}
            </div>

            <div className="mt-3 text-xs">
              {/* 总览 */}
              {viewTab === "overview" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-3">
                    <div className="rounded-[4px] border border-[#E5E6EB] p-3">
                      <div className="mb-2 font-semibold text-[#1D2129]">基本信息</div>
                      {([
                        ["客户编码", v.id], ["统一社会信用代码", v.creditCode || "—"], ["等级", `${v.level ?? "C"} 级（${v.level === "A" ? "战略/大客户" : v.level === "B" ? "成长客户" : "普通客户"}）`],
                        ["行业 / 来源", `${v.industry} / ${v.source || "—"}`], ["办公地址", v.address || "—"], ["邮箱", v.email || "—"],
                        ["开票抬头", v.invoiceTitle || v.name], ["开票税号", v.taxNo || "—"], ["建档时间", v.createdAt],
                      ] as const).map(([k, val]) => (
                        <div key={k} className="flex justify-between border-b border-dashed border-[#F2F3F5] py-1 last:border-0"><span className="text-[#86909C]">{k}</span><span className="max-w-[260px] truncate font-medium text-[#1D2129]" title={val}>{val}</span></div>
                      ))}
                      {v.remark && <div className="mt-2 rounded-[2px] bg-[#FFF7E8] px-2 py-1.5 text-[11px] leading-5 text-[#B25E00]">备注：{v.remark}</div>}
                    </div>
                    <div className="rounded-[4px] border border-[#E5E6EB] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-semibold text-[#1D2129]">应收账龄</span>
                        <button onClick={() => setViewTab("bills")} className="text-[11px] text-[#165DFF] hover:underline">明细 →</button>
                      </div>
                      {(() => {
                        // 账龄分桶取 finance.ts 共享口径（与财务中心一致，基准日 FIN_TODAY），本页不重算
                        const colors = ["#165DFF", "#4080FF", "#FF7D00", "#F53F3F", "#722ED1"];
                        const buckets = cf.buckets.map((b, i) => ({ label: `${b.label}（${b.n} 笔）`, amt: b.amount, color: colors[i] }));
                        const max = Math.max(...buckets.map((b) => b.amt), 1);
                        return buckets.map(({ label, amt, color }) => (
                          <div key={label} className="mb-1.5">
                            <div className="mb-0.5 flex justify-between text-[11px]"><span className="text-[#4E5969]">{label}</span><span className="font-mono">{fmtMoney(amt)} 元</span></div>
                            <div className="h-1.5 overflow-hidden rounded-[2px] bg-[#F2F3F5]"><div className="h-full rounded-[2px] transition-all" style={{ width: `${(amt / max) * 100}%`, background: color }} /></div>
                          </div>
                        ));
                      })()}
                      <div className="mt-1 text-[10px] text-[#C9CDD4]">口径与财务中心一致 · 基准日 {FIN_TODAY}</div>
                    </div>
                  </div>
                  <div className="rounded-[4px] border border-[#E5E6EB] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-semibold text-[#1D2129]">最近动态</span>
                      <button onClick={() => setViewTab("timeline")} className="text-[11px] text-[#165DFF] hover:underline">全部 →</button>
                    </div>
                    <div className="relative max-h-72 space-y-0 overflow-y-auto pl-4">
                      <span className="absolute bottom-1 left-[5px] top-1 w-px bg-[#E5E6EB]" />
                      {timeline.slice(0, 8).map((t, i) => (
                        <button key={i} onClick={() => { setViewing(null); navigate(t.link); }} className="group relative block w-full pb-3 text-left">
                          <span className="absolute -left-4 top-1 h-2.5 w-2.5 rounded-full border-2 border-white" style={{ background: t.color }} />
                          <div className="text-[10px] text-[#86909C]">{t.at} · {t.icon}</div>
                          <div className="mt-0.5 truncate text-[11px] text-[#4E5969] group-hover:text-[#165DFF]">{t.text}</div>
                        </button>
                      ))}
                      {!timeline.length && <div className="py-6 text-center text-[#86909C]">暂无动态</div>}
                    </div>
                  </div>
                </div>
              )}

              {/* 商机 */}
              {viewTab === "opps" && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[#4E5969]">金额为预计合同额（含预计合同期）；预估毛利为签约前粗估</span>
                    <button onClick={() => { setViewing(null); navigate(`/opportunity?customer=${v.id}`); }} className="text-[11px] text-[#165DFF] hover:underline">进入商机管理 →</button>
                  </div>
                  {opps.length ? (
                    <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB]">
                      <table className="w-full">
                        <thead><tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]"><th className="px-2 py-1.5">编号 / 名称</th><th className="px-2 py-1.5">意向产品</th><th className="px-2 py-1.5 text-right">预计合同额</th><th className="px-2 py-1.5">阶段</th><th className="px-2 py-1.5" /></tr></thead>
                        <tbody>
                          {opps.map((d) => (
                            <tr key={d.id} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                              <td className="px-2 py-1.5"><span className="font-mono text-[#86909C]">{d.id}</span> · {d.name}</td>
                              <td className="px-2 py-1.5 text-[#4E5969]">{d.products.map((p) => p.ptype).join(" + ")}</td>
                              <td className="px-2 py-1.5 text-right font-mono">{d.expectAmount ? `${fmtMoney(d.expectAmount)} 元 / ${d.expectMonths ?? "?"} 月` : "—"}</td>
                              <td className="px-2 py-1.5"><span className={`rounded-[2px] px-1 py-0.5 text-[10px] ${STAGE_CLS[d.stage] ?? "bg-[#F2F3F5] text-[#4E5969]"}`}>{d.stage}</span></td>
                              <td className="px-2 py-1.5 text-right">{d.stage === "赢单" && !CONTRACTS.some((c) => c.dealId === d.id) && (
                                <button onClick={() => { setViewing(null); navigate(`/contract/edit?customer=${encodeURIComponent(v.name)}&deal=${d.id}`); }} className="rounded-[2px] bg-[#165DFF] px-2 py-0.5 text-[10px] text-white hover:bg-[#4080FF]">去签约</button>
                              )}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="rounded-[4px] bg-[#F7F8FA] px-3 py-6 text-center text-[#86909C]">暂无商机，到商机管理创建</div>}
                </div>
              )}

              {/* 合同 */}
              {viewTab === "contracts" && (
                <div>
                  {contracts.length ? (
                    <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB]">
                      <table className="w-full">
                        <thead><tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]"><th className="px-2 py-1.5">合同号 / 内容</th><th className="px-2 py-1.5">期限</th><th className="px-2 py-1.5 text-right">月租合计</th><th className="px-2 py-1.5">状态</th><th className="px-2 py-1.5">付款方式</th></tr></thead>
                        <tbody>
                          {contracts.map((c) => (
                            <tr key={c.id} className="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]" onClick={() => { setViewing(null); navigate(`/contract/detail?id=${c.id}`); }}>
                              <td className="px-2 py-1.5"><span className="font-mono text-[#165DFF]">{c.id}</span><span className="ml-1 text-[#4E5969]">{c.lines.map((l) => l.ptype).join(" + ")}</span>{c.discount ? <span className="ml-1 text-[10px] text-[#FF7D00]">折 {c.discount}%</span> : null}</td>
                              <td className="whitespace-nowrap px-2 py-1.5 text-[#4E5969]">{c.start} ~ {c.end}{c.status === "已生效" && <ExpiryBadge days={daysToEnd(c)} />}</td>
                              <td className="px-2 py-1.5 text-right font-mono">{fmtMoney(c.amount)} 元/月</td>
                              <td className="px-2 py-1.5"><span className={`rounded-[2px] px-1 py-0.5 text-[10px] ${c.status === "已生效" ? "bg-[#E8F8F2] text-[#00B42A]" : c.status === "审批中" ? "bg-[#FFF3E8] text-[#FF7D00]" : "bg-[#F2F3F5] text-[#4E5969]"}`}>{c.status}</span></td>
                              <td className="px-2 py-1.5 text-[#4E5969]">{c.pay}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="rounded-[4px] bg-[#F7F8FA] px-3 py-6 text-center text-[#86909C]">暂无合同（签约请从商机「去签约」发起）</div>}
                </div>
              )}

              {/* 应收与回款 */}
              {viewTab === "bills" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-1.5 font-semibold text-[#1D2129]">应收账单（{invs.length}）</div>
                    {invs.length ? (
                      <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB]">
                        <table className="w-full">
                          <thead><tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]"><th className="px-2 py-1.5">账单号</th><th className="px-2 py-1.5 text-right">金额 / 余额</th><th className="px-2 py-1.5">应收日期</th><th className="px-2 py-1.5">状态</th><th className="px-2 py-1.5">催收阶段</th></tr></thead>
                          <tbody>
                            {invs.map((r) => {
                              const c = collectMap.get(r.invNo);
                              return (
                              <tr key={r.invNo} className="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]" onClick={() => { setViewing(null); navigate("/finance?tab=ledger"); }}>
                                <td className="px-2 py-1.5 font-mono">{r.invNo}</td>
                                <td className="px-2 py-1.5 text-right font-mono">{fmtMoney(r.amount)} / {fmtMoney(invBalance(r))}</td>
                                <td className="px-2 py-1.5 text-[#4E5969]">{r.dueDate}</td>
                                <td className="px-2 py-1.5"><span className={`rounded-[2px] px-1 py-0.5 text-[10px] ${INV_CLS[r.status] ?? "bg-[#F2F3F5] text-[#4E5969]"}`}>{r.status}</span></td>
                                <td className="px-2 py-1.5">{c ? <span className={`rounded-[2px] px-1 py-0.5 text-[10px] ${COLLECT_CLS[c.stage]}`}>{c.stage} · {c.days} 天{c.broken ? " · 破约" : ""}</span> : <span className="text-[10px] text-[#C9CDD4]">—</span>}</td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : <div className="rounded-[4px] bg-[#F7F8FA] px-3 py-4 text-center text-[#86909C]">暂无应收账单</div>}
                    {cf.collect.length > 0 && (
                      <div className="mt-3 rounded-[4px] border border-[#FFECE8] bg-[#FFF7F5] p-3">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="font-semibold text-[#1D2129]">催收关注（{cf.collect.length} 笔 · 跟进留痕 {cf.collectRecords} 条）</span>
                          <button onClick={() => { setViewing(null); navigate("/finance?tab=collect"); }} className="text-[11px] text-[#165DFF] hover:underline">催收行动 →</button>
                        </div>
                        <div className="space-y-1.5">
                          {cf.collect.slice(0, 4).map((c) => (
                            <div key={c.inv.invNo} className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-mono text-[#4E5969]">{c.inv.invNo}</span>
                              <span className={`rounded-[2px] px-1 py-0.5 text-[10px] ${COLLECT_CLS[c.stage]}`}>{c.stage}</span>
                              <span className="text-[#86909C]">逾期 {c.days} 天 · 余额 {fmtMoney(invBalance(c.inv))} 元</span>
                              {c.broken ? <span className="text-[#F53F3F]">承诺 {c.inv.promiseDate} 已破约</span> : c.inv.promiseDate ? <span className="text-[#4E5969]">承诺 {c.inv.promiseDate}</span> : <span />}
                            </div>
                          ))}
                          {cf.collect.length > 4 && <div className="text-[10px] text-[#86909C]">其余 {cf.collect.length - 4} 笔见财务中心「催收行动」</div>}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="mb-1.5 font-semibold text-[#1D2129]">回款记录（{pays.length}）</div>
                    {pays.length ? (
                      <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB]">
                        <table className="w-full">
                          <thead><tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]"><th className="px-2 py-1.5">回款单号</th><th className="px-2 py-1.5 text-right">金额</th><th className="px-2 py-1.5">方式 / 日期</th></tr></thead>
                          <tbody>
                            {pays.map((p) => (
                              <tr key={p.payNo} className="border-b last:border-0">
                                <td className="px-2 py-1.5 font-mono">{p.payNo}</td>
                                <td className="px-2 py-1.5 text-right font-mono text-[#00B42A]">{fmtMoney(p.amount)}</td>
                                <td className="px-2 py-1.5 text-[#4E5969]">{p.method} · {p.paidAt.slice(0, 10)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <div className="rounded-[4px] bg-[#F7F8FA] px-3 py-4 text-center text-[#86909C]">暂无回款记录</div>}
                    <div className="mt-2 rounded-[2px] bg-[#F7F8FA] px-3 py-2 text-[11px] text-[#86909C]">累计回款 {pays.length} 笔 · 合计 {fmtMoney(pays.reduce((s, p) => s + p.amount, 0))} 元</div>
                  </div>
                </div>
              )}

              {/* 在用资源 */}
              {viewTab === "resources" && (
                <div>
                  {resources.length ? (
                    <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB]">
                      <table className="w-full">
                        <thead><tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]"><th className="px-2 py-1.5">出口池</th><th className="px-2 py-1.5 text-right">占用带宽</th><th className="px-2 py-1.5">开通自</th><th className="px-2 py-1.5 text-right">操作</th></tr></thead>
                        <tbody>
                          {resources.map((o, i) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                              <td className="px-2 py-1.5 text-[#4E5969]">{o.pool}</td>
                              <td className="px-2 py-1.5 text-right font-mono">{o.bw}M</td>
                              <td className="px-2 py-1.5 text-[#4E5969]">{o.since}</td>
                              <td className="px-2 py-1.5 text-right"><button onClick={() => { setViewing(null); navigate("/resources/r1"); }} className="text-[11px] text-[#165DFF] hover:underline">出口池 →</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="rounded-[4px] bg-[#F7F8FA] px-3 py-6 text-center text-[#86909C]">暂无在用出口资源</div>}
                  <div className="mt-2 text-[11px] text-[#86909C]">资源明细（CPE / IP 段 / 机柜）在合同详情与开通工单中查看</div>
                </div>
              )}

              {/* 时间线 */}
              {viewTab === "timeline" && (
                <div className="max-h-96 overflow-y-auto">
                  {timeline.length ? (
                    <div className="relative pl-5">
                      <span className="absolute bottom-1 left-[7px] top-1 w-px bg-[#E5E6EB]" />
                      {timeline.map((t, i) => (
                        <button key={i} onClick={() => { setViewing(null); navigate(t.link); }} className="group relative block w-full pb-4 text-left">
                          <span className="absolute -left-5 top-1 h-3 w-3 rounded-full border-2 border-white shadow" style={{ background: t.color }} />
                          <div className="text-[10px] text-[#86909C]">{t.at} · <span className="font-medium" style={{ color: t.color }}>{t.icon}</span></div>
                          <div className="mt-0.5 text-[12px] text-[#4E5969] group-hover:text-[#165DFF]">{t.text}</div>
                        </button>
                      ))}
                    </div>
                  ) : <div className="py-8 text-center text-[#86909C]">暂无经营动态</div>}
                </div>
              )}
            </div>
          </CenterModal>
        );
      })()}

      {editing && (
        <CenterModal title={editing.id ? `编辑客户 · ${editing.id}` : "新建客户"} sub="客户主数据：带 * 为关键字段" width={560} onClose={() => setEditing(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">客户名称 <span className="text-[#F53F3F]">*</span></div>
                <Input autoFocus value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">统一社会信用代码</div>
                <Input placeholder="18 位，合同主体核验用" value={editing.creditCode ?? ""} onChange={(e) => setEditing({ ...editing, creditCode: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">客户等级</div>
                <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={editing.level ?? "C"} onChange={(e) => setEditing({ ...editing, level: e.target.value as Customer["level"] })}>
                  <option value="A">A（战略/大客户）</option><option value="B">B（成长客户）</option><option value="C">C（普通客户）</option>
                </select>
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">所属行业 <span className="text-[#F53F3F]">*</span></div>
                <Input value={editing.industry ?? ""} onChange={(e) => setEditing({ ...editing, industry: e.target.value })} />
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">客户来源</div>
                <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={editing.source ?? ""} onChange={(e) => setEditing({ ...editing, source: e.target.value })}>
                  <option value="">未选择</option>{["老客户续扩", "转介绍", "市场活动", "招标", "陌拜", "其他"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-xs text-[#4E5969]">办公地址（省 / 市 / 区 + 详细地址）</div>
              <RegionCascader withDetail value={editing.address ?? ""} onChange={(v) => setEditing({ ...editing, address: v })} />
            </div>
            <div className="rounded-[2px] border border-[#E5E6EB] bg-[#F7F8FA] p-3">
              <div className="mb-2 text-[11px] font-semibold text-[#4E5969]">开票信息（客户主数据自维护；开票申请自动带出，专票必须维护税号）</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-0.5 text-xs text-[#4E5969]">开票抬头</div>
                  <Input placeholder="默认同客户名称" value={editing.invoiceTitle ?? ""} onChange={(e) => setEditing({ ...editing, invoiceTitle: e.target.value })} />
                </div>
                <div>
                  <div className="mb-0.5 text-xs text-[#4E5969]">开票税号</div>
                  <Input placeholder="统一社会信用代码" value={editing.taxNo ?? ""} onChange={(e) => setEditing({ ...editing, taxNo: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">联系人 <span className="text-[#F53F3F]">*</span></div>
                <Input value={editing.contact ?? ""} onChange={(e) => setEditing({ ...editing, contact: e.target.value })} />
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">联系人职务</div>
                <Input placeholder="如 IT 部负责人" value={editing.contactTitle ?? ""} onChange={(e) => setEditing({ ...editing, contactTitle: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">联系电话 <span className="text-[#F53F3F]">*</span></div>
                <Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">邮箱</div>
                <Input value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">归属销售 <span className="text-[#F53F3F]">*</span></div>
                <Input value={editing.sales ?? ""} onChange={(e) => setEditing({ ...editing, sales: e.target.value })} />
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">客户状态</div>
                <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as Customer["status"] })}>
                  <option>潜在</option><option>合作中</option>
                </select>
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-xs text-[#4E5969]">备注</div>
              <textarea className="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5 text-sm" rows={2} placeholder="经营要点、敏感点（如账期要求）、关键决策人等" value={editing.remark ?? ""} onChange={(e) => setEditing({ ...editing, remark: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>取消</Button>
              <Button size="sm" onClick={save}>保存</Button>
            </div>
          </div>
        </CenterModal>
      )}
    </ArcoShell>
  );
}
