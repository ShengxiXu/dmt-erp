import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams, Link } from "react-router";
import {
  CATEGORIES,
  RESOURCE_TAGS,
  SUBJECTS,
  SOURCES,
  type CatalogItem,
  type SourceRow,
} from "@/data/catalog";
import { getCostItems, useCostItems, SETTLE_RULE, uncoveredClasses, type CostItem } from "@/data/costItems";
import { GET_TYPE, MAT_DEF, useCatalog } from "@/data/products";
import { CONTRACTS, type Contract } from "@/data/contracts";
import { snapshotEsts, usePoolSettle, type PoolEst } from "@/data/poolSettle";
import { SHEETS, SHEET_OF_CONTRACT, ensureSheetForContract, fillSheet, recordSheetEntries } from "@/data/sheets";
import { submitForApproval } from "@/data/approvalFlow";
import { currentUser } from "@/data/users";
import ArchivePicker from "@/components/SearchSelect";
import ArcoShell from "@/components/ArcoShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const fmt = (n: number) => n.toLocaleString("zh-CN", { maximumFractionDigits: 1 });

/** 各类条目的金额计算：qty=手工输入，meta=档案带出值，lines=枚举条数，picked=单选档案行；pickedList=出口资源多选 */
function calcAmount(item: CatalogItem, qty: number, meta: number, picked?: SourceRow | null, pickedList?: SourceRow[], sharedIds?: string[]) {
  switch (item.demo) {
    case "bwbase": {
      if (!pickedList?.length) return { text: "选择基础线路后自动计算（可多选，数量不限）", v: 0 };
      const parts = pickedList.map((r) =>
        sharedIds?.includes(r.id)
          ? { t: `${r.id} 共用（成本计于他行）`, v: 0 }
          : { t: `${r.id} ${qty} 条 × 整线月租 ${fmt(Number(r.meta || 0))}`, v: qty * Number(r.meta || 0) });
      return { text: parts.map((pp) => pp.t).join(" + "), v: parts.reduce((a2, pp) => a2 + pp.v, 0) };
    }
    case "bwinternet": {
      if (!pickedList?.length) return { text: "选择出口资源后自动计算（支持多选：一单可含多条线路）", v: 0 };
      // 产品类型级池化：按归属产品类型分组，同池多条只计一次
      // 边际计价（录入决策口径）：本单成本 = 产品类型出口月租合计 ÷（该产品类型已售带宽合计 + 本单带宽）× 本单带宽
      // ——回答「新增这一单要花多少钱」；月结则按平均分摊（池成本 ÷ 已售带宽）做实际归属，两者分工见页底说明
      const groups = new Map<string, SourceRow[]>();
      pickedList.forEach((r) => {
        const g = groups.get(r.ptag ?? "") ?? [];
        g.push(r);
        groups.set(r.ptag ?? "", g);
      });
      const parts = Array.from(groups.entries()).map(([ptag, rs]) => {
        const poolRows = SOURCES.lineinternet.rows.filter((r) => r.ptag === ptag);
        const costSum = poolRows.reduce((s2, r) => s2 + Number(r.meta || 0), 0);
        const soldSum = poolRows.reduce((s2, r) => s2 + (r.pool?.usedM ?? 0), 0);
        const sold = soldSum + qty;
        const v = sold > 0 ? (costSum / sold) * qty : 0;
        const ids = rs.map((r) => r.id).join("+");
        return { t: `${ptag}池（${ids}）${fmt(costSum)}÷${fmt(sold)}×${qty} = ${fmt(v)}`, v };
      });
      return { text: parts.map((pp) => pp.t).join(" + ") + "　· 签单预估（边际成本口径），月结按平均分摊重算", v: parts.reduce((a2, pp) => a2 + pp.v, 0) };
    }
    case "resale": return picked
      ? { text: `${qty} × ${fmt(meta || 0)}（转售采购价直接结转，不加成）`, v: qty * (meta || 0) }
      : { text: "选择转售采购合同后自动计算", v: 0 };
    case "wave": return { text: "条目已取消：波道/管道成本并入基础线路条目（2026-10-21）", v: 0 };
    case "device": return { text: `${qty} 台 × ${fmt(meta || 4500)} 元`, v: qty * (meta || 4500) };
    case "cabinet": return { text: `${qty}U ÷ 42U × ${fmt(meta || 5000)} 元`, v: (qty / 42) * (meta || 5000) };
    case "ippool": return qty > 0
      ? { text: `${fmt(meta || 39)} 元/个·月 × 本单分配 ${qty} 个（默认 = 合同需求，可调整）`, v: (meta || 39) * qty }
      : { text: "以出口线路为条件查询绑定 IP，选中后自动计算", v: 0 };
    case "service": return { text: meta ? `按订阅价格` : "", v: meta || 0 };
    case "manday": return { text: `${qty} 人天 × ${fmt(meta || 800)} 元/人天`, v: qty * (meta || 800) };
    case "port": return { text: `${fmt(meta || 8000)} × ${qty}M ÷ 10,000M`, v: ((meta || 8000) * qty) / 10000 };
    case "otu": return { text: `${qty} 个 × ${fmt(meta || 500)} 元/端口·月`, v: qty * (meta || 500) };
    case "bgpplat": return { text: `600,000 ÷ 12 × ${qty}M ÷ 2,000M`, v: (600000 / 12) * (qty / 2000) };
    case "maintain": return { text: `120,000 ÷ 12 ÷ ${qty || 50} 端口`, v: 120000 / 12 / (qty || 50) };
    case "asset": return { text: `60,000 ÷ 36 个月`, v: 60000 / 36 };
    case "material": return { text: `${qty} 个 × ${fmt(meta || 400)} 元`, v: qty * (meta || 400) };
    case "share200": return { text: `120,000 ÷ 12 ÷ 200 户`, v: 50 };
    case "share40": return { text: `120,000 ÷ 12 ÷ 40 节点`, v: 250 };
    case "sla": return { text: `${fmt(qty || 1000)} × 20%`, v: (qty || 1000) * 0.2 };
    default: return { text: "", v: qty };
  }
}

const DEFAULT_QTY: Record<string, number > = {
  bwbase: 50, bwinternet: 50, resale: 100, device: 2, cabinet: 10, ippool: 1,
  manday: 4, port: 100, otu: 2, bgpplat: 50, maintain: 50, material: 2,
  sla: 1000, plain800: 800, plain1500: 1500, plain300: 300, plain250: 250,
};

function qtyField(item: CatalogItem): { label: string; unit: string } | null {
  const m: Record<string, { label: string; unit: string }> = {
    bwbase: { label: "订单带宽", unit: "M" },
    bwinternet: { label: "订单带宽", unit: "M" },
    resale: { label: "采购数量", unit: "M / 对" },
    device: { label: "设备数量", unit: "台" },
    cabinet: { label: "占用 U 位", unit: "U" },
    ippool: { label: "占用 IP 数", unit: "个" },
    manday: { label: "实施工时", unit: "人天" },
    port: { label: "本单带宽", unit: "M" },
    otu: { label: "占用端口", unit: "个" },
    bgpplat: { label: "本单出口带宽", unit: "M" },
    maintain: { label: "计费端口总数", unit: "个" },
    material: { label: "领用数量", unit: "个" },
    sla: { label: "常规端口费", unit: "元/月" },
  };
  if (item.demo.startsWith("plain")) return { label: "金额", unit: "元" };
  return m[item.demo] ?? null;
}

function enumOptions(item: CatalogItem): string[] {
  switch (item.demo) {
    case "device": return ["库存直绑（P02）", "按单采购（P08）"];
    case "cabinet": return ["按 U 位计费", "按电力计费"];
    case "service": return ["DDoS 清洗（一对一）", "WAF（一对多年订阅）"];
    case "maintain": return ["按端口计费", "按带宽计费"];
    default: return [];
  }
}

// ---------- 模块级金额暂存（key = item.key） ----------
const amountStore: Record<string, number | null > = {};
/** 每行填报的数量（key = 行键，如 L1::op1b）：提交审批时锁存出口池预估快照用 */
const bwStore: Record<string, number> = {};
/** 每行条目的展示留痕（key = 行键）：提交审批时写入该核算单的条目快照，供审批详情按单展示 */
const entryInfoStore: Record<string, { name: string; dept: "业务支撑部" | "技术部"; note: string }> = {};

/** 每行已选定的出口线路（key = 订单行 id，可多选）：作为「绑定 IP 地址」条目的查询条件（IP 与线路绑定） */
const internetPickStore: Record<string, SourceRow[]> = {};
/** 每行已关联的基础线路（key = 订单行 id，可多选）：供其他行（如数据专线）【共用】 */
const basePickStore: Record<string, SourceRow[]> = {};

function EntryRow({
  item, rowKey, slotCarrier, locked, stale, onRemove, onAmount, internetRows, onPickInternets, ipFreeSearch, ipNeed, baseOthers, onPickBases, linePtype,
}: {
  item: CatalogItem;
  /** 行唯一键：含资源位后缀（如 op1|电信），同一条目可因模板展开多个资源位 */
  rowKey: string;
  /** 资源位运营商（直连双线模板展开时）：过滤档案选择 + 行内标识 */
  slotCarrier?: string;
  locked: boolean;
  /** 条目已停用（被装配但条目库中停用）：整行灰显留档，不参与有效填报 */
  stale?: boolean;
  onRemove?: () => void;
  onAmount: (k: string, v: number | null, snap?: { name: string; dept: "业务支撑部" | "技术部"; note: string }) => void;
  /** 本行已选定的出口线路（可多选；IP 条目以此为查询条件，跨多条线路 OR 查询） */
  internetRows?: SourceRow[];
  /** 出口线路条目多选完成时上抛（按订单行记录，供 IP 条目查询） */
  onPickInternets?: (rs: SourceRow[]) => void;
  /** 本行无出口线路条目（如 BGP）：开放全量绑定 IP 搜索兜底 */
  ipFreeSearch?: boolean;
  /** 本行客户需求的 IP 地址数量（合同行带入），选中绑定 IP 后与之校验 */
  ipNeed?: number;
  /** 本行订单行 id（共用基础线路时标识来源） */
  lineId?: string;
  /** 本行订单的产品类型（合同行带入）：选资源时按它自动过滤（归属该类型 + 可共享给该类型） */
  linePtype?: string;
  /** 他行已关联的基础线路（数据专线等可共用） */
  baseOthers?: { lid: string; row: SourceRow }[];
  /** 基础线路多选完成时上抛（按订单行记录） */
  onPickBases?: (rs: SourceRow[]) => void;
}) {
  const qf = qtyField(item);
  const [qty, setQty] = useState<number>(DEFAULT_QTY[item.demo] ?? 1);
  // 本行填报数量同步到 bwStore：提交审批时锁存出口池预估快照用
  useEffect(() => { bwStore[rowKey] = qty; }, [rowKey, qty]);
  const [meta, setMeta] = useState<number>(0);
  const [pickedRow, setPickedRow] = useState<SourceRow | null>(null);
  const [pickedList, setPickedList] = useState<SourceRow[]>([]);
  const [ipAlloc, setIpAlloc] = useState<number | null>(null);
  const [sharedIds, setSharedIds] = useState<string[]>([]);
  const [enumVal, setEnumVal] = useState<string>(enumOptions(item)[0] ?? "");
  const searchSrc = item.methods.find((m) => m.kind === "search")?.source;
  /** CPE 供给方式联动档案源（2026-10-20）：库存直绑（P02）→ 设备库存；按单采购（P08）→ 采购单（采购管理） */
  const deviceSrc = item.key === "op4" && enumVal.includes("P08") ? "devicepo" : null;
  const hasText = item.methods.some((m) => m.kind === "text");
  const opts = enumOptions(item);

  /** IP 条目：本单分配数量（默认 = CRM 需求 ipNeed，选中档案后带出、可调整） */
  const effQty = item.demo === "ippool" ? (ipAlloc ?? ipNeed ?? 0) : qty;
  const calc = useMemo(
    () => calcAmount(item, effQty, meta, pickedRow, pickedList, sharedIds),
    [item, effQty, meta, pickedRow, pickedList, sharedIds]
  );
  const autoShare = ["share200", "share40", "asset"].includes(item.demo);
  const amount: number | null = useMemo(() => {
    if (item.demo.startsWith("plain") || autoShare || !searchSrc) return calc.v;
    if (item.demo === "bwinternet" || item.demo === "bwbase") return pickedList.length > 0 ? calc.v : null;
    if (item.demo === "service") return meta > 0 ? calc.v : null;
    return meta > 0 ? calc.v : null;
  }, [item.demo, calc.v, meta, searchSrc, autoShare, pickedRow, pickedList]);

  // 锁定（部门已提交）不清空金额：金额是真实成本，进度/合计/提交审批都依赖它；
  // 锁定只禁用输入（见下方 disabled），金额继续上抛保持 100% 与合计正确
  // 同时上抛展示留痕（条目名 / 部门 / 演算说明），提交审批时汇总写入该核算单的条目快照
  const snapName = slotCarrier ? `${item.name}（${slotCarrier}）` : item.name;
  const snapDept = item.dept === "ops" ? "业务支撑部" : "技术部";
  useEffect(() => { onAmount(rowKey, amount, { name: snapName, dept: snapDept, note: calc.text }); }, [rowKey, amount, onAmount, snapName, snapDept, calc.text]);

  return (
    <tr className={`border-b align-top last:border-0 hover:bg-[#F7F8FA] ${stale ? "opacity-50" : ""}`}>
        <td className="w-72 px-3 py-2.5">
        <div className="flex items-start gap-1.5">
          <div className="min-w-0">
            <div className="whitespace-nowrap text-sm font-medium text-[#1D2129]">
              {item.name}
              {slotCarrier && (
                <span className="ml-1.5 rounded-[2px] bg-[#E8F3FF] border border-[#BEDAFF] px-1.5 py-0.5 text-xs font-normal text-[#165DFF]">
                  {slotCarrier}线路资源位
                </span>
              )}
            </div>
            <div className="mt-0.5 truncate text-xs text-[#86909C]" title={`${item.costType} · ${item.unit} · ${SUBJECTS[item.key]}`}>
              {item.costType} · {item.unit} · {SUBJECTS[item.key]}
            </div>
          </div>
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          {stale && <Badge className="bg-[#F2F3F5] text-[10px] font-normal text-[#86909C] hover:bg-[#F2F3F5]">条目已停用 · 留档</Badge>}
          <Badge variant="outline" className="text-[10px] font-normal text-[#86909C]">可删行</Badge>
          {!locked && onRemove && (
            <button type="button" onClick={onRemove} className="text-xs text-[#C9CDD4] hover:text-[#F53F3F]">删除</button>
          )}
        </div>
      </td>
      <td className="w-28 whitespace-nowrap px-3 py-2.5">
        <span className={`inline-block rounded-[2px] px-1.5 py-0.5 text-[11px] ${item.dept === "ops" ? "bg-[#FFF7E8] text-[#FF7D00]" : "bg-[#E8FFFB] text-[#0FC6C2]"}`}>
          {item.dept === "ops" ? "支撑部" : "技术部"}
        </span>
        {(() => {
          const st = (item as CostItem).settleType;
          if (!st) return null;
          const tone = st === "间接" ? "bg-[#FEF0FF] text-[#CB26FF]" : "bg-[#E8F3FF] text-[#165DFF]";
          return (
            <span className={`mt-1 inline-block rounded-[2px] px-1.5 py-0.5 text-[10px] ${tone}`} title={SETTLE_RULE[st]}>
              {st}
            </span>
          );
        })()}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {opts.length > 0 && (
            <select
              value={enumVal}
              disabled={locked}
              onChange={(e) => {
                const v = e.target.value;
                setEnumVal(v);
                if (item.demo === "device") { setMeta(0); setPickedRow(null); }
              }}
              className="h-8 rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm text-[#4E5969] disabled:bg-[#F2F3F5]">
              {opts.map((o) => <option key={o}>{o}</option>)}
            </select>
          )}
          {searchSrc && item.demo !== "ippool" && item.demo !== "bwinternet" && item.demo !== "bwbase" && (
            <div className="w-full min-w-56 max-w-md">
              <ArchivePicker
                key={deviceSrc ?? searchSrc}
                sourceKey={deviceSrc ?? searchSrc}
                filterText={slotCarrier}
                onPick={(r) => { setMeta(Number(r.meta ?? 0)); setPickedRow(r); }}
              />
            </div>
          )}
          {item.demo === "bwinternet" && (
            <div className="w-full min-w-80 max-w-2xl">
              <ArchivePicker
                sourceKey="lineinternet"
                multi
                ptags={RESOURCE_TAGS}
                orderPtype={linePtype}
                onPickMulti={(rs) => { setPickedList(rs); onPickInternets?.(rs); }}
              />
            </div>
          )}
          {item.demo === "bwbase" && (
            <div className="w-full min-w-80 max-w-2xl space-y-1.5">
              {baseOthers && baseOthers.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-[#86909C]">他行已关联基础线路（点击共用）：</span>
                  {baseOthers.map(({ lid, row }) => (
                    <button key={lid + row.id} type="button"
                      className="rounded-[2px] border border-[#7BD9A8] bg-[#E8F8F2] px-1.5 py-0.5 text-[#00B42A] hover:bg-[#A9E8CD]"
                      onClick={() => {
                        setPickedList((ls) => (ls.some((x) => x.id === row.id) ? ls : [...ls, row]));
                        setSharedIds((ls) => (ls.includes(row.id) ? ls : [...ls, row.id]));
                      }}>
                      {lid} · {row.id} 共用
                    </button>
                  ))}
                </div>
              )}
              <ArchivePicker
                sourceKey="linebase"
                multi
                onPickMulti={(rs) => { setPickedList(rs); setSharedIds((ls) => ls.filter((id) => rs.some((r) => r.id === id))); onPickBases?.(rs); }}
              />
              {pickedList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {pickedList.map((r) => (
                    <span key={r.id}
                      className={`flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 ${
                        sharedIds.includes(r.id)
                          ? "border-[#7BD9A8] bg-[#E8F8F2] text-[#00B42A]"
                          : "border-[#E5E6EB] bg-[#F7F8FA] text-[#4E5969]"
                      }`}>
                      {r.id}
                      {sharedIds.includes(r.id) ? " · 共用（成本计于他行）" : ` · ${fmt(Number(r.meta || 0))} 元/M`}
                      <button type="button" className="text-[#165DFF] hover:underline"
                        onClick={() => setSharedIds((ls) => (ls.includes(r.id) ? ls.filter((x) => x !== r.id) : [...ls, r.id]))}>
                        {sharedIds.includes(r.id) ? "取消共用" : "标记共用"}
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {item.demo === "ippool" && (
            internetRows && internetRows.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-[2px] bg-[#F2F3F5] px-2 py-1 text-xs text-[#4E5969]">
                  出口线路查询条件（{internetRows.length} 条）：
                  {internetRows.map((r) => (
                    <span key={r.id} className="ml-1 font-mono font-medium text-[#4E5969]">{r.id}</span>
                  ))}
                </span>
                <div className="w-full min-w-48 max-w-60">
                  <ArchivePicker
                    sourceKey="lineip"
                    filterText={internetRows.map((r) => r.id).join("|")}
                    onPick={(r) => { setMeta(Number(r.meta ?? 39)); setPickedRow(r); setIpAlloc(ipNeed ?? Number(r.ipCount ?? 1)); }}
                  />
                </div>
                {pickedRow?.ipCount != null && (
                  <>
                    <label className="flex items-center gap-1.5 text-xs text-[#4E5969]">
                      本单分配
                      <Input
                        type="number"
                        value={effQty}
                        disabled={locked}
                        onChange={(e) => setIpAlloc(Number(e.target.value))}
                        className="h-7 w-20 text-right text-sm"
                      />
                      个（该段共 {pickedRow.ipCount} 个地址）
                    </label>
                    {ipNeed != null && effQty !== ipNeed ? (
                      <span className="rounded-[2px] border border-[#FBACA3] bg-[#FFECE8] px-2 py-1 text-xs text-[#F53F3F]">
                        本单分配 {effQty} 个 ≠ 合同需求 {ipNeed} 个（差异走异常处理）
                      </span>
                    ) : (
                      <span className="rounded-[2px] bg-[#E8F8F2] px-2 py-1 text-xs text-[#00B42A]">
                        本单分配 {effQty} 个 · 与合同需求一致
                      </span>
                    )}
                  </>
                )}
              </div>
            ) : ipFreeSearch ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-[2px] bg-[#FFF7E8] border border-[#FFCF8B] px-2 py-1 text-xs text-[#FF7D00]">
                  本行无出口线路条目：开放全量绑定 IP 搜索，请人工确认所选 IP 所属线路
                </span>
                <div className="w-full min-w-48 max-w-60">
                  <ArchivePicker
                    sourceKey="lineip"
                    onPick={(r) => { setMeta(Number(r.meta ?? 39)); setPickedRow(r); setIpAlloc(ipNeed ?? Number(r.ipCount ?? 1)); }}
                  />
                </div>
                {pickedRow?.ipCount != null && (
                  <>
                    <label className="flex items-center gap-1.5 text-xs text-[#4E5969]">
                      本单分配
                      <Input
                        type="number"
                        value={effQty}
                        disabled={locked}
                        onChange={(e) => setIpAlloc(Number(e.target.value))}
                        className="h-7 w-20 text-right text-sm"
                      />
                      个（该段共 {pickedRow.ipCount} 个地址）
                    </label>
                    {ipNeed != null && effQty !== ipNeed ? (
                      <span className="rounded-[2px] border border-[#FBACA3] bg-[#FFECE8] px-2 py-1 text-xs text-[#F53F3F]">
                        本单分配 {effQty} 个 ≠ 合同需求 {ipNeed} 个（差异走异常处理）
                      </span>
                    ) : (
                      <span className="rounded-[2px] bg-[#E8F8F2] px-2 py-1 text-xs text-[#00B42A]">
                        本单分配 {effQty} 个 · 与合同需求一致
                      </span>
                    )}
                  </>
                )}
              </div>
            ) : (
              <span className="rounded-[2px] bg-[#FFF7E8] border border-[#FFCF8B] px-2 py-1 text-xs text-[#FF7D00]">
                ⚠ 请先在「出口带宽租用费」条目选定出口线路——IP 与线路绑定，以已选线路为查询条件后才能选择 IP 地址
              </span>
            )
          )}
          {qf && (hasText || item.demo.startsWith("plain")) && item.demo !== "ippool" && (
            <label className="flex items-center gap-1.5 text-sm text-[#4E5969]">
              <span className="whitespace-nowrap text-xs text-[#86909C]">{qf.label}</span>
              <Input
                type="number"
                value={qty}
                disabled={locked}
                onChange={(e) => setQty(Number(e.target.value))}
                className="h-8 w-28 text-right disabled:bg-[#F2F3F5]"
              />
              <span className="text-xs text-[#86909C]">{qf.unit}</span>
            </label>
          )}
          {autoShare && (
            <span className="text-xs text-[#86909C]">系统按 {calc.text} 自动计收</span>
          )}
        </div>
      </td>
      <td className="w-44 whitespace-nowrap px-3 py-2.5 text-right">
        <div className="font-mono text-sm font-semibold text-[#1D2129]">
          {amount == null ? <span className="text-[#C9CDD4]">待选择档案</span> : `${fmt(amount)} ${item.unit}`}
        </div>
        {amount != null && calc.text && <div className="mt-0.5 truncate text-xs text-[#86909C]" title={`= ${calc.text}`}>= {calc.text}</div>}
      </td>
    </tr>
  );
}

// ---------- 章节标题：蓝色竖条 + 编号（借鉴参考样式的四段式结构） ----------
function SectionTitle({ no, children, extra }: { no?: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-[#F2F3F5] px-4 py-2.5">
      <span className="h-4 w-1 rounded-full bg-[#165DFF]" />
      <span className="text-sm font-semibold text-[#1D2129]">{no && <span className="mr-1">{no}</span>}{children}</span>
      <div className="ml-auto flex items-center gap-2">{extra}</div>
    </div>
  );
}

/** 添加条目弹层（2026-10-20 修订）：仅限与本行交付模式/类别有绑定关系的条目（模板/类别绑定的条目子集），
 *  不允许加入无绑定关系的其他条目；已存在的条目不重复列出。 */
function AddItemPanel({
  dept, allowedKeys, excludeKeys, onAdd, onClose, costType, anchor,
}: {
  dept: "ops" | "tech";
  /** 本行绑定条目集合（交付模式模板 或 产品类别绑定的 item_key 列表） */
  allowedKeys: string[];
  excludeKeys: string[];
  onAdd: (key: string) => void;
  onClose: () => void;
  /** 按费用类型过滤（一次性 → CAPEX 表 / 周期性 → OPEX 表） */
  costType?: "一次性" | "周期性";
  /** 触发按钮容器：弹层 fixed 锚定它，不随页面滚动漂移 */
  anchor: HTMLElement | null;
}) {
  const [kw, setKw] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const place = () => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left });
  };
  useEffect(() => {
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchor]);
  const candidates = getCostItems().filter(
    (i) => i.dept === dept && allowedKeys.includes(i.key) && !excludeKeys.includes(i.key) &&
      (!costType || i.costType === costType) &&
      (!kw || i.name.includes(kw) || (SUBJECTS[i.key] ?? "").includes(kw))
  );
  return (
    <div className="fixed z-40 mt-0 w-[520px] max-w-[90vw] rounded-[4px] border border-[#E5E6EB] bg-white shadow-2xl"
      style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, maxHeight: pos ? `calc(100vh - ${pos.top + 8}px)` : undefined }}>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium text-[#4E5969]">
          增补条目（仅限本行绑定的条目，共 {allowedKeys.filter((k) => getCostItems().find((i) => i.key === k)?.dept === dept).length} 条可选）
        </span>
        <button type="button" className="text-[#86909C] hover:text-[#4E5969]" onClick={onClose}>✕</button>
      </div>
      <div className="p-2">
        <Input autoFocus value={kw} onChange={(e) => setKw(e.target.value)} placeholder="搜索条目名称 / 财务科目" className="h-8 text-sm" />
      </div>
      <div className="max-h-[45vh] overflow-y-auto">
        <table className="w-full text-sm">
          <tbody>
          {candidates.map((i) => (
            <tr key={i.key} className="border-b last:border-0 hover:bg-[#F7F8FA]">
              <td className="px-3 py-2">
                <div className="font-medium text-[#1D2129]">{i.name}</div>
                <div className="text-xs text-[#86909C]">{i.costType} · {i.unit} · {SUBJECTS[i.key]}</div>
              </td>
              <td className="px-3 py-2 text-right">
                <button type="button"
                  className="rounded-[2px] border border-[#94BFFF] px-2 py-0.5 text-xs text-[#165DFF] hover:bg-[#0E42D2] hover:text-white"
                  onClick={() => { onAdd(i.key); onClose(); }}>
                  添加
                </button>
              </td>
            </tr>
          ))}
          {candidates.length === 0 && (
            <tr><td className="px-3 py-6 text-center text-sm text-[#86909C]">
              无匹配条目——增补仅限与本行交付模式 / 类别有绑定关系的条目，要扩大范围请调整产品类型装配（「资源清单」页）
            </td></tr>
          )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- 订单行项目（合同生效数据带入）：成本核算按行项目维度组织，每行独立交付模式 + 独立条目区 ----------
interface OrderLine {
  id: string;
  name: string;          // CRM 订单行项目名称
  price: number;         // 合同价（元/月）
  cat: string;           // 产品类别（ISP 互联网接入 / 数据专线 / IDC / 云 / 安全 / 转售业务）
  ptype?: string;        // 产品类型（AI 专线 / BGP 三网互通 / OTN …，成本条目按产品类型「装配」加载）
  ipNeed: number;        // 客户需求的 IP 地址数量（合同行带入，只读；成本核算选中绑定 IP 后与之校验）
}

const INIT_LINES: OrderLine[] = [
  { id: "L1", name: "BGP 三网互通 50M（ISP 互联网接入）", price: 12000, cat: "isp", ptype: "BGP 三网互通", ipNeed: 1 },
  { id: "L2", name: "国内精品网专线 50M（ISP 互联网接入）", price: 9000, cat: "isp", ptype: "国内精品网", ipNeed: 4 },
  { id: "L3", name: "OTN 上海—北京 专线（数据专线）", price: 18000, cat: "otn", ptype: "OTN", ipNeed: 0 },
  { id: "L4", name: "SD-WAN 组网专线（数据专线）", price: 6000, cat: "otn", ptype: "SD-WAN", ipNeed: 0 },
  { id: "L5", name: "电信线路转售 100M（转售业务 · 转买转卖）", price: 8000, cat: "resale", ptype: "运营商线路/裸光纤/设备转售", ipNeed: 0 },
];

// ---------- 合同 → 核算：订单行由已生效合同带入（合同与订单合二为一，2026-10-26） ----------
const CAT_MAP: Record<string, string> = {
  "ISP 互联网接入": "isp", "数据专线": "otn", "IDC": "idc",
  "云": "cloud", "安全服务": "sec", "转售": "resale",
};
/** 短码 → 中文类别名（反查产品目录用） */
const SHORT_TO_CAT: Record<string, string> = Object.fromEntries(
  Object.entries(CAT_MAP).map(([zh, short]) => [short, zh])
);

function linesFromContract(c: Contract): OrderLine[] {
  return c.lines.map((l, i) => {
    const ip = l.spec.match(/IP\s*(\d+)\s*个/);
    return {
      id: `L${i + 1}`,
      name: `${l.ptype}${l.spec ? ` · ${l.spec}` : ""}（${l.cat}）`,
      price: l.price,
      cat: CAT_MAP[l.cat] ?? "isp",
      ptype: l.ptype,
      ipNeed: ip ? Number(ip[1]) : 0,
    };
  });
}

export default function Home() {
  const [sp] = useSearchParams();
  /** 合同来源：/?contract=HT-xxxx 由合同详情「进入成本核算」带入（仅已生效合同） */
  const contract = CONTRACTS.find((c) => c.id === sp.get("contract") && c.status === "已生效") ?? null;
  const fromContract = !!contract;
  const [lines, setLines] = useState<OrderLine[]>(contract ? linesFromContract(contract) : INIT_LINES);
  /** 每行被删除的条目（行键，含资源位后缀）；增补仅限绑定条目，可补回 */
  const [removed, setRemoved] = useState<Record<string, string[]>>({});
  /** 每行补回的绑定条目（条目 key，须与本行交付模式/类别有绑定关系） */
  const [extra, setExtra] = useState<Record<string, string[]>>({});
  const [addOpen, setAddOpen] = useState<string | null>(null); // `${lineId}:${dept}`
  const addAnchorRef = useRef<HTMLDivElement | null>(null); // 增补弹层锚点（触发按钮容器）
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({ ops: false, tech: false });
  const [sent, setSent] = useState(false);
  /** 合同带入：进入即为本合同建档核算单（单号即时可见，台账同步可查；金额提交时回填） */
  useEffect(() => {
    if (contract) ensureSheetForContract(contract.id, contract.customer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract?.id]);
  usePoolSettle(); // 出口池月结数据变更时重渲染
  /** 提交审批那一刻：锁存出口池预估快照（当时的池状态 + 每单预估，事后池子变化不改这张核算单） */
  const lockPoolEsts = () => {
    const snaps: Omit<PoolEst, "at">[] = [];
    for (const l of lines) {
      const picked = internetPickStore[l.id];
      if (!picked?.length) continue;
      const groups = new Map<string, SourceRow[]>();
      picked.forEach((r) => {
        const g = groups.get(r.ptag ?? "") ?? [];
        g.push(r);
        groups.set(r.ptag ?? "", g);
      });
      for (const [ptag, rs] of groups) {
        const poolRows = SOURCES.lineinternet.rows.filter((r) => r.ptag === ptag);
        const rentTotal = poolRows.reduce((s, r) => s + Number(r.meta || 0), 0);
        const soldTotal = poolRows.reduce((s, r) => s + (r.pool?.usedM ?? 0), 0);
        const bwKey = [...rowsOf(l).ops, ...rowsOf(l).tech].find((rk) => itemByKey[rk.split("|")[0]]?.demo === "bwinternet");
        const bw = bwKey ? (bwStore[bwKey] ?? 50) : 50;
        snaps.push({
          orderId: l.id, orderName: l.name, pool: ptag, lineIds: rs.map((r) => r.id),
          bw, rentTotal, soldTotal,
          est: soldTotal + bw > 0 ? (rentTotal / (soldTotal + bw)) * bw : 0,
        });
      }
    }
    if (snaps.length) snapshotEsts(snaps);
  };
  /** 原型演示：正在编辑的订单行（可改名称 / 合同价，可增删行） */
  const [editingLine, setEditingLine] = useState<string | null>(null);
  /** 付款方式：合同带入；缺失时手工维护，不影响成本金额、仅作为收款账期依据 */
  const [payCycle, setPayCycle] = useState<string>(contract?.pay ?? "月付");
  const [, bump] = useState(0);
  /** 条目金额上抛：写暂存并触发重算。引用必须稳定（useCallback）——EntryRow 的副作用依赖它，
   *  若每次渲染生成新函数引用，副作用会每轮重跑→再次 setState→无限渲染卡死页面 */
  const reportAmount = useCallback((key: string, v: number | null, snap?: { name: string; dept: "业务支撑部" | "技术部"; note: string }) => {
    amountStore[key] = v;
    if (snap) entryInfoStore[key] = snap;
    bump((x) => x + 1);
  }, []);

  /** 订阅条目库 / 产品目录变更（条目停用、装配调整实时反映到填报页） */
  useCostItems();
  useCatalog();
  /** 条目库快照（含四要素与状态机；CostItem 为 CatalogItem 超集，EntryRow 全兼容） */
  const items = getCostItems();
  const itemByKey = Object.fromEntries(items.map((i) => [i.key, i]));

  /** 行项目驱动值：产品类别（条目集合按类别绑定统一生成） */
  const driverOf = (l: OrderLine) => `cat:${l.cat}`;
  const setDriver = (lid: string, v: string) => {
    const cat = v.replace(/^cat:/, "");
    setLines((ls) => ls.map((l) => (l.id === lid ? { ...l, cat } : l)));
    // 切换驱动 → 清掉该行的删除/补回记录，金额暂存中该行数据一并清除
    setRemoved((r) => ({ ...r, [lid]: [] }));
    setExtra((r) => ({ ...r, [lid]: [] }));
    delete internetPickStore[lid];
    delete basePickStore[lid];
    for (const k of Object.keys(amountStore)) if (k.startsWith(lid + "::")) delete amountStore[k];
    bump((x) => x + 1);
  };

  /** 核算链路 v1.0 主线：条目模板按「产品类型装配」加载（产品定义中勾选的默认成本条目集合）。
   *  无装配（未匹配到产品类型 / 类型未勾选条目）时回退按产品类别绑定推导。返回 null = 回退。 */
  const assemblyOf = (l: OrderLine): string[] | null => {
    if (l.cat === "all" || !l.ptype) return null;
    const t = GET_TYPE(SHORT_TO_CAT[l.cat] ?? "", l.ptype);
    return t && t.costItems.length > 0 ? t.costItems : null;
  };
  /** 类别回退推导的条目集合（老逻辑，无装配时的兜底） */
  const catBoundKeys = (l: OrderLine) =>
    items.filter((it) => l.cat === "all" || it.cats.includes(l.cat)).map((i) => i.key);

  /** 合并条目模板（装配优先，类别绑定回退）+ 删改，得出该行两部门的行键列表（增补仅限绑定条目，可补回） */
  const rowsOf = (l: OrderLine): Record<"ops" | "tech", string[]> => {
    const def = (assemblyOf(l) ?? catBoundKeys(l)).filter((k) => itemByKey[k]);
    const base: Record<"ops" | "tech", string[]> = {
      ops: def.filter((k) => itemByKey[k].dept === "ops"),
      tech: def.filter((k) => itemByKey[k].dept === "tech"),
    };
    const rm = removed[l.id] ?? [];
    const ex = (extra[l.id] ?? []).filter((k) => !base.ops.includes(k) && !base.tech.includes(k));
    return {
      ops: [...base.ops.filter((k) => !rm.includes(k)), ...ex.filter((k) => itemByKey[k].dept === "ops")],
      tech: [...base.tech.filter((k) => !rm.includes(k)), ...ex.filter((k) => itemByKey[k].dept === "tech")],
    };
  };

  const removeRow = (lid: string, rk: string) => {
    setRemoved((r) => ({ ...r, [lid]: [...(r[lid] ?? []), rk] }));
    delete amountStore[`${lid}::${rk}`];
    bump((x) => x + 1);
  };
  const addRow = (lid: string, key: string) => {
    setExtra((r) => ({ ...r, [lid]: [...(r[lid] ?? []), key] }));
  };

  // ---------- 原型演示：订单行增删改（正式版订单行由合同生效数据带入，不可编辑） ----------
  const updateLine = (lid: string, patch: Partial<OrderLine>) =>
    setLines((ls) => ls.map((l) => (l.id === lid ? { ...l, ...patch } : l)));
  const removeLine = (lid: string) => {
    setLines((ls) => ls.filter((l) => l.id !== lid));
    setRemoved((r) => { const n = { ...r }; delete n[lid]; return n; });
    setExtra((r) => { const n = { ...r }; delete n[lid]; return n; });
    delete internetPickStore[lid];
    delete basePickStore[lid];
    for (const k of Object.keys(amountStore)) if (k.startsWith(lid + "::")) delete amountStore[k];
    if (editingLine === lid) setEditingLine(null);
    bump((x) => x + 1);
  };
  const addLine = () => {
    const id = `L${Date.now().toString(36).toUpperCase()}`;
    setLines((ls) => [...ls, {
      id,
      name: "新订单行（点「编辑」改名称与价格）",
      price: 8000,
      cat: "isp",
      ipNeed: 1,
    }]);
    setEditingLine(id);
  };

  const allRowKeys = (dept: "ops" | "tech") =>
    lines.flatMap((l) => rowsOf(l)[dept].map((rk) => `${l.id}::${rk}`));

  const deptProg = (dept: "ops" | "tech") => {
    const keys = allRowKeys(dept);
    if (keys.length === 0) return 0;
    return Math.round((keys.filter((k) => amountStore[k] != null).length / keys.length) * 100);
  };

  /** 按费用类型拆分条目行键（一次性 = CAPEX / 周期性 = OPEX） */
  const splitKeys = (l: OrderLine) => {
    const all = [...rowsOf(l).ops, ...rowsOf(l).tech];
    return {
      capex: all.filter((rk) => itemByKey[rk.split("|")[0]]?.costType === "一次性"),
      opex: all.filter((rk) => itemByKey[rk.split("|")[0]]?.costType !== "一次性"),
    };
  };
  const lineCapex = (l: OrderLine) => splitKeys(l).capex.reduce((s, rk) => s + (amountStore[`${l.id}::${rk}`] ?? 0), 0);
  const lineOpex = (l: OrderLine) => splitKeys(l).opex.reduce((s, rk) => s + (amountStore[`${l.id}::${rk}`] ?? 0), 0);
  const capexGrand = lines.reduce((s, l) => s + lineCapex(l), 0);
  const opexGrand = lines.reduce((s, l) => s + lineOpex(l), 0);

  const totalPrice = lines.reduce((s, l) => s + l.price, 0);
  const allReady = deptProg("ops") === 100 && deptProg("tech") === 100;

  /** 合同期限（月）：合同带入按起止日期折算；演示数据按 24 个月 */
  const months = (() => {
    if (contract) {
      const m = (new Date(contract.end).getTime() - new Date(contract.start).getTime()) / (30.44 * 24 * 3600 * 1000);
      return Math.max(1, Math.round(m));
    }
    return 24;
  })();
  /** 效益分析（全填齐后才有意义）：合同期总收入 / 总成本 / 毛利率 / 回本周期 */
  const revenueTotal = totalPrice * months;
  const costTotal = capexGrand + opexGrand * months;
  const marginTotal = revenueTotal > 0 && allReady ? ((1 - costTotal / revenueTotal) * 100).toFixed(1) : null;
  const monthlyNet = totalPrice - opexGrand;
  const payback = allReady && capexGrand > 0 && monthlyNet > 0 ? (capexGrand / monthlyNet).toFixed(1) : null;

  const deptName = (d: "ops" | "tech") => (d === "ops" ? "支撑部" : "技术部");

  const lineCard = (l: OrderLine) => {
    const rows = rowsOf(l);
    const { capex, opex } = splitKeys(l);
    const capexSum = lineCapex(l);
    const opexSum = lineOpex(l);
    const margin = l.price > 0 && opexSum > 0 ? ((1 - opexSum / l.price) * 100).toFixed(1) : null;
    /** 本行绑定条目集合：产品类型装配优先（核算链路 v1.0），无装配回退类别绑定；增补仅限该集合 */
    const asm = assemblyOf(l);
    const boundKeys = asm ?? catBoundKeys(l);
    /** 装配来源标识（行头展示，含装配版本：合同绑定签订时版本，装配升级不影响存量合同） */
    const asmType = asm && l.ptype ? GET_TYPE(SHORT_TO_CAT[l.cat] ?? "", l.ptype) : null;
    const asmBadge = asm ? `产品类型装配 ${asm.length} 条 · v${asmType?.asmVersion ?? 1}` : l.ptype ? "未装配 · 类别回退" : "类别绑定";
    /** 他行已关联的基础线路（本行数据专线等可共用） */
    const baseOthers = Object.entries(basePickStore)
      .filter(([lid]) => lid !== l.id)
      .flatMap(([lid, rs]) => rs.map((row) => ({ lid, row })));
    const presentKeys = [...rows.ops, ...rows.tech].map((k) => k.split("|")[0]);
    return (
      <section key={l.id} className="overflow-visible rounded-[4px] border border-[#E5E6EB] bg-white ">
        <div className="flex flex-wrap items-center gap-3 border-b bg-[#F7F8FA]/80 px-4 py-3">
          <span className="font-mono text-xs text-[#86909C]">{l.id}</span>
          {editingLine === l.id ? (
            <>
              <Input
                value={l.name}
                onChange={(e) => updateLine(l.id, { name: e.target.value })}
                className="h-7 w-72 text-sm"
                placeholder="订单行名称（产品 + 带宽）"
              />
              <label className="flex items-center gap-1 text-xs text-[#4E5969]">
                合同价（元/月）
                <Input
                  type="number"
                  value={l.price}
                  onChange={(e) => updateLine(l.id, { price: Number(e.target.value) })}
                  className="h-7 w-24 text-right text-sm"
                />
              </label>
              <label className="flex items-center gap-1 text-xs text-[#4E5969]">
                IP 需求（个，合同同步）
                <Input
                  type="number"
                  value={l.ipNeed}
                  onChange={(e) => updateLine(l.id, { ipNeed: Number(e.target.value) })}
                  className="h-7 w-16 text-right text-sm"
                />
              </label>
              <button type="button" onClick={() => setEditingLine(null)}
                className="rounded-[2px] border border-[#94BFFF] px-2 py-0.5 text-xs text-[#165DFF] hover:bg-[#0E42D2] hover:text-white">
                完成
              </button>
            </>
          ) : (
            <>
              <h2 className="text-sm font-bold text-[#1D2129]">{l.name}</h2>
              <span className={`rounded-[2px] border px-1.5 py-0.5 text-xs ${asm ? "border-[#BEDAFF] bg-[#E8F3FF] text-[#165DFF]" : "border-[#E5E6EB] bg-[#F7F8FA] text-[#86909C]"}`}
                title={asm ? `条目模板来自产品类型「${l.ptype}」装配（产品定义 · 默认成本条目集合）` : "未匹配到产品类型装配，条目按产品类别绑定回退加载"}>
                {asmBadge}
              </span>
              <span className="text-xs text-[#86909C]">合同价 {fmt(l.price)} 元/月{fromContract ? "（合同约定价 · 只读）" : "（原型可编辑 · 正式版只读）"}</span>
              <span className={`rounded-[2px] px-1.5 py-0.5 text-xs ${l.ipNeed > 0 ? "bg-[#E8F3FF] text-[#165DFF]" : "bg-[#F2F3F5] text-[#86909C]"}`}>
                IP 需求：{l.ipNeed > 0 ? `${l.ipNeed} 个` : "无"}（{fromContract ? "合同同步" : "演示数据"}）
              </span>
              {!fromContract && (
                <button type="button" onClick={() => setEditingLine(l.id)}
                  className="text-xs text-[#86909C] hover:text-[#165DFF]">
                  编辑
                </button>
              )}
            </>
          )}
          {!fromContract && (
            <button type="button" onClick={() => removeLine(l.id)}
              className="text-xs text-[#C9CDD4] hover:text-[#F53F3F]">
              删除行
            </button>
          )}
          <label className="ml-auto flex items-center gap-1.5 text-xs text-[#4E5969]">
            产品类别
            <select
              value={driverOf(l)}
              onChange={(e) => setDriver(l.id, e.target.value)}
              className="h-8 max-w-72 rounded-[2px] border border-[#E5E6EB] bg-white px-2 text-sm text-[#4E5969]">
              {CATEGORIES.map((c) => (
                <option key={c.id} value={`cat:${c.id}`}>{c.name}</option>
              ))}
              <option value="cat:all">全部条目（演示）</option>
            </select>
          </label>
        </div>
        {l.cat === "isp" && (
          <div className="border-b bg-[#E8F3FF] px-4 py-2 text-xs leading-5 text-[#165DFF]">
            出口 = 向运营商采购的线路，可多家客户共用。成本按<strong>归属产品类型</strong>合并计收（边际计价）：同类型所有出口月租合计 ÷（已售带宽 + 本单带宽）× 本单带宽——回答「新增这一单的成本」；月结按平均分摊（池成本 ÷ 已售带宽）做实际归属。
            BGP 三网选电信/联通/移动三条（并入同一池），AI 专线、D-MAN 共享 BGP 出口；一单可选多条线路。
          </div>
        )}
        {(() => {
          /** 渲染一条目行（含资源位后缀展开）；锁定状态随条目所属部门 */
          const entryRow = (rk: string) => {
            const [base, carrier] = rk.split("|");
            const dept = itemByKey[base].dept;
            return (
              <EntryRow
                key={`${l.id}::${rk}`}
                item={itemByKey[base]}
                rowKey={`${l.id}::${rk}`}
                slotCarrier={carrier}
                locked={submitted[dept]}
                stale={itemByKey[base].status === "停用"}
                onRemove={() => removeRow(l.id, rk)}
                onAmount={reportAmount}
                internetRows={internetPickStore[l.id] ?? []}
                onPickInternets={(rs) => { internetPickStore[l.id] = rs; bump((x) => x + 1); }}
                ipFreeSearch={!rows.ops.some((k) => k.split("|")[0] === "op1b")}
                ipNeed={l.ipNeed}
                lineId={l.id}
                linePtype={l.ptype}
                baseOthers={baseOthers}
                onPickBases={(rs) => { basePickStore[l.id] = rs; bump((x) => x + 1); }}
              />
            );
          };
          const emptyHint = (
            <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-[#C9CDD4]">
              {capex.length + opex.length === 0
                ? (l.ptype
                    ? `产品类型「${l.ptype}」尚未装配成本条目——请到「资源清单」维护该产品类型的组成（直接成本由组成自动推导）并勾选成本中心（间接费用），保存后本行自动加载条目模板`
                    : "本行未匹配到产品类型（无合同 / 演示数据），条目按产品类别绑定回退加载")
                : "本类暂无条目（可用右上角「增补」从绑定条目中添加）"}
            </td></tr>
          );
          const addButtons = (ct: "一次性" | "周期性") => (
            <div ref={addAnchorRef} className="relative flex items-center gap-2">
              {(["ops", "tech"] as const).map((dept) => (
                <button key={dept} type="button" disabled={submitted[dept]}
                  className="text-xs text-[#165DFF] hover:underline disabled:cursor-not-allowed disabled:text-[#C9CDD4]"
                  onClick={() => setAddOpen(addOpen === `${l.id}:${ct}:${dept}` ? null : `${l.id}:${ct}:${dept}`)}>
                  ＋{deptName(dept)}增补
                </button>
              ))}
              {addOpen?.startsWith(`${l.id}:${ct}`) && (() => {
                const dept = addOpen!.endsWith(":ops") ? "ops" : "tech";
                return (
                  <AddItemPanel
                    dept={dept}
                    allowedKeys={boundKeys}
                    excludeKeys={presentKeys}
                    costType={ct}
                    anchor={addAnchorRef.current}
                    onAdd={(k) => addRow(l.id, k)}
                    onClose={() => setAddOpen(null)}
                  />
                );
              })()}
            </div>
          );
          return (
            <>
              {/* 一次性成本（CAPEX）：开通时一次性投入 */}
              <div className="relative">
                <SectionTitle extra={addButtons("一次性")}>
                  一次性成本<span className="ml-1 text-xs font-normal text-[#86909C]">（CAPEX · 开通时一次性发生的投入）</span>
                </SectionTitle>
                <div className="overflow-x-auto">
                <table className="w-full min-w-[880px]">
                  <thead>
                    <tr className="border-b bg-[#F7F8FA] text-left text-xs text-[#86909C]">
                      <th className="w-72 whitespace-nowrap px-3 py-2 font-normal">成本项</th>
                      <th className="w-28 whitespace-nowrap px-3 py-2 font-normal">填报部门</th>
                      <th className="px-3 py-2 font-normal">填报（选择档案 / 输入数量）</th>
                      <th className="w-44 whitespace-nowrap px-3 py-2 text-right font-normal">金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capex.map(entryRow)}
                    {!capex.length && emptyHint}
                  </tbody>
                </table>
                </div>
                {capex.length > 0 && (
                  <div className="flex justify-end border-t border-dashed border-[#E5E6EB] px-4 py-2 text-xs text-[#4E5969]">
                    一次性成本合计 <span className="ml-2 font-mono text-sm font-semibold text-[#F53F3F]">¥ {fmt(capexSum)}</span>
                  </div>
                )}
              </div>

              {/* 月度成本（OPEX）：每月持续发生 */}
              <div className="relative">
                <SectionTitle extra={addButtons("周期性")}>
                  月度成本<span className="ml-1 text-xs font-normal text-[#86909C]">（OPEX · 每月持续发生）</span>
                </SectionTitle>
                <div className="overflow-x-auto">
                <table className="w-full min-w-[880px]">
                  <thead>
                    <tr className="border-b bg-[#F7F8FA] text-left text-xs text-[#86909C]">
                      <th className="w-72 whitespace-nowrap px-3 py-2 font-normal">成本项</th>
                      <th className="w-28 whitespace-nowrap px-3 py-2 font-normal">填报部门</th>
                      <th className="px-3 py-2 font-normal">填报（选择档案 / 输入数量）</th>
                      <th className="w-44 whitespace-nowrap px-3 py-2 text-right font-normal">金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opex.map(entryRow)}
                    {!opex.length && emptyHint}
                  </tbody>
                </table>
                </div>
                {opex.length > 0 && (
                  <div className="flex justify-end border-t border-dashed border-[#E5E6EB] px-4 py-2 text-xs text-[#4E5969]">
                    月度成本合计 <span className="ml-2 font-mono text-sm font-semibold text-[#F53F3F]">¥ {fmt(opexSum)}</span>
                    <span className="mx-3 text-[#C9CDD4]">|</span>
                    行毛利参考 <span className={`ml-2 font-mono text-sm font-semibold ${margin != null && Number(margin) >= 40 ? "text-[#00B42A]" : margin != null && Number(margin) >= 20 ? "text-[#FF7D00]" : "text-[#F53F3F]"}`}>{margin != null ? `${margin}%` : "—"}</span>
                  </div>
                )}
              </div>
            </>
          );
        })()}
      </section>
    );
  };

  return (
    <ArcoShell breadcrumb="核算单录入">
      {/* 单号 + 状态条 */}
      <div className="flex items-center gap-4 border-b border-[#E5E6EB] bg-white px-6 py-2.5">
        <span className="font-mono text-[14px] text-[#1D2129]">{contract ? (SHEET_OF_CONTRACT(contract.id)?.id ?? "—") : "CE-2026-1008"}</span>
        <span className={`rounded-[2px] px-2 py-0.5 text-[12px] ${sent ? "bg-[#E8F3FF] text-[#165DFF]" : "bg-[#FFF3E8] text-[#FF7D00]"}`}>
          {sent ? "审批中（已锁定）" : "待填写"}
        </span>
        <div className="ml-auto flex items-center gap-4 text-[13px] text-[#86909C]">
          <span className="cursor-pointer hover:text-[#165DFF]"
            onClick={() => alert("原型演示：对部门填报进度（未开始 / 填写中 / 已提交）+ 最后更新时间")}>查看对方进度</span>
          <span className="cursor-pointer hover:text-[#165DFF]"
            onClick={() => alert("原型演示：行级操作留痕（增删条目 / 改值 / 提交，含操作人、时间、原因快照）")}>操作日志</span>
        </div>
      </div>

      <main className="space-y-5 p-6">
        <section className="overflow-hidden rounded-[4px] border border-[#E5E6EB] bg-white">
          <SectionTitle no="一、">订单与合同信息</SectionTitle>
          <div className="p-4">
          <div className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-5">
            <div><div className="text-xs text-[#86909C]">客户</div><div className="font-medium">{contract?.customer ?? "上海某科技公司"}</div></div>
            <div>
              <div className="text-xs text-[#86909C]">合同号 / 期限</div>
              {contract ? (
                <div className="font-medium">
                  <Link className="font-mono text-[#165DFF] hover:underline" to={`/contract/detail?id=${contract.id}`}>{contract.id}</Link>
                  <span className="ml-1 text-xs text-[#86909C]">{contract.start} ~ {contract.end}</span>
                </div>
              ) : (
                <div className="font-medium">HT-2026-0341 · 24 个月</div>
              )}
            </div>
            <div>
              <div className="text-xs text-[#86909C]">付款方式（{fromContract ? "合同约定 · 可手工维护" : "缺失时手工维护"}）</div>
              <select
                value={payCycle}
                onChange={(e) => setPayCycle(e.target.value)}
                className="mt-0.5 rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1 text-sm font-medium focus:border-[#165DFF] focus:outline-none">
                {["月付", "季度付", "半年付", "年付"].map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div><div className="text-xs text-[#86909C]">订单行数（{fromContract ? "合同带入" : "演示数据"}）</div><div className="font-medium">{lines.length} 行 · 合计 {fmt(totalPrice)} 元/月</div></div>
            <div><div className="text-xs text-[#86909C]">销售员（提成在 CRM 核算）</div><div className="font-medium">张伟</div></div>
          </div>
          {fromContract && (
            <div className="mt-3 rounded-[2px] border border-[#7BD9A8] bg-[#E8F8F2] px-3 py-2 text-xs leading-5 text-[#00701A]">
              订单行由合同 <span className="font-mono">{contract!.id}</span> 生效数据带入（合同与订单合二为一）：行名称、合同价、IP 需求均来自合同约定，<strong>只读不可改</strong>；售价 = 合同约定价，折扣 {contract!.discount}% 已在特批层审定。
            </div>
          )}
          <div className="mt-3 rounded-[2px] bg-[#E8F3FF] px-3 py-2 text-xs leading-5 text-[#165DFF]">
            每行算哪些账，由<strong>资源清单</strong>决定：产品组成推出直接成本，勾选的成本中心带来间接费用。选资源自动带出价格，金额按条目口径自动计算；默认行可删可补回（删除留痕，审批流兜底）。
          </div>
          </div>
        </section>

        {lines.map(lineCard)}

        {!fromContract && (
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={addLine}>
              ＋ 添加订单行（演示：任意组合产品类别 / 交付模式）
            </Button>
            <span className="text-xs text-[#86909C]">原型专用：正式环境中订单行由合同生效数据带入，不可增删改</span>
          </div>
        )}

        {/* 四、效益分析结论：填完成本立刻看到「这单划不划算」 */}
        <section className="overflow-hidden rounded-[4px] border border-[#E5E6EB] bg-white">
          <SectionTitle no="四、">效益分析结论</SectionTitle>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: `合同期总收入（${months} 个月）`, value: `¥ ${fmt(revenueTotal)}`, tone: "text-[#1D2129]" },
                { label: "合同期总成本", value: `¥ ${fmt(costTotal)}`, tone: "text-[#F53F3F]", sub: `一次性 ¥${fmt(capexGrand)} + 月度 ¥${fmt(opexGrand)} × ${months}` },
                { label: "合同期毛利率", value: marginTotal != null ? `${marginTotal}%` : "待填齐", tone: marginTotal != null && Number(marginTotal) >= 40 ? "text-[#00B42A]" : marginTotal != null && Number(marginTotal) >= 20 ? "text-[#FF7D00]" : "text-[#F53F3F]" },
                { label: "投资回本周期", value: payback != null ? `${payback} 个月` : capexGrand > 0 ? "待填齐 / 月毛利≤0" : "无需回本", tone: "text-[#165DFF]" },
              ].map((c) => (
                <div key={c.label} className="rounded-[4px] border border-[#F2F3F5] bg-[#F7F8FA]/60 p-3">
                  <div className="text-xs text-[#86909C]">{c.label}</div>
                  <div className={`mt-1 font-mono text-xl font-bold ${c.tone}`}>{c.value}</div>
                  {c.sub && <div className="mt-0.5 text-[10px] text-[#C9CDD4]">{c.sub}</div>}
                </div>
              ))}
            </div>
            {!allReady && (
              <div className="mt-2 text-[11px] text-[#86909C]">※ 两个部门全部条目填齐后，毛利率与回本周期才准确（当前按已填金额估算）。</div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-[#F2F3F5] pt-3">
              {(["ops", "tech"] as const).map((dept) => {
                const prog = deptProg(dept);
                const done = submitted[dept];
                return (
                  <div key={dept} className="flex items-center gap-2">
                    <span className="text-xs text-[#4E5969]">{deptName(dept)}填报进度</span>
                    <Progress value={prog} className="h-1.5 w-24" />
                    <span className="w-8 text-xs text-[#4E5969]">{prog}%</span>
                    {done ? (
                      <span className="rounded-[2px] bg-green-100 px-2 py-0.5 text-xs text-[#00B42A]">已提交 · 锁定</span>
                    ) : (
                      <Button size="sm" variant="outline" disabled={prog < 100}
                        onClick={() => { setSubmitted((s) => ({ ...s, [dept]: true })); bump((x) => x + 1); }}>
                        提交{deptName(dept)}
                      </Button>
                    )}
                  </div>
                );
              })}
              <span className="text-[11px] text-[#C9CDD4]">齐套后由最后提交方触发审批（审批链可配置：默认财务主管）</span>
              <Button className="ml-auto" disabled={!allReady || sent} onClick={() => {
                // 提交前校验：本单 BOM 引用的物料类是否都有直接成本条目覆盖（推导桥完整性）
                const matKeys = lines.flatMap((l) => (GET_TYPE(SHORT_TO_CAT[l.cat] ?? "", l.ptype ?? "")?.materials ?? []).map((m) => m.libKey));
                const uncovered = uncoveredClasses(matKeys);
                if (uncovered.length && !window.confirm(
                  `成本无出处提示：以下资源类没有直接成本条目覆盖，费用将通过间接费用分摊，请确认是否继续提交：\n${uncovered.map((k) => `· ${MAT_DEF(k)?.name ?? k}`).join("\n")}\n\n（可在「成本条目库」为条目补挂「适用资源」后重新提交）`
                )) return;
                lockPoolEsts(); setSent(true);
                // 接入统一审批引擎：提交即匹配审批点/链并生成实例；未命中则直接生效并说明原因
                // 合同带入：按当前合同建档/取核算单并回填真实测算；演示路径沿用默认单 CE-2026-1008
                const sheet0 = contract
                  ? (() => { const s = ensureSheetForContract(contract.id, contract.customer);
                      fillSheet(s, { lines: lines.length, monthlyCost: Math.round(opexGrand), contractValue: totalPrice, margin: marginTotal != null ? Number(marginTotal) : 0 });
                      return s; })()
                  : SHEETS.find((s) => s.id === "CE-2026-1008");
                if (sheet0) {
                  // 按单留存填报条目快照：审批详情展示的是「这一单真实填入的内容」，不是演示汇总数据
                  const recs = Object.entries(amountStore)
                    .filter(([k, v]) => v != null && k.split("::")[0] && lines.some((l) => l.id === k.split("::")[0]))
                    .map(([k, v]) => {
                      const lid = k.split("::")[0];
                      const line = lines.find((x) => x.id === lid);
                      const info = entryInfoStore[k];
                      return {
                        dept: info?.dept ?? "业务支撑部",
                        line: line ? `${line.id} · ${line.name}` : lid,
                        item: info?.name ?? k,
                        amount: v as number,
                        note: info?.note ?? "",
                      };
                    });
                  recordSheetEntries(sheet0.id, recs);
                  const r = submitForApproval("成本核算单 · 提交", sheet0.id, `${sheet0.customer} · ${sheet0.contract}`,
                    { monthlyCost: sheet0.monthlyCost, contractValue: sheet0.contractValue, margin: sheet0.margin, lines: sheet0.lines },
                    currentUser()?.name ?? "演示用户");
                  if (!r.hit) alert(`未进入审批：${r.reason ?? "未命中审批点，单据直接生效"}`);
                }
              }}>
                {sent ? "已提交审批" : "提交审批"}
              </Button>
              {sent && (
                <span className="text-[11px] text-[#165DFF]">出口池预估快照已锁定（签单时的池状态，事后不改本单）→ 月结按实际已售重算，见「成本中心」页 · 出口池月结</span>
              )}
            </div>
          </div>
        </section>
      </main>
    </ArcoShell>
  );
}
