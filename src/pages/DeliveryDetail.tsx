import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { WORK_ORDERS, STEP_NAMES, TECH_PARAMS, CATS, IP_OCCUPIED, CAT_DESC } from "@/data/delivery";
import { R1_ROWS, R2_ROWS, R3_ROWS, R4_ROWS } from "@/data/resources";
import { usePurchaseFlow, woResumedByPurchase, addReq, getReqs } from "@/data/purchaseFlow";
import ArcoShell from "@/components/ArcoShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const fmt = (n: number) => n.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
/** 账期按开通日滚动（月结口径）：首账期 = 开通日 ~ 次月对应日前一日；月中开通按整月收 */
const periodEnd = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  const dim = new Date(ny, nm, 0).getDate();
  const end = new Date(ny, nm - 1, Math.min(d, dim));
  end.setDate(end.getDate() - 1);
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${end.getFullYear()}-${p2(end.getMonth() + 1)}-${p2(end.getDate())}`;
};

/** 一对「出口线路 + 绑定 IP 段」：一单可含多对（如 BGP 三网互通 = 电信/联通/移动各一对） */
interface Pair { line: string; ip: string; ipStart: string; ipN: number }
const segPrefix = (seg: string) => seg.split("/")[0].split(".").slice(0, 3).join(".");
/** 出口线路绑定的 IP 段（R3 档案 boundLines 字段） */
const segOfLine = (lineId: string) => R3_ROWS.find((r) => (r.boundLines ?? []).includes(lineId));

export default function DeliveryDetail() {
  usePurchaseFlow();
  const [sp] = useSearchParams();
  const id = sp.get("id") ?? "WO-2026-052";
  const wo = WORK_ORDERS.find((w) => w.id === id) ?? WORK_ORDERS[0];
  const [step, setStep] = useState(wo.step);
  /** 多出口对：BGP 三网互通默认三对（电信 E-CT-1 / 联通 I-102 / 移动 I-103，各绑自带 IP 段） */
  const initPairs = (): Pair[] =>
    wo.cat === "BGP 三网互通"
      ? [
          { line: "E-CT-1", ip: "IP-58.41.0", ipStart: "58.41.0.200", ipN: 4 },
          { line: "I-102", ip: "IP-58.42.0", ipStart: "58.42.0.200", ipN: 4 },
          { line: "I-103", ip: "IP-58.43.0", ipStart: "58.43.0.200", ipN: 4 },
        ]
      : [{ line: "I-101", ip: "IP-58.40.0", ipStart: "58.40.0.200", ipN: 4 }];
  const [pairs, setPairs] = useState<Pair[]>(initPairs);
  /** 出口负载评估结论（工程师人工），按线路号记录 */
  const [verdicts, setVerdicts] = useState<Record<string, "" | "ok" | "full">>({});
  const [poReq, setPoReq] = useState<{ id: string; name: string; qty: number; price: number; supplier: string } | null>(null);
  const [altCpe, setAltCpe] = useState("");
  const [form, setForm] = useState({ base: "B-001", cpeMode: "库存直绑（P02）", cpe: "EQ-AR6121", cpeN: 2 });
  const [cat, setCat] = useState(wo.cat);
  const [techVals, setTechVals] = useState<Record<string, string>>({});
  const [approved, setApproved] = useState(false);
  const [bound, setBound] = useState(false);
  const [tasks, setTasks] = useState([{ t: "光缆布线与熔接", done: false }, { t: "CPE 上架加电", done: false }, { t: "出口切分与路由配置", done: false }, { t: "IP 绑定与调测", done: false }]);
  const [openDate, setOpenDate] = useState("2026-10-26");
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState(false);

  // ②层动态数据的可变副本：绑定扣减时刻真实变化
  const [r1, setR1] = useState(() => R1_ROWS.map((r) => ({ ...r, dynamic: { ...r.dynamic, orders: [...r.dynamic.orders] } })));
  const [r3, setR3] = useState(() => R3_ROWS.map((r) => ({ ...r, dynamic: { ...r.dynamic, orders: [...r.dynamic.orders] } })));
  const [r4, setR4] = useState(() => R4_ROWS.map((r) => ({ ...r, dynamic: { ...r.dynamic } })));

  const lineOf = (lineId: string) => r1.find((r) => r.id === lineId) ?? r1[0];
  const ipOf = (ipId: string) => r3.find((r) => r.id === ipId) ?? r3[0];
  const cpe = useMemo(() => r4.find((r) => r.id === form.cpe) ?? r4[0], [r4, form.cpe]);
  const usedLines = [...new Set(pairs.map((p) => p.line))];
  const utilOf = (lid: string) => {
    const p = lineOf(lid);
    return p.capacityM > 0 ? Math.round(((p.dynamic.peakM ?? 0) / p.capacityM) * 100) : 0;
  };

  // 每对「出口 + IP 段」的地址级校验（前缀归属 / 可用范围 / 与②层已占用区间冲突）
  const pairCalc = (p: Pair) => {
    const row = ipOf(p.ip);
    const prefix = segPrefix(row.segment);
    const lastOct = (ip: string) => Number(ip.split(".")[3] ?? NaN);
    const occupied = IP_OCCUPIED[p.ip] ?? [];
    const startValid = p.ipStart.startsWith(`${prefix}.`);
    const startN = startValid ? lastOct(p.ipStart) : NaN;
    const endN = startN + p.ipN - 1;
    const rangeText = startValid && !Number.isNaN(startN) ? `${prefix}.${startN} – ${prefix}.${endN}（${p.ipN} 个）` : "—";
    const conflict = startValid && !Number.isNaN(startN) && !Number.isNaN(endN)
      ? occupied.find((o) => startN <= lastOct(o.end) && endN >= lastOct(o.start))
      : undefined;
    const valid = startValid && !Number.isNaN(startN) && p.ipN >= 1 && startN >= 1 && endN <= 254 && !conflict;
    const over = p.ipN > row.total - row.dynamic.allocated;
    return { row, prefix, startValid, startN, endN, rangeText, conflict, valid, over };
  };
  const calcs = pairs.map(pairCalc);
  const ipAllValid = calcs.every((c) => c.valid);
  const ipOverAny = calcs.some((c) => c.over);
  // 步骤②实时重校验：此处可换型号/改数量，提交前必须重新过余量（步骤①的检查结论不覆盖此处改动）
  const cpeOver = form.cpeMode === "库存直绑（P02）" && form.cpeN > cpe.dynamic.stock - cpe.dynamic.locked;
  const altCpes = r4.filter((r) => r.category === "CPE" && r.id !== form.cpe && r.dynamic.stock - r.dynamic.locked >= form.cpeN);

  // ---------- 步骤 0：资源检查（P02-2 口径） ----------
  type CheckRow = { key: string; type: "manual" | "auto"; name: string; rule: string; dataText?: string; free?: number; need?: number; freeNote?: string; unit?: string };
  const checks: CheckRow[] = [
    // 出口负载：每条约用线路一行，工程师人工评估（不做减法判定）
    ...usedLines.map((lid) => {
      const pool = lineOf(lid);
      return {
        key: `line:${lid}`, type: "manual" as const,
        name: `出口负载评估（${pool.id} ${pool.name.split("（")[0]}）`,
        rule: "工程师查看该出口流量负载是否饱和，决定本出口能否继续使用（按实际流量负载判断，不按已售带宽做减法）",
        dataText: `容量 ${fmt(pool.capacityM)}M · 已售 ${fmt(pool.dynamic.usedM)}M · 近 30 日峰值流量 ${fmt(pool.dynamic.peakM ?? 0)}M（利用率 ${utilOf(lid)}%）`,
      };
    }),
    // IP 余量：每一对「出口 + IP 段」一行，系统自动定量校验
    ...pairs.map((p, i) => ({
      key: `ip${i}`, type: "auto" as const,
      name: `绑定 IP 余量（${ipOf(p.ip).segment.split("（")[0]}）`,
      rule: "段内可用地址数 ≥ 需求数量",
      free: ipOf(p.ip).total - ipOf(p.ip).dynamic.allocated,
      need: p.ipN,
      freeNote: `${ipOf(p.ip).total} − 已分配 ${ipOf(p.ip).dynamic.allocated}`,
      unit: "个",
    })),
    { key: "cpe", type: "auto", name: `CPE 可用库存（${cpe.name}）`, rule: "在库 − 锁定 ≥ 需求台数（按单采购不校验库存）", free: form.cpeMode === "按单采购（P08）" ? form.cpeN : cpe.dynamic.stock - cpe.dynamic.locked, need: form.cpeN, freeNote: form.cpeMode === "按单采购（P08）" ? "按单采购，到货直发现场" : `在库 ${cpe.dynamic.stock} − 锁定 ${cpe.dynamic.locked}`, unit: "台" },
  ];
  const failed = checks.filter((c) => c.type === "auto" && (c.free ?? 0) < (c.need ?? 0));
  const fullLines = usedLines.filter((l) => verdicts[l] === "full");
  const lineBlocked = usedLines.some((l) => verdicts[l] !== "ok");
  const allPass = failed.length === 0 && !lineBlocked;
  /** IP 余量不足的对（索引 + 校验结果） */
  const failedPairs = pairs.map((p, i) => ({ p, i })).filter(({ i }) => calcs[i].over);

  // ---------- 未满足项处理 ----------
  const [expandM, setExpandM] = useState(500);
  const [expandNote, setExpandNote] = useState("");
  const [expandApproved, setExpandApproved] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [altPick, setAltPick] = useState<{ idx: number; lineId: string } | null>(null);

  const pool101 = lineOf("I-101");
  const newMonthly = Math.round((75000 * (500 + expandM)) / 500);
  const applyExpand = () => {
    setR1((rows) => rows.map((r) => (r.id === "I-101" ? { ...r, capacityM: r.capacityM + expandM, monthlyCost: newMonthly } : r)));
    setExpandApproved(true);
    setExpanded(true);
  };
  /** 某对「出口 + IP 段」的更换候选：未被本单其他对占用、且绑定的 IP 段余量满足需求 */
  const altCandidates = (idx: number) =>
    r1.filter((l) => l.id !== pairs[idx].line && !usedLines.includes(l.id))
      .map((l) => {
        const seg = segOfLine(l.id);
        if (!seg) return null;
        const free = seg.total - seg.dynamic.allocated;
        if (free < pairs[idx].ipN) return null;
        return { line: l, seg, free };
      })
      .filter(Boolean) as { line: (typeof r1)[number]; seg: (typeof r3)[number]; free: number }[];
  const applyAlt = (idx: number, lineId: string) => {
    const seg = segOfLine(lineId);
    if (!seg) return;
    setPairs((ps) => ps.map((x, j) => (j === idx ? { ...x, line: lineId, ip: seg.id, ipStart: `${segPrefix(seg.segment)}.200` } : x)));
    setAltPick(null);
  };

  // 检查结论摘要（进审批页展示、流转记录留痕）
  const checkSummary = [
    ...usedLines.map((l) => `出口 ${l} 负载${verdicts[l] === "ok" ? "正常" : verdicts[l] === "full" ? "饱和" : "待评估"}（利用率 ${utilOf(l)}%）`),
    expanded ? `I-101 已扩容 ${fmt(expandM)}M（500M → ${fmt(pool101.capacityM)}M，月租 ${fmt(newMonthly)} 元）` : "",
    form.cpeMode === "按单采购（P08）" ? `CPE 改按单采购（${poReq?.id ?? "采购申请"}，到货后恢复）` : "",
    suspended ? "不满足项已挂起并生成采购需求（P08-1）" : "",
  ].filter(Boolean).join("；");

  const bind = () => {
    setR1((rows) => rows.map((r) => {
      const n = pairs.filter((p) => p.line === r.id).length;
      if (!n) return r;
      return { ...r, dynamic: { ...r.dynamic, usedM: r.dynamic.usedM + 50 * n, orders: [...r.dynamic.orders.filter((o) => !o.customer.includes("核算中")), ...Array.from({ length: n }, () => ({ customer: "上海某科技公司", bw: 50, since: "开通后回填" }))] } };
    }));
    setR3((rows) => rows.map((r) => {
      const ps = pairs.filter((p) => p.ip === r.id);
      if (!ps.length) return r;
      const add = ps.reduce((s, p) => s + p.ipN, 0);
      return { ...r, dynamic: { ...r.dynamic, allocated: r.dynamic.allocated + add, orders: [...r.dynamic.orders.filter((o) => !o.customer.includes("核算中")), ...ps.map((p) => ({ customer: "上海某科技公司", n: p.ipN }))] } };
    }));
    // 库存直绑才扣减库存；按单采购不占库存（到货直发客户现场）
    if (form.cpeMode === "库存直绑（P02）") setR4((rows) => rows.map((r) => (r.id === form.cpe ? { ...r, dynamic: { stock: r.dynamic.stock - form.cpeN, locked: r.dynamic.locked - form.cpeN } } : r)));
    setBound(true);
  };

  const stepDone = step > 6 || done;
  const tasksAll = tasks.every((t) => t.done);
  const techFields = (TECH_PARAMS[cat] ?? []).flatMap((g) => g.fields);
  const techDone = techFields.length > 0 && techFields.every((f) => (techVals[f.label] ?? "").toString().trim() !== "");
  const setTech = (label: string, v: string) => setTechVals((s) => ({ ...s, [label]: v }));

  // ---------- 步骤①资源分配：增删「出口 + IP 段」对 ----------
  const addPair = () => {
    const rest = r1.filter((l) => !usedLines.includes(l.id) && segOfLine(l.id));
    const l = rest[0];
    if (!l) return;
    const seg = segOfLine(l.id)!;
    setPairs((ps) => [...ps, { line: l.id, ip: seg.id, ipStart: `${segPrefix(seg.segment)}.200`, ipN: 4 }]);
  };
  const changePairLine = (idx: number, lineId: string) => {
    const seg = segOfLine(lineId);
    setPairs((ps) => ps.map((x, j) => (j === idx ? { ...x, line: lineId, ip: seg?.id ?? x.ip, ipStart: seg ? `${segPrefix(seg.segment)}.200` : x.ipStart } : x)));
  };

  const logs = useMemo(() => {
    if (!bound) return [];
    return [
      ...(expanded ? [`②层写入 · 扩容生效：I-101 池容量 500M → ${fmt(pool101.capacityM)}M，月租 75,000 → ${fmt(pool101.monthlyCost)} 元`] : []),
      ...pairs.flatMap((p, i) => [
        `②层写入 · 出口池 ${p.line} 已售带宽 +50M（现 ${fmt(lineOf(p.line).dynamic.usedM)}M / ${fmt(lineOf(p.line).capacityM)}M）`,
        `②层写入 · IP 精确分配：本单 ${calcs[i].rangeText}，已记入 ${ipOf(p.ip).segment.split("（")[0]} 占用区间`,
      ]),
      ...(form.cpeMode === "库存直绑（P02）"
        ? [`②层写入 · CPE ${cpe.name}：锁定 ${form.cpeN} 台 → 出库（现存量 ${cpe.dynamic.stock + form.cpeN} → ${cpe.dynamic.stock} 台）`]
        : [`采购执行 · CPE ${cpe.name} × ${form.cpeN} 台按单采购，到货后直发客户现场（不占库存，一次性成本计入本单核算）`]),
      `②层写入 · 上联端口 #3 已用 3,200M → 3,250M`,
      `档案页 R1/R3/R4 的蓝色实时区已同步更新（只读展示，无人工写入口）`,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bound, r1, r3, pairs, form.cpeN, form.cpeMode, expanded]);

  return (
    <ArcoShell breadcrumb="开通工单详情">
      {/* 步骤条 */}
      <div className="flex items-center gap-3 overflow-x-auto border-b border-[#E5E6EB] bg-white px-6 py-2">
        <Link to="/delivery" className="shrink-0 text-xs text-[#165DFF] hover:underline">← 返回工单列表</Link>
        <span className="font-mono text-[13px] text-[#1D2129]">{wo.id}</span>
        <Badge className={stepDone ? "bg-[#E8F8F2] text-[#00B42A] hover:bg-[#E8F8F2]" : "bg-[#E8F3FF] text-[#165DFF] hover:bg-[#E8F3FF]"}>{stepDone ? "已开通" : STEP_NAMES[Math.min(step, 6)]}</Badge>
        <div className="ml-auto flex gap-1">
          {STEP_NAMES.map((n, i) => (
            <span key={n} title={n} className={`flex shrink-0 items-center gap-1 rounded-[2px] px-2 py-0.5 text-[11px] ${i < step ? "bg-[#E8F8F2] text-[#00B42A]" : i === step && !stepDone ? "bg-[#165DFF] text-white" : "bg-[#F2F3F5] text-[#86909C]"}`}>
              {i < step ? "✓" : i + 1}{n}
            </span>
          ))}
        </div>
      </div>

      <main className="space-y-4 p-6">
        <section className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 text-sm ">
          <div className="grid gap-x-8 gap-y-2 md:grid-cols-5">
            <div><div className="text-xs text-[#86909C]">客户 / 合同</div><div className="font-medium">{wo.customer} · {wo.contract}</div></div>
            <div><div className="text-xs text-[#86909C]">关联核算单</div><div className="font-mono font-medium">{wo.sheetId}（已通过）</div></div>
            <div><div className="text-xs text-[#86909C]">开通对象</div><div className="font-medium">{wo.line}</div></div>
            <div><div className="text-xs text-[#86909C]">负责人</div><div className="font-medium">{wo.assignee}</div></div>
            <div><div className="text-xs text-[#86909C]">要求完成</div><div className="font-medium text-[#FF7D00]">{wo.deadline}</div></div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {/* 步骤 0：可用性检查（系统自动判定 + 未满足项按类型处理 + 人工确认） */}
            {step === 0 && (
              <section className="rounded-[4px] border border-[#E5E6EB] bg-white ">
                <div className="border-b px-4 py-2.5 text-sm font-semibold">① 资源可用性检查</div>

                {/* A. 系统自动检查 */}
                <table className="w-full text-xs">
                  <thead><tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]"><th className="px-3 py-2">检查项</th><th className="px-3 py-2">校验规则（系统自动判断）</th><th className="px-3 py-2">可用余量</th><th className="px-3 py-2">本单需求</th><th className="px-3 py-2">结果</th></tr></thead>
                  <tbody>
                    {checks.map((c) => (
                      <tr key={c.name} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium text-[#1D2129]">{c.name}</td>
                        <td className="px-3 py-2 text-[#4E5969]">{c.rule}</td>
                        <td className="px-3 py-2">
                          {c.type === "manual" ? <span className="text-[#4E5969]">{c.dataText}</span> : (
                            <span className="font-mono">{fmt(c.free ?? 0)} {c.unit}{c.freeNote ? <span className="text-[#86909C]">（{c.freeNote}）</span> : null}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono">{c.type === "auto" ? `${fmt(c.need ?? 0)} ${c.unit}` : "—"}</td>
                        <td className="px-3 py-2">
                          {c.type === "manual" ? (
                            <select className={`rounded-[2px] border px-2 py-1 ${verdicts[c.key.split(":")[1]] === "ok" ? "border-[#00B42A] bg-[#E8F8F2] text-[#00B42A]" : verdicts[c.key.split(":")[1]] === "full" ? "border-[#F53F3F] bg-[#FFECE8] text-[#F53F3F]" : "border-[#E5E6EB] bg-white text-[#4E5969]"}`}
                              value={verdicts[c.key.split(":")[1]] ?? ""} onChange={(e) => setVerdicts((v) => ({ ...v, [c.key.split(":")[1]]: e.target.value as "" | "ok" | "full" }))}>
                              <option value="">待评估…</option>
                              <option value="ok">负载正常，可承接</option>
                              <option value="full">负载饱和，不可承接</option>
                            </select>
                          ) : (c.free ?? 0) >= (c.need ?? 0) ? <span className="text-[#00B42A]">✓ 满足</span> : <span className="font-medium text-[#F53F3F]">✗ 不足</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {allPass ? (
                  <div className="border-t-2 border-[#7BD9A8] bg-[#E8F8F2] px-4 py-2 text-xs font-medium text-[#00B42A]">✓ 检查通过：全部出口负载评估可承接，定量检查项全部满足</div>
                ) : (
                  <div className="border-t-2 border-[#FBACA3] bg-[#FFECE8] px-4 py-2 text-xs font-medium text-[#F53F3F]">
                    ✗ {lineBlocked && fullLines.length > 0 ? `出口负载饱和（${fullLines.join("、")}），` : lineBlocked ? "存在出口负载待评估，" : ""}{failed.length > 0 ? `${failed.length} 项定量检查未通过，` : ""}处理完成后进入资源分配
                  </div>
                )}
                {/* 按单采购生成的采购申请（不受未满足项消失影响，持续展示） */}
                {poReq && (
                  <div className="space-y-1 border-t border-[#BEDAFF] bg-[#E8F3FF] px-4 py-2.5 text-xs text-[#0E42D2]">
                    <div className="font-medium">✓ 采购需求单 {poReq.id} 已生成，并推送采购模块（P08-1）<Link to="/purchase/reqs" className="ml-1 underline">查看采购需求</Link></div>
                    <div className="text-[#4E5969]">物料：{poReq.name} × {poReq.qty} 台 · 参考单价 {fmt(poReq.price)} 元 · 供应商 {poReq.supplier}。本工单状态置「待设备」：设备到货入库后出库直发客户现场，工单自动恢复开通流程；采购成本按一次性成本计入本单核算。</div>
                  </div>
                )}

                {/* B. 未满足项处理（按条目类型给出标准处理方式） */}
                {(failed.length > 0 || fullLines.length > 0) && (
                  <div className="space-y-3 border-t px-4 py-3">
                    <div className="text-xs font-semibold text-[#4E5969]">未满足项处理</div>

                    {failed.some((c) => c.key === "cpe") && (
                      <div className="space-y-2 rounded-[2px] border border-[#FFCF8B] bg-[#FFF7E8] p-3 text-xs">
                        <div className="font-semibold text-[#D25F00]">CPE 库存不足：{cpe.name} 可用 {cpe.dynamic.stock - cpe.dynamic.locked} 台，需求 {form.cpeN} 台。处理方式：</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => {
                            setForm((v) => ({ ...v, cpeMode: "按单采购（P08）" }));
                            // 同步生成 P08-1 采购需求（资源不足联动）：已存在本工单的联动需求则复用
                            const exist = getReqs().find((r) => r.linkedWo === wo.id);
                            const req = exist ?? addReq({
                              source: "资源不足联动", type: "设备", spec: cpe.name, qty: form.cpeN, unit: "台",
                              room: "上海漕河泾", expectDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
                              note: "工单可用性检查：CPE 在库不足，改按单采购", linkedWo: wo.id, createdBy: "系统（工单挂起联动）",
                            });
                            setPoReq({ id: req.reqNo, name: cpe.name, qty: form.cpeN, price: cpe.costPrice, supplier: cpe.supplier });
                          }}>① 改为按单采购（自动生成采购申请 → P08-1，不占库存）</Button>
                          {altCpes.length > 0 && (
                            <>
                              <span>② 更换有库存型号：</span>
                              <select className="rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1" value={altCpe} onChange={(e) => setAltCpe(e.target.value)}>
                                <option value="">请选择…</option>
                                {altCpes.map((r) => <option key={r.id} value={r.id}>{r.id} {r.name}（可用 {r.dynamic.stock - r.dynamic.locked} 台）</option>)}
                              </select>
                              <Button size="sm" variant="outline" disabled={!altCpe} onClick={() => setForm((v) => ({ ...v, cpe: altCpe }))}>更换</Button>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {fullLines.map((lid) => {
                      const pool = lineOf(lid);
                      const peakM = pool.dynamic.peakM ?? 0;
                      const ut = utilOf(lid);
                      const idx = pairs.findIndex((p) => p.line === lid);
                      const cands = idx >= 0 ? altCandidates(idx) : [];
                      return (
                        <div key={lid} className="space-y-2 rounded-[2px] border border-[#FFCF8B] bg-[#FFF7E8] p-3 text-xs">
                          <div className="font-semibold text-[#D25F00]">出口负载饱和：{pool.id} 近 30 日峰值流量 {fmt(peakM)}M（利用率 {ut}%），工程师评估不可承接。处理方式：</div>
                          {lid === "I-101" && !expanded && (
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2 text-[#4E5969]">
                                <span>① 发起扩容：</span>
                                <Input type="number" className="h-8 w-24 text-xs" value={expandM} onChange={(e) => setExpandM(Math.max(0, Number(e.target.value)))} />
                                <span>M</span>
                                <span className="text-[#FF7D00]">→ 扩容后 {fmt(500 + expandM)}M，池月租 {fmt(newMonthly)} 元（按采购合同价线性折算）</span>
                              </div>
                              {!expandApproved ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <Input className="h-8 w-72 text-xs" placeholder="扩容说明（为什么需要扩、预期承载哪些客户）" value={expandNote} onChange={(e) => setExpandNote(e.target.value)} />
                                  <Button size="sm" variant="outline" disabled={!expandNote.trim()} onClick={() => setExpandApproved(true)}>提交扩容申请（走审批流）</Button>
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center gap-2 text-[#D25F00]">
                                  <span>扩容申请已提交 · 审批链：资源主管 →（月增成本 &gt; 50,000 元时）财务总监</span>
                                  <Button size="sm" variant="outline" onClick={applyExpand}>演示：审批通过，执行扩容</Button>
                                </div>
                              )}
                            </div>
                          )}
                          {expanded && lid === "I-101" && <div className="text-[#00B42A]">✓ 扩容完成：I-101 池 500M → {fmt(pool101.capacityM)}M，月租 75,000 → {fmt(pool101.monthlyCost)} 元，检查表已按新容量重新计算</div>}
                          <div className="space-y-2 border-t border-[#FFCF8B] pt-2">
                            <div>② 更换出口池（随绑 IP 段一起切换）：</div>
                            {cands.length > 0 ? (
                              <div className="grid gap-2 md:grid-cols-2">
                                {cands.map(({ line: l, seg }) => (
                                  <button key={l.id} onClick={() => setAltPick({ idx, lineId: l.id })}
                                    className={`rounded-[2px] border p-3 text-left text-xs ${altPick?.idx === idx && altPick.lineId === l.id ? "border-[#165DFF] bg-[#E8F3FF]" : "border-[#E5E6EB] bg-white"}`}>
                                    <div className="font-medium text-[#1D2129]">{l.id} · {l.name.split("（")[0]}</div>
                                    <div className="mt-1 text-[#4E5969]">近 30 日峰值 <span className={`font-mono ${(l.dynamic.peakM ?? 0) / l.capacityM < 0.7 ? "text-[#00B42A]" : "text-[#F53F3F]"}`}>{fmt(l.dynamic.peakM ?? 0)}M / {fmt(l.capacityM)}M（{Math.round(((l.dynamic.peakM ?? 0) / l.capacityM) * 100)}%）</span> · 绑定 IP 段 {seg.segment.split("（")[0]}（余 {seg.total - seg.dynamic.allocated} 个）</div>
                                  </button>
                                ))}
                              </div>
                            ) : <div className="text-[#F53F3F]">无其他可用出口（全部被本单占用或无满足余量的绑定 IP 段）</div>}
                            {altPick?.idx === idx && (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => applyAlt(idx, altPick.lineId)}>确认更换</Button>
                                <Button size="sm" variant="ghost" onClick={() => setAltPick(null)}>再想想</Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {failedPairs.map(({ p, i }) => {
                      const cands = altCandidates(i);
                      return (
                        <div key={`ip-${i}`} className="space-y-2 rounded-[2px] border border-[#FFCF8B] bg-[#FFF7E8] p-3 text-xs">
                          <div className="font-semibold text-[#D25F00]">IP 段余量不足：{ipOf(p.ip).segment.split("（")[0]}（出口 {p.line}）余 {ipOf(p.ip).total - ipOf(p.ip).dynamic.allocated} 个，需求 {p.ipN} 个。处理方式：</div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span>① 调整本单数量（至步骤②修改）；② 更换出口池（随绑 IP 段一起切换）：</span>
                            {cands.length > 0 ? (
                              <>
                                <select className="rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1" value={altPick?.idx === i ? altPick.lineId : ""} onChange={(e) => setAltPick({ idx: i, lineId: e.target.value })}>
                                  <option value="">请选择…</option>
                                  {cands.map(({ line: l, seg }) => <option key={l.id} value={l.id}>{l.id} {l.name.split("（")[0]} · {seg.segment.split("（")[0]}（余 {seg.total - seg.dynamic.allocated} 个）</option>)}
                                </select>
                                <Button size="sm" variant="outline" disabled={!(altPick?.idx === i && altPick.lineId)} onClick={() => altPick && applyAlt(i, altPick.lineId)}>切换</Button>
                              </>
                            ) : <span className="text-[#F53F3F]">无其他可用出口</span>}
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex flex-wrap items-center gap-2 border-t border-[#E5E6EB] pt-3">
                      <span className="text-xs text-[#4E5969]">现有处理方式都不合适，或不急于开通？</span>
                      <Button size="sm" variant="ghost" onClick={() => setSuspended(true)}>挂起工单，一键生成采购需求（→ P08-1）</Button>
                    </div>
                    {suspended && (() => {
                      const resumed = woResumedByPurchase(wo.id);
                      return resumed ? (
                        <div className="space-y-2 rounded-[2px] border border-[#00B42A]/40 bg-[#E8F8F2] p-3 text-xs text-[#00B42A]">
                          <div>✓ 采购 {resumed.poNo} 已到货入库（{resumed.inboundAt}）：设备已入 R4 库存，可直接出库直发现场。</div>
                          <Button size="sm" className="bg-[#00B42A] hover:bg-[#00B42A]/90" onClick={() => { setSuspended(false); }}>恢复开通流程</Button>
                        </div>
                      ) : (
                        <div className="rounded-[2px] border border-[#BEDAFF] bg-[#E8F3FF] p-3 text-xs text-[#0E42D2]">
                          ✓ 工单已挂起：不满足项已生成采购需求并推送采购模块（<Link to="/purchase/reqs" className="underline">P08-1 采购需求</Link>）；采购单走完「到货验收 → 入库建档」后，系统自动反向通知本工单恢复开通。
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* C. 提交 */}
                <div className="flex flex-wrap items-center gap-3 border-t px-4 py-3">
                  <Button size="sm" disabled={!allPass} onClick={() => setStep(1)}>提交检查结论，进入资源分配 →</Button>
                  {!allPass && <span className="text-xs text-[#F53F3F]">{lineBlocked ? "存在出口负载未评估为可承接；" : ""}{failed.length > 0 ? "存在未满足项，处理完成后系统自动重新校验" : ""}</span>}
                  <span className="text-xs text-[#86909C]">检查结论与处理动作全部留痕，审批页可回看</span>
                </div>
              </section>
            )}

            {/* 步骤 1：资源分配申请 */}
            {step === 1 && (
              <section className="rounded-[4px] border border-[#E5E6EB] bg-white ">
                <div className="border-b px-4 py-2.5 text-sm font-semibold">② 资源分配申请（从资源中心档案选择，实时校验余量）</div>
                <div className="space-y-4 p-4">
                  {/* 线路资源：多对「出口 + IP 段」 */}
                  <div>
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-[#86909C]">出口线路与绑定 IP 段（本单 {pairs.length} 对，可增删）</span>
                    </div>
                    <div className="space-y-2">
                      {pairs.map((p, i) => {
                        const c = calcs[i];
                        return (
                          <div key={i} className="rounded-[2px] border border-[#E5E6EB] p-3">
                            <div className="grid gap-3 md:grid-cols-[1.2fr_1.2fr_1fr_0.6fr_auto]">
                              <div>
                                <div className="mb-0.5 text-xs text-[#4E5969]">出口线路（R1 档案）</div>
                                <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-xs" value={p.line} onChange={(e) => changePairLine(i, e.target.value)}>
                                  {r1.map((r) => <option key={r.id} value={r.id}>{r.id} {r.name.split("（")[0]}（余 {fmt(r.capacityM - r.dynamic.usedM)}M）</option>)}
                                </select>
                              </div>
                              <div>
                                <div className="mb-0.5 text-xs text-[#4E5969]">绑定 IP 段（R3，随出口联动）</div>
                                <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-xs" value={p.ip}
                                  onChange={(e) => { const seg = ipOf(e.target.value); setPairs((ps) => ps.map((x, j) => (j === i ? { ...x, ip: e.target.value, ipStart: `${segPrefix(seg.segment)}.200` } : x))); }}>
                                  {r3.filter((r) => (r.boundLines ?? []).includes(p.line)).map((r) => <option key={r.id} value={r.id}>{r.id} {r.segment}（余 {r.total - r.dynamic.allocated} 个）</option>)}
                                </select>
                              </div>
                              <div>
                                <div className="mb-0.5 text-xs text-[#4E5969]">本单起始地址</div>
                                <Input className="h-8 font-mono text-xs" value={p.ipStart} onChange={(e) => setPairs((ps) => ps.map((x, j) => (j === i ? { ...x, ipStart: e.target.value.trim() } : x)))} />
                              </div>
                              <div>
                                <div className="mb-0.5 text-xs text-[#4E5969]">数量（默认 = 订单需求）</div>
                                <Input type="number" min={1} className="h-8 text-xs" value={p.ipN} onChange={(e) => setPairs((ps) => ps.map((x, j) => (j === i ? { ...x, ipN: Math.max(1, Number(e.target.value)) } : x)))} />
                              </div>
                              <div className="flex items-end">
                                <Button size="sm" variant="ghost" className="text-[#F53F3F]" disabled={pairs.length <= 1} onClick={() => setPairs((ps) => ps.filter((_, j) => j !== i))}>✕ 删除</Button>
                              </div>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                              <span className="text-[#4E5969]">自动分配：<span className="font-mono font-medium text-[#165DFF]">{c.rangeText}</span></span>
                              {!c.startValid && <span className="text-[#F53F3F]">起始地址不属于所选段（应为 {c.prefix}.x）</span>}
                              {c.startValid && !Number.isNaN(c.endN) && c.endN > 254 && <span className="text-[#F53F3F]">超出可用范围（最大到 {c.prefix}.254）</span>}
                              {c.conflict && <span className="text-[#F53F3F]">与已占用区间冲突：{c.conflict.start}–{c.conflict.end}（{c.conflict.customer}）</span>}
                              {c.valid && <span className="text-[#00B42A]">✓ 地址区间校验通过</span>}
                              {c.over && <span className="text-[#F53F3F]">数量超段内余量（余 {c.row.total - c.row.dynamic.allocated} 个）</span>}
                            </div>
                          </div>
                        );
                      })}
                      <Button size="sm" variant="outline" onClick={addPair} disabled={!r1.some((l) => !usedLines.includes(l.id) && segOfLine(l.id))}>＋ 添加出口线路（一对出口 + IP 段）</Button>
                    </div>
                  </div>
                  {/* 基础线路与 CPE */}
                  <div>
                    <div className="mb-1.5 text-[11px] font-semibold text-[#86909C]">基础线路与 CPE</div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <div>
                        <div className="mb-0.5 text-xs text-[#4E5969]">基础线路（R2 档案，可多选）</div>
                        <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-xs" value={form.base} onChange={(e) => setForm((v) => ({ ...v, base: e.target.value }))}>
                          {R2_ROWS.map((r) => <option key={r.id} value={r.id}>{r.id} {r.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="mb-0.5 text-xs text-[#4E5969]">CPE 设备型号（R4 库存）</div>
                        <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-xs" value={form.cpe} onChange={(e) => setForm((v) => ({ ...v, cpe: e.target.value }))}>
                          {r4.map((r) => <option key={r.id} value={r.id}>{r.id} {r.name}（可用 {r.dynamic.stock - r.dynamic.locked} 台）</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="mb-0.5 text-xs text-[#4E5969]">供给方式</div>
                        <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-xs" value={form.cpeMode} onChange={(e) => setForm((v) => ({ ...v, cpeMode: e.target.value }))}>
                          {["库存直绑（P02）", "按单采购（P08）"].map((o) => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="mb-0.5 text-xs text-[#4E5969]">CPE 数量（默认 = 订单需求）</div>
                        <Input type="number" min={1} className="h-8 text-xs" value={form.cpeN} onChange={(e) => setForm((v) => ({ ...v, cpeN: Math.max(1, Number(e.target.value)) }))} />
                      </div>
                    </div>
                    {form.cpeMode === "按单采购（P08）" && <div className="mt-1.5 text-[11px] text-[#FF7D00]">按单采购不占库存：提交后生成采购需求（P08-1），到货直发客户现场</div>}
                  </div>
                </div>
                <div className="border-t px-4 py-3">
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    <span className="text-xs font-semibold text-[#4E5969]">技术参数区</span>
                    <select className="rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1 text-xs" value={cat}
                      onChange={(e) => { setCat(e.target.value); setTechVals({}); }}>
                      {CATS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <span className="text-[11px] text-[#86909C]">{CAT_DESC[cat]} · 正式环境由订单行产品类别自动带入，此处仅供预览 · 填写进度 {techFields.filter((f) => (techVals[f.label] ?? "").trim()).length}/{techFields.length}</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {techFields.map((f) => (
                      <div key={f.label}>
                        <div className="mb-0.5 flex items-center gap-1.5 text-xs text-[#4E5969]">
                          <span>{f.label}{f.unit ? `（${f.unit}）` : ""}</span>
                        </div>
                        {f.method === "enum" ? (
                          <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-xs" value={techVals[f.label] ?? ""} onChange={(e) => setTech(f.label, e.target.value)}>
                            <option value="">请选择…</option>
                            {(f.options ?? []).map((o) => <option key={o}>{o}</option>)}
                          </select>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Input className="h-8 text-xs" placeholder={f.placeholder ?? ""} value={techVals[f.label] ?? ""} onChange={(e) => setTech(f.label, e.target.value)} />
                            {f.unit && <span className="shrink-0 text-[11px] text-[#86909C]">{f.unit}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 border-t px-4 py-3">
                  <Button size="sm" variant="outline" onClick={() => setStep(0)}>← 返回可用性检查</Button>
                  <Button size="sm" disabled={ipOverAny || cpeOver || !techDone || !ipAllValid} onClick={() => setStep(2)}>提交分配申请</Button>
                  {ipOverAny && <span className="text-xs text-[#F53F3F]">存在 IP 分配数量超段内余量，禁止提交</span>}
                  {cpeOver && <span className="text-xs text-[#F53F3F]">{cpe.name} 库存可用 {cpe.dynamic.stock - cpe.dynamic.locked} 台，需求 {form.cpeN} 台：请调整数量、更换型号，或改按单采购</span>}
                  {!ipAllValid && !ipOverAny && <span className="text-xs text-[#F53F3F]">存在未通过校验的 IP 地址区间</span>}
                  {!techDone && <span className="text-xs text-[#FF7D00]">技术参数未填全（{techFields.filter((f) => (techVals[f.label] ?? "").trim()).length}/{techFields.length}），暂不可提交</span>}
                  <span className="text-xs text-[#86909C]">与成本核算已选资源不一致时触发异常校验（P01-8）</span>
                </div>
              </section>
            )}

            {/* 步骤 2：分配审批 */}
            {step === 2 && (
              <section className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 ">
                <div className="mb-2 text-sm font-semibold">③ 资源分配审批（审批流可配置：当前 = 资源主管）</div>
                <div className="rounded-[2px] bg-[#F7F8FA] p-3 text-xs leading-5 text-[#4E5969]">
                  申请内容：出口 {usedLines.join(" + ")}（各 50M）· IP {pairs.map((p, i) => `${ipOf(p.ip).segment.split("（")[0]} ${calcs[i].rangeText}`).join("；")} · 基础线路 {form.base} · CPE {form.cpe} × {form.cpeN} 台（{form.cpeMode}）<br />
                  技术参数（{cat}）：{techFields.length} 项已填全 · 申请人：{wo.assignee} · 可用性检查：{checkSummary ? checkSummary : "系统预检通过"}
                  {expanded && <><br />关联记录：本单前置触发 I-101 扩容 {fmt(expandM)}M（500M → {fmt(pool101.capacityM)}M），扩容后成本核算口径不变、池维度月报按新月租归集</>}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setStep(1)}>← 返回修改申请</Button>
                  <Button size="sm" disabled={approved} onClick={() => { setApproved(true); setStep(3); }}>资源主管通过</Button>
                  <Button size="sm" variant="outline" className="text-[#F53F3F]" onClick={() => alert("原型演示：驳回后退回「资源分配申请」，申请人修改后重新提交（流转记录留痕）")}>驳回</Button>
                </div>
              </section>
            )}

            {/* 步骤 3：绑定扣减 */}
            {step === 3 && (
              <section className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 ">
                <div className="mb-2 text-sm font-semibold">④ 资源绑定与扣减（系统执行，②层数据在此刻写入）</div>
                {!bound ? (
                  <Button size="sm" onClick={bind}>执行绑定与扣减</Button>
                ) : (
                  <div className="space-y-1.5">
                    {logs.map((l) => <div key={l} className="rounded-[2px] border border-[#BEDAFF] bg-[#E8F3FF] px-3 py-1.5 font-mono text-[11px] text-[#165DFF]">{l}</div>)}
                    <div className="pt-2"><Button size="sm" onClick={() => setStep(4)}>进入开通实施 →</Button></div>
                  </div>
                )}
              </section>
            )}

            {/* 步骤 4：实施 */}
            {step === 4 && (
              <section className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 ">
                <div className="mb-2 text-sm font-semibold">⑤ 开通实施（现场作业清单）</div>
                <div className="space-y-2">
                  {tasks.map((t, i) => (
                    <label key={t.t} className="flex items-center gap-2 text-sm text-[#4E5969]">
                      <input type="checkbox" checked={t.done} onChange={(e) => setTasks((ts) => ts.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))} />
                      {t.t}
                    </label>
                  ))}
                </div>
                <div className="mt-3"><Button size="sm" disabled={!tasksAll} onClick={() => setStep(5)}>实施完成，提交开通确认 →</Button></div>
              </section>
            )}

            {/* 步骤 5：开通确认 */}
            {step === 5 && (
              <section className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 ">
                <div className="mb-2 text-sm font-semibold">⑥ 开通确认（计费起点依据）</div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-[#4E5969]">开通确认日期：</span>
                  <Input type="date" className="h-8 w-40 text-xs" value={openDate} onChange={(e) => setOpenDate(e.target.value)} />
                </div>
                <div className="mt-3"><Button size="sm" disabled={confirmed} onClick={() => { setConfirmed(true); setStep(6); }}>确认开通</Button></div>
              </section>
            )}

            {/* 步骤 6：激活计费 */}
            {step === 6 && !done && (
              <section className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 ">
                <div className="mb-2 text-sm font-semibold">⑦ 激活计费（系统自动）</div>
                <div className="grid gap-3 text-xs md:grid-cols-3">
                  <div className="rounded-[2px] bg-[#F7F8FA] p-3"><div className="text-[#86909C]">计费起点</div><div className="font-mono font-medium">{openDate}</div></div>
                  <div className="rounded-[2px] bg-[#F7F8FA] p-3"><div className="text-[#86909C]">首账期（按开通日滚动）</div><div className="font-mono font-medium">{openDate} – {periodEnd(openDate)}</div></div>
                  <div className="rounded-[2px] bg-[#F7F8FA] p-3"><div className="text-[#86909C]">月成本（周期性条目）</div><div className="font-mono font-medium">12,316 元/月</div></div>
                </div>
                <div className="mt-3"><Button size="sm" onClick={() => setDone(true)}>完成 · 工单关闭</Button></div>
              </section>
            )}
            {done && (
              <section className="rounded-[4px] border border-[#7BD9A8] bg-[#E8F8F2] p-4 text-sm text-[#00B42A] ">
                ✓ 工单已关闭：资源绑定完成、计费已激活。进入 P03 账单流程（首账期 {openDate} – {periodEnd(openDate)}，按开通日滚动）。
              </section>
            )}
          </div>

          {/* 右侧：②层实时数据（绑定扣减及之后才有"写入结果"可展示） */}
          <aside className="space-y-3">
            {step < 3 && (
              <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 text-xs leading-5 text-[#4E5969] ">
                <span className="font-semibold text-[#4E5969]">数据口径说明</span>
                <div className="mt-1">检查表中的余量数值取自②层实时数据（由订单、库存等单据生成，任何页面无人工写入口）。资源分配审批通过后预选锁定；「绑定扣减」执行时正式写入，届时此处展示写入后的②层数据。</div>
              </div>
            )}
            {step >= 3 && (
            <div className="rounded-[4px] border border-[#BEDAFF] bg-white p-4 ">
              <div className="mb-2 text-sm font-semibold text-[#165DFF]">②层实时数据（只读，由单据生成）</div>
              <div className="space-y-3 text-xs">
                {usedLines.map((lid) => {
                  const p = lineOf(lid);
                  return (
                    <div key={lid}>
                      <div className="mb-1 flex justify-between text-[#4E5969]"><span>{lid} 已售带宽（池 {fmt(p.capacityM)}M）</span><span className="font-mono">{fmt(p.dynamic.usedM)} / {fmt(p.capacityM)} M</span></div>
                      <div className="h-2 overflow-hidden rounded-[2px] bg-[#F2F3F5]"><div className="h-full bg-[#165DFF] transition-all" style={{ width: `${(p.dynamic.usedM / p.capacityM) * 100}%` }} /></div>
                    </div>
                  );
                })}
                <div className="space-y-1">
                  {pairs.map((p, i) => (
                    <div key={i} className="flex justify-between text-[#4E5969]"><span>{ipOf(p.ip).segment.split("（")[0]} 已分配（本单 {calcs[i].rangeText}）</span><span className="font-mono">{ipOf(p.ip).dynamic.allocated} / {ipOf(p.ip).total} 个</span></div>
                  ))}
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-[#4E5969]"><span>{cpe.name} 现存量</span><span className="font-mono">{cpe.dynamic.stock} 台（锁定 {cpe.dynamic.locked}）</span></div>
                  <div className="h-2 overflow-hidden rounded-[2px] bg-[#F2F3F5]"><div className="h-full bg-[#FF7D00] transition-all" style={{ width: `${(cpe.dynamic.stock / 5) * 100}%` }} /></div>
                </div>
                <div className="rounded-[2px] bg-[#E8F3FF] px-2 py-1.5 leading-4 text-[#165DFF]">
                  审批通过（P01-6）起资源预选锁定；本页"绑定扣减"完成后正式占用。任何页面不可手工改这些数字。
                </div>
              </div>
            </div>
            )}
            <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4 text-xs leading-5 text-[#4E5969] ">
              <span className="font-semibold text-[#4E5969]">流转记录</span>
              <ol className="mt-1 space-y-1.5">
                <li>· 核算审批通过 → 自动生成工单（系统）</li>
                {step >= 1 && <li>· 可用性检查：{checkSummary ? checkSummary : "系统预检通过"}（{wo.assignee}）</li>}
                {step >= 3 && <li>· 分配申请已提交 → 资源主管通过</li>}
                {bound && <li>· 绑定扣减执行完成（②层已写入）</li>}
                {step >= 5 && <li>· 实施完成，提交开通确认</li>}
                {confirmed && <li>· 开通确认：{openDate}</li>}
                {done && <li>· 计费激活，工单关闭</li>}
              </ol>
            </div>
          </aside>
        </div>
      </main>
    </ArcoShell>
  );
}
