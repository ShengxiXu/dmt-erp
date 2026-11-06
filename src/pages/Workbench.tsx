import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  PencilLine, CheckSquare, Wrench, Calculator, ReceiptText, Receipt, Banknote, RefreshCcw,
  TrendingUp, TrendingDown, CircleAlert, ArrowUpRight,
} from "lucide-react";
import ArcoShell from "@/components/ArcoShell";
import { SHEETS } from "@/data/sheets";
import { WORK_ORDERS, STEP_NAMES } from "@/data/delivery";
import { RECEIVABLES } from "@/data/receivables";
import { R1_ROWS } from "@/data/resources";
import { getBatches, useSettle } from "@/data/settle";

const ROLES = ["业务支撑部", "技术部", "财务", "管理层"] as const;
type Role = (typeof ROLES)[number];

const fmtWan = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1)} 万` : n.toLocaleString("zh-CN"));

/** 待办项：全部由台账数据推导（核算单 / 工单 / 应收 / 资源池），不写死 */
interface Todo { title: string; sub: string; link: string; cta: string; hot?: boolean }

const overdueInv = RECEIVABLES.filter((r) => r.status === "逾期" || r.status === "欠停");
const overdueSum = overdueInv.reduce((s, r) => s + (r.amount - r.received), 0);

function buildTodos(role: Role): Todo[] {
  const approving = SHEETS.filter((s) => s.status === "审批中");
  /** 核算单台账的合同字段是「HT-xxxx · N 个月」，取其合同号用于深链到录入页 */
  const contractNo = (contract: string) => contract.split(" ")[0];
  switch (role) {
    case "业务支撑部": {
      const t: Todo[] = [];
      SHEETS.filter((s) => s.status === "待填写").forEach((s) =>
        t.push({ title: `核算单 ${s.id} · ${s.customer}`, sub: `新单待起草 · 合同行已带入（${s.updated.slice(5, 10)} 更新）`, link: `/?contract=${contractNo(s.contract)}`, cta: "去填报" }));
      SHEETS.filter((s) => s.status === "待对方提交").forEach((s) =>
        t.push({ title: `核算单 ${s.id} · ${s.customer}`, sub: "你方条目已完成，等技术部提交", link: `/cost?status=待对方提交&kw=${s.id}`, cta: "查看进度" }));
      SHEETS.filter((s) => (s.pendingLink ?? 0) > 0).forEach((s) =>
        t.push({ title: `核算单 ${s.id} · ${s.customer}`, sub: `${s.pendingLink} 条手工填入待补关联（采购合同 / 资源建档后补）`, link: `/cost?pending=1&kw=${s.id}`, cta: "去补关联" }));
      return t;
    }
    case "技术部": {
      const t: Todo[] = [];
      SHEETS.filter((s) => !s.techDone && s.status === "待对方提交").forEach((s) =>
        t.push({ title: `核算单 ${s.id} · ${s.customer}`, sub: "支撑部已提交，等你方填技术类条目", link: `/?contract=${contractNo(s.contract)}`, cta: "去填报" }));
      [...WORK_ORDERS].filter((w) => w.step < 6).sort((a, b) => a.deadline.localeCompare(b.deadline))
        .forEach((w, i) =>
          t.push({ title: `工单 ${w.id} · ${w.customer}`, sub: `当前节点：${STEP_NAMES[w.step]} · 要求 ${w.deadline.slice(5)} 前完成`, link: `/delivery/detail?id=${w.id}`, cta: "去处理", hot: i === 0 }));
      const top = [...R1_ROWS].sort((a, b) => b.dynamic.usedM / b.capacityM - a.dynamic.usedM / a.capacityM)[0];
      if (top) {
        const pct = Math.round((top.dynamic.usedM / top.capacityM) * 100);
        t.push({ title: `${top.id} ${top.carrier}出口利用率 ${pct}%（当前最高）`, sub: `${top.product}${top.sharedWith ? ` · 与 ${top.sharedWith} 共用` : ""} · 关注扩容节奏`, link: "/resources/r1", cta: "查看" });
      }
      return t;
    }
    case "财务": {
      const t: Todo[] = [];
      approving.forEach((s) =>
        t.push({ title: `核算单 ${s.id} · ${s.customer}`, sub: `月成本 ${s.monthlyCost.toLocaleString("zh-CN")} 元 · 毛利 ${s.margin}% · 当前节点：${s.curNode ?? "—"}`, link: `/approval?id=${s.id}`, cta: "去审批", hot: true }));
      SHEETS.filter((s) => s.status === "变更中").forEach((s) =>
        t.push({ title: `核算单 ${s.id} · ${s.customer}`, sub: `变更复核中 · ${s.curNode ?? ""}`, link: `/cost?status=变更中&kw=${s.id}`, cta: "查看" }));
      if (overdueInv.length)
        t.push({ title: `逾期应收 ${fmtWan(overdueSum)} 元`, sub: overdueInv.map((r) => `${r.customer} ${fmtWan(r.amount - r.received)}`).join("；"), link: "/finance/overdue", cta: "去催收" });
      if (!getBatches().some((b) => b.period === "2026-10"))
        t.push({ title: "10 月账期待跑月结", sub: "跑批后生成各客户毛利与核算差异对比", link: "/finance/settle", cta: "去跑月结" });
      return t;
    }
    case "管理层": {
      const t: Todo[] = [];
      [...SHEETS].filter((s) => s.margin < 45).sort((a, b) => a.margin - b.margin).forEach((s) =>
        t.push({
          title: `${s.id} 毛利率 ${s.margin}%（低于 45% 阈值）`, sub: `${s.customer} · ${s.status}${s.status === "审批中" ? "，审批时关注出口选型" : ""}`,
          link: s.status === "审批中" ? `/approval?id=${s.id}` : `/cost?kw=${s.id}`, cta: "查看", hot: s.margin < 30,
        }));
      const e = R1_ROWS.find((r) => r.id === "E-CT-1");
      if (e) t.push({ title: `${e.id} 已售 ${e.dynamic.usedM}M / ${e.capacityM}M`, sub: `${e.product} · 与 ${e.sharedWith} 共用，扩容采购可提前排期`, link: "/resources/r1", cta: "查看" });
      if (overdueInv.length)
        t.push({ title: `逾期 / 欠停应收合计 ${fmtWan(overdueSum)} 元`, sub: `${overdueInv.length} 笔 · ${overdueInv.map((r) => r.customer).join("、")}`, link: "/finance/overdue", cta: "查看" });
      return t;
    }
  }
}

/** KPI 图标：宝石系渐变（靛蓝/青/琥珀/玫红） */
const KPI_TONES = [
  { chip: "bg-gradient-to-br from-[#6366F1] to-[#8B5CF6]", glow: "hover:shadow-[0_12px_32px_rgba(99,102,241,0.18)]" },
  { chip: "bg-gradient-to-br from-[#0D9488] to-[#14B8A6]", glow: "hover:shadow-[0_12px_32px_rgba(13,148,136,0.18)]" },
  { chip: "bg-gradient-to-br from-[#D97706] to-[#F59E0B]", glow: "hover:shadow-[0_12px_32px_rgba(217,119,6,0.18)]" },
  { chip: "bg-gradient-to-br from-[#E11D48] to-[#F43F5E]", glow: "hover:shadow-[0_12px_32px_rgba(225,29,72,0.18)]" },
];

export default function Workbench() {
  const [role, setRole] = useState<Role>("业务支撑部");
  useSettle(); // 跑完月结回来，月结相关卡片自动刷新

  const now = new Date();
  const wd = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][now.getDay()];
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${wd}`;
  const hour = now.getHours();
  const greet = hour < 6 ? "夜深了" : hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";

  const todos = useMemo(() => buildTodos(role), [role]);
  const approving = SHEETS.filter((s) => s.status === "审批中");
  const approvingCost = approving.reduce((s, x) => s + x.monthlyCost, 0);
  const woOnway = WORK_ORDERS.filter((w) => w.step < 6).length;
  const batches = getBatches();
  const latest = batches[0];
  const latestMarginRate = latest && latest.totals.revenue > 0 ? `${((latest.totals.margin / latest.totals.revenue) * 100).toFixed(1)}%` : null;
  const diffAlert = latest ? latest.diffs.filter((d) => d.level !== "正常").length : 0;

  // ---------- 角色专属 KPI：不同角色看不同的数 ----------
  const drafts = SHEETS.filter((s) => s.status === "待填写").length;
  const linkCnt = SHEETS.reduce((s, x) => s + (x.pendingLink ?? 0), 0);
  const techPending = SHEETS.filter((s) => !s.techDone && s.status === "待对方提交").length;
  const lowMargin = SHEETS.filter((s) => s.margin < 45).length;
  const avgPool = Math.round((R1_ROWS.reduce((s, r) => s + r.dynamic.usedM / r.capacityM, 0) / R1_ROWS.length) * 100);
  const maxPool = [...R1_ROWS].sort((a, b) => b.dynamic.usedM / b.capacityM - a.dynamic.usedM / a.capacityM)[0];
  const maxPoolPct = maxPool ? Math.round((maxPool.dynamic.usedM / maxPool.capacityM) * 100) : 0;
  const nearestWo = WORK_ORDERS.filter((w) => w.step < 6).map((w) => w.deadline).sort()[0];

  const kpis: Record<Role, { label: string; value: string; delta: string; good: boolean; to: string }[]> = {
    业务支撑部: [
      { label: "我的待办", value: `${todos.length} 项`, delta: "按紧急度排序", good: true, to: "#todo" },
      { label: "待起草核算单", value: `${drafts} 单`, delta: "合同流程带入 · 无新建入口", good: true, to: "/cost?status=待填写" },
      { label: "待补关联", value: `${linkCnt} 条`, delta: "采购合同 / 资源建档后补", good: linkCnt === 0, to: "/cost?pending=1" },
      { label: "审批中", value: `${approving.length} 单`, delta: `合计月成本 ${fmtWan(approvingCost)} 元`, good: true, to: "/cost?status=审批中" },
    ],
    技术部: [
      { label: "我的待办", value: `${todos.length} 项`, delta: "按紧急度排序", good: true, to: "#todo" },
      { label: "在途工单", value: `${woOnway} 个`, delta: nearestWo ? `最近 deadline ${nearestWo.slice(5)}` : "无在途工单", good: true, to: "/delivery" },
      { label: "待填技术条目", value: `${techPending} 单`, delta: "支撑部已提交，等你方填报", good: techPending === 0, to: "/cost?status=待对方提交" },
      { label: "出口池最高利用率", value: `${maxPoolPct}%`, delta: maxPool ? `${maxPool.id} ${maxPool.carrier} · ${maxPool.product}` : "—", good: maxPoolPct <= 70, to: "/resources/r1" },
    ],
    财务: [
      { label: "我的待办", value: `${todos.length} 项`, delta: "按紧急度排序", good: true, to: "#todo" },
      { label: "待审批", value: `${approving.length} 单`, delta: `合计月成本 ${fmtWan(approvingCost)} 元`, good: true, to: "/approval" },
      { label: "逾期应收", value: `${fmtWan(overdueSum)} 元`, delta: `${overdueInv.length} 笔逾期 / 欠停`, good: false, to: "/finance/overdue" },
      { label: "月结毛利率", value: latestMarginRate ?? "待跑月结", delta: latest ? `${latest.period} 批次 · ${latest.runAt.slice(0, 10)} 锁定` : "10 月账期待跑", good: true, to: "/finance/settle" },
    ],
    管理层: [
      { label: "低毛利核算单", value: `${lowMargin} 张`, delta: "阈值 45%，审批时关注", good: lowMargin === 0, to: "/cost" },
      { label: "审批中月成本", value: `${fmtWan(approvingCost)} 元/月`, delta: `${approving.length} 单在审`, good: true, to: "/approval" },
      { label: "逾期应收", value: `${fmtWan(overdueSum)} 元`, delta: `${overdueInv.length} 笔逾期 / 欠停`, good: false, to: "/finance/overdue" },
      { label: "出口池平均利用率", value: `${avgPool}%`, delta: `${R1_ROWS.length} 条出口`, good: true, to: "/resources/r1" },
    ],
  };

  // ---------- 角色关注卡（右列第一张，随角色切换） ----------
  const funnel = [
    { label: "待起草", count: drafts },
    { label: "待对方提交", count: SHEETS.filter((s) => s.status === "待对方提交").length },
    { label: "审批中", count: approving.length },
    { label: "已通过", count: SHEETS.filter((s) => s.status === "已通过").length },
  ];
  const funnelMax = Math.max(...funnel.map((f) => f.count), 1);
  const woByStep = WORK_ORDERS.filter((w) => w.step < 6)
    .reduce<{ name: string; count: number }[]>((acc, w) => {
      const name = STEP_NAMES[w.step];
      const hit = acc.find((a) => a.name === name);
      if (hit) hit.count += 1; else acc.push({ name, count: 1 });
      return acc;
    }, []);
  const woMax = Math.max(...woByStep.map((w) => w.count), 1);
  const invByStatus = (["已收讫", "部分收款", "已发出", "逾期", "欠停"] as const)
    .map((st) => ({ st, list: RECEIVABLES.filter((r) => r.status === st) }))
    .filter((g) => g.list.length)
    .map((g) => ({ label: g.st, count: g.list.length, sum: g.list.reduce((s, r) => s + r.amount - r.received, 0) }));
  const invMax = Math.max(...invByStatus.map((g) => g.count), 1);

  const quick = [
    { to: "/", label: "核算单录入", icon: PencilLine, desc: "合同流程带入 · 无新建入口", tone: "bg-[#EEF2FF] text-[#4F46E5]" },
    { to: "/approval", label: "审批中心", icon: CheckSquare, desc: `${approving.length} 单待审`, tone: "bg-[#F0FDFA] text-[#0D9488]" },
    { to: "/delivery", label: "开通工单", icon: Wrench, desc: `${woOnway} 个在途`, tone: "bg-[#FFFBEB] text-[#B45309]" },
    { to: "/finance/settle", label: "月结", icon: Calculator, desc: latest ? `最近 ${latest.period}` : "本月待跑", tone: "bg-[#F5F3FF] text-[#7C3AED]" },
    { to: "/billing", label: "客户账单", icon: ReceiptText, desc: "应收总览", tone: "bg-[#ECFEFF] text-[#0891B2]" },
    { to: "/finance/invoices", label: "开票管理", icon: Receipt, desc: "开票申请", tone: "bg-[#FFF1F2] text-[#BE123C]" },
    { to: "/finance/payments", label: "收款管理", icon: Banknote, desc: "收款登记", tone: "bg-[#F0FDF4] text-[#15803D]" },
    { to: "/lifecycle", label: "变更与退订", icon: RefreshCcw, desc: "生命周期", tone: "bg-[#FFF7ED] text-[#C2410C]" },
  ];

  const pools = useMemo(() => [...R1_ROWS].sort((a, b) => b.dynamic.usedM / b.capacityM - a.dynamic.usedM / a.capacityM).slice(0, 4), []);
  const bannerStats = [
    { label: "我的待办", value: `${todos.length} 项`, alert: false },
    { label: "审批中核算单", value: `${approving.length} 单`, alert: false },
    { label: "逾期应收", value: `${fmtWan(overdueSum)} 元`, alert: overdueSum > 0 },
  ];

  return (
    <ArcoShell breadcrumb="工作台" userRole={role}>
      <style>{`
        @keyframes wb-aurora-a { 0%,100% { transform: translate(0,0) scale(1); opacity:.5; } 50% { transform: translate(40px,-20px) scale(1.15); opacity:.7; } }
        @keyframes wb-aurora-b { 0%,100% { transform: translate(0,0) scale(1.1); opacity:.4; } 50% { transform: translate(-30px,24px) scale(1); opacity:.6; } }
        @keyframes wb-aurora-c { 0%,100% { transform: translate(0,0) scale(1); opacity:.35; } 50% { transform: translate(16px,30px) scale(1.2); opacity:.55; } }
      `}</style>
      <main className="space-y-4 p-6">
        {/* 角色切换（演示）：胶囊分段控件 */}
        <div className="flex items-center gap-3 rounded-[14px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <span className="text-[12px] text-[#86909C]">当前角色（演示切换）</span>
          <div className="flex gap-1 rounded-full bg-[#F2F3F5] p-1">
            {ROLES.map((r) => (
              <button key={r} onClick={() => setRole(r)}
                className={`h-7 rounded-full px-3.5 text-[12px] transition-all ${role === r ? "bg-white font-medium text-[#1D2129] shadow-sm ring-1 ring-[#6366F1]/25" : "text-[#86909C] hover:text-[#4E5969]"}`}>{r}</button>
            ))}
          </div>
          <span className="ml-auto text-[12px] text-[#C9CDD4]">待办、KPI、快捷入口随角色变化</span>
        </div>

        {/* 问候横幅：藏青紫渐变 + 极光光晕（深色高级感） */}
        <section className="relative overflow-hidden rounded-[16px] px-10 py-10 text-white"
          style={{ background: "linear-gradient(115deg, #0E1130 0%, #1A1B4B 45%, #2B1E5E 100%)" }}>
          {/* 极光光晕 */}
          <div className="pointer-events-none absolute -left-24 -top-32 h-96 w-96 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(99,102,241,0.55) 0%, transparent 70%)", animation: "wb-aurora-a 10s ease-in-out infinite" }} />
          <div className="pointer-events-none absolute -bottom-40 right-32 h-[420px] w-[420px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(167,139,250,0.4) 0%, transparent 70%)", animation: "wb-aurora-b 13s ease-in-out infinite" }} />
          <div className="pointer-events-none absolute right-1/3 top-0 h-56 w-56 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(45,212,191,0.25) 0%, transparent 70%)", animation: "wb-aurora-c 11s ease-in-out infinite" }} />
          {/* 细颗粒网格 */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />

          <div className="relative flex items-end justify-between gap-8">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[12px] text-white/90 backdrop-blur-sm">{role}</span>
                <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[12px] text-white/70 backdrop-blur-sm">{dateStr}</span>
              </div>
              <h1 className="mt-4 text-[34px] font-semibold leading-tight tracking-tight">{greet}，许晟熙</h1>
              <p className="mt-2 max-w-[560px] text-[15px] leading-7 text-white/70">
                {role === "业务支撑部" && <>今天有 {todos.length} 项待办：起草核算单、补关联。核算单由合同流程带入，从下方待办或「核算单录入」进入处理。</>}
                {role === "技术部" && <>{todos.length} 项待办：核算单技术条目、在途工单处理。工单从「开通工单」列表按 deadline 推进。</>}
                {role === "财务" && <>{approving.length} 张核算单待审批，逾期应收 {fmtWan(overdueSum)} 元。审批在「审批中心」处理，月结在「月结」页跑批。</>}
                {role === "管理层" && <>经营概览：逾期应收 {fmtWan(overdueSum)} 元，{SHEETS.filter((s) => s.margin < 45).length} 张核算单毛利低于阈值。</>}
              </p>
            </div>
            {/* 毛玻璃数据块（纯展示，不做入口） */}
            <div className="hidden shrink-0 items-center gap-3 lg:flex">
              {bannerStats.map((s) => (
                <div key={s.label} className="rounded-[14px] border border-white/15 bg-white/10 px-5 py-4 shadow-[0_8px_24px_rgba(6,8,40,0.35)] backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/15">
                  <div className="text-[11px] tracking-wide text-white/60">{s.label}</div>
                  <div className={`mt-1 text-[22px] font-semibold leading-6 tracking-tight ${s.alert ? "text-[#FCD34D]" : "text-white"}`}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* KPI 指标卡（随角色切换） */}
        <div className="grid grid-cols-4 gap-4">
          {kpis[role].map((k, i) => {
            const tone = KPI_TONES[i % KPI_TONES.length];
            const Trend = k.good ? TrendingUp : TrendingDown;
            const inner = (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#86909C]">{k.label}</span>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-[10px] text-white shadow-md ${tone.chip}`}>
                    <Trend size={15} />
                  </span>
                </div>
                <div className="mt-3 bg-gradient-to-br from-[#1D2129] to-[#4B5563] bg-clip-text text-[30px] font-semibold leading-8 tracking-tight text-transparent">{k.value}</div>
                <div className={`mt-2 truncate text-[12px] ${k.good ? "text-[#86909C]" : "text-[#E11D48]"}`}>{k.delta}</div>
              </>
            );
            const cls = `block rounded-[14px] border border-[#E5E6EB] bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 ${tone.glow}`;
            return k.to.startsWith("#") ? (
              <a key={k.label} href={k.to} className={cls}>{inner}</a>
            ) : (
              <Link key={k.label} to={k.to} className={cls}>{inner}</Link>
            );
          })}
        </div>

        {/* 快捷入口 */}
        <div className="grid grid-cols-8 gap-3">
          {quick.map((q) => (
            <Link key={q.to + q.label} to={q.to}
              className="group rounded-[14px] border border-[#E5E6EB] bg-white px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(29,33,41,0.08)]">
              <div className="flex items-center justify-between">
                <span className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${q.tone} transition-transform duration-200 group-hover:scale-110`}>
                  <q.icon size={17} strokeWidth={1.8} />
                </span>
                <ArrowUpRight size={14} className="text-[#C9CDD4] transition-all group-hover:translate-x-0.5 group-hover:text-[#165DFF]" />
              </div>
              <div className="mt-3 text-[14px] font-medium tracking-tight text-[#1D2129]">{q.label}</div>
              <div className="mt-0.5 truncate text-[12px] text-[#86909C]">{q.desc}</div>
            </Link>
          ))}
        </div>

        {/* 主内容：2/3 + 1/3 */}
        <div className="grid grid-cols-3 gap-4">
          {/* 我的待办 */}
          <section id="todo" className="col-span-2 overflow-hidden rounded-[14px] border border-[#E5E6EB] bg-white">
            <div className="flex h-14 items-center justify-between border-b border-[#F2F3F5] px-6">
              <h2 className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-[#1D2129]">
                <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[#6366F1] to-[#A78BFA]" />我的待办
              </h2>
              <span className="text-[13px] text-[#86909C]">{todos.length} 项 · 按紧急度排序</span>
            </div>
            <div className="divide-y divide-[#F2F3F5]">
              {todos.map((t) => (
                <Link key={t.title} to={t.link}
                  className={`group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#F7F8FA] ${t.hot ? "border-l-[3px] border-l-[#E11D48] bg-[#FFF5F6]" : "border-l-[3px] border-l-transparent"}`}>
                  {t.hot ? (
                    <CircleAlert size={18} className="shrink-0 text-[#E11D48]" />
                  ) : (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[#C9CDD4]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] text-[#1D2129]">{t.title}</div>
                    <div className="mt-0.5 truncate text-[13px] text-[#86909C]">{t.sub}</div>
                  </div>
                  <span className="flex h-7 shrink-0 items-center rounded-[2px] border border-[#E5E6EB] px-3 text-[13px] text-[#4E5969] group-hover:border-[#165DFF] group-hover:text-[#165DFF]">{t.cta}</span>
                </Link>
              ))}
              {!todos.length && <div className="px-5 py-10 text-center text-[13px] text-[#86909C]">当前没有待办，一切正常</div>}
            </div>
          </section>

          {/* 右列：角色关注卡 + 出口资源池水位 */}
          <aside className="space-y-4">
            {/* 角色关注卡（随角色切换） */}
            <section className="rounded-[14px] border border-[#E5E6EB] bg-white p-6">
              {role === "业务支撑部" && (<>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-[#1D2129]">
                    <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[#6366F1] to-[#A78BFA]" />核算单漏斗
                  </h2>
                  <Link to="/cost" className="text-[13px] text-[#165DFF] hover:underline">去处理</Link>
                </div>
                <div className="space-y-3">
                  {funnel.map((f) => (
                    <div key={f.label}>
                      <div className="mb-1 flex justify-between text-[13px]">
                        <span className="text-[#4E5969]">{f.label}</span>
                        <span className="font-medium text-[#1D2129]">{f.count} 单</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#F2F3F5]">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6]" style={{ width: `${(f.count / funnelMax) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[12px] leading-5 text-[#86909C]">核算单由合同签订自动带入，从「待起草」开始流转</p>
              </>)}
              {role === "技术部" && (<>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-[#1D2129]">
                    <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[#6366F1] to-[#A78BFA]" />在途工单节点
                  </h2>
                  <Link to="/delivery" className="text-[13px] text-[#165DFF] hover:underline">全部工单</Link>
                </div>
                <div className="space-y-3">
                  {woByStep.map((w) => (
                    <div key={w.name}>
                      <div className="mb-1 flex justify-between text-[13px]">
                        <span className="text-[#4E5969]">{w.name}</span>
                        <span className="font-medium text-[#1D2129]">{w.count} 个</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#F2F3F5]">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#0D9488] to-[#14B8A6]" style={{ width: `${(w.count / woMax) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[12px] leading-5 text-[#86909C]">七个节点：可用性检查 → 分配申请 → 分配审批 → 绑定扣减 → 实施 → 确认 → 激活计费</p>
              </>)}
              {(role === "财务" || role === "管理层") && (<>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-[#1D2129]">
                    <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[#6366F1] to-[#A78BFA]" />{role === "财务" ? "应收状态分布" : "月结概览"}
                  </h2>
                  <Link to={role === "财务" ? "/billing" : "/finance/settle"} className="text-[13px] text-[#165DFF] hover:underline">{role === "财务" ? "客户账单" : latest ? "全部批次" : "去跑月结"}</Link>
                </div>
                {role === "财务" ? (
                  <>
                    <div className="space-y-3">
                      {invByStatus.map((g) => (
                        <div key={g.label}>
                          <div className="mb-1 flex justify-between text-[13px]">
                            <span className="text-[#4E5969]">{g.label}</span>
                            <span className={`font-medium ${g.label === "逾期" || g.label === "欠停" ? "text-[#F53F3F]" : "text-[#1D2129]"}`}>{g.count} 笔 · 未收 {fmtWan(g.sum)} 元</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-[#F2F3F5]">
                            <div className={`h-full rounded-full ${g.label === "逾期" || g.label === "欠停" ? "bg-gradient-to-r from-[#E11D48] to-[#F43F5E]" : "bg-gradient-to-r from-[#6366F1] to-[#818CF8]"}`} style={{ width: `${(g.count / invMax) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-[12px] leading-5 text-[#86909C]">账期按实际开通日期滚动，非自然月</p>
                  </>
                ) : latest ? (
                  <div className="space-y-2 text-[13px] leading-6">
                    <div className="flex justify-between"><span className="text-[#86909C]">最近批次</span><span className="font-medium text-[#1D2129]">{latest.batchNo}（{latest.period}）</span></div>
                    <div className="flex justify-between"><span className="text-[#86909C]">当期收入 / 毛利</span><span className="font-medium text-[#1D2129]">{fmtWan(latest.totals.revenue)} 元 / {fmtWan(latest.totals.margin)} 元</span></div>
                    <div className="flex justify-between"><span className="text-[#86909C]">毛利率</span><span className="font-medium text-[#1D2129]">{latestMarginRate}</span></div>
                    <div className="flex justify-between"><span className="text-[#86909C]">核算差异（黄 / 红）</span><span className={`font-medium ${diffAlert ? "text-[#F53F3F]" : "text-[#1D2129]"}`}>{diffAlert ? `${diffAlert} 单待跟进` : "全部正常"}</span></div>
                  </div>
                ) : (
                  <div className="py-2 text-[13px] leading-6 text-[#86909C]">
                    暂无月结批次。跑首批月结后，这里展示各客户收入、毛利与核算差异对比。
                  </div>
                )}
              </>)}
            </section>

            <section className="rounded-[14px] border border-[#E5E6EB] bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-[#1D2129]">
                  <span className="h-4 w-1 rounded-full bg-gradient-to-b from-[#6366F1] to-[#A78BFA]" />出口资源池水位
                </h2>
                <Link to="/resources/r1" className="text-[13px] text-[#165DFF] hover:underline">全部</Link>
              </div>
              <div className="space-y-4">
                {pools.map((p) => {
                  const pct = (p.dynamic.usedM / p.capacityM) * 100;
                  const barColor = pct > 85 ? "bg-gradient-to-r from-[#E11D48] to-[#F43F5E]" : "bg-gradient-to-r from-[#6366F1] to-[#818CF8]";
                  const textColor = pct > 85 ? "text-[#E11D48]" : "text-[#1D2129]";
                  return (
                    <div key={p.id}>
                      <div className="mb-1.5 flex justify-between text-[13px]">
                        <span className="truncate text-[#4E5969]">{p.id} {p.carrier} · {p.product} · {p.capacityM >= 1000 ? `${p.capacityM / 1000}G` : `${p.capacityM}M`}</span>
                        <span className={`ml-2 shrink-0 font-medium ${textColor}`}>{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#F2F3F5]">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-[12px] leading-5 text-[#86909C]">按利用率排序取前 4 · 超 85% 红色告警</p>
            </section>
          </aside>
        </div>
      </main>
    </ArcoShell>
  );
}
