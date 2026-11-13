import { useEffect, useRef, useState } from "react";
import { SOURCES, catUntilOf, type PoolOrder, type SourceRow } from "@/data/catalog";
import { DEMO_TODAY } from "@/data/settings";

/** 到期临期阈值：今天 + 90 天内的算临期 */
const EXPIRE_SOON = (() => { const d = new Date(DEMO_TODAY); d.setDate(d.getDate() + 90); return d; })();
import { Input } from "@/components/ui/input";

interface Props {
  sourceKey: string;
  label?: string;
  /** 过滤条件："|" 分隔表示 OR（多选出口线路时，IP 查询跨多条线路）；空格分隔表示 AND */
  filterText?: string;
  /** 出口资源等档案：按分类标签（6 类产品类型）chips 查询 */
  ptags?: string[];
  /** 本单订单的产品类型：传入后挑选列表自动只显示 归属该类型、或可共享给该类型 的资源（可由填报人手动切换） */
  orderPtype?: string;
  /** 多选模式（一单多条线路：出口资源可多选） */
  multi?: boolean;
  onPick?: (row: SourceRow) => void;
  onPickMulti?: (rows: SourceRow[]) => void;
}

/** 档案列表行：出口线路等共享资源可展开看承载明细（已承载客户订单） */
function LoadBar({ usedM, capacityM }: { usedM: number; capacityM: number }) {
  const pct = Math.round((usedM / capacityM) * 100);
  return (
    <div className="w-36">
      <div className="flex justify-between text-[11px] text-[#4E5969]">
        <span>{usedM}M / {capacityM}M</span>
        <span className={pct >= 80 ? "font-semibold text-[#F53F3F]" : pct >= 60 ? "text-[#FF7D00]" : "text-[#00B42A]"}>{pct}%</span>
      </div>
      <div className="mt-0.5 h-1.5 rounded-[2px] bg-[#E5E6EB]">
        <div
          className={`h-1.5 rounded-[2px] ${pct >= 80 ? "bg-[#F53F3F]" : pct >= 60 ? "bg-[#FF7D00]" : "bg-[#00B42A]"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="mt-0.5 text-[10px] text-[#C9CDD4]">商用指标（不进核算）</div>
    </div>
  );
}

function OrderTable({ orders, capacityM }: { orders: PoolOrder[]; capacityM: number }) {
  return (
    <table className="mt-1 w-full text-xs">
      <thead>
        <tr className="text-left text-[#86909C]">
          <th className="py-0.5 pr-4 font-normal">客户</th>
          <th className="py-0.5 pr-4 font-normal">带宽需求</th>
          <th className="py-0.5 pr-4 font-normal">占容量比</th>
          <th className="py-0.5 pr-4 font-normal">开通时间</th>
          <th className="py-0.5 font-normal">到期时间</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o, i) => {
          const until = catUntilOf(o);
          const near = until !== "—" && new Date(`${until}-01`) <= EXPIRE_SOON;
          return (
            <tr key={i} className="border-t border-[#F2F3F5] text-[#4E5969]">
              <td className="py-0.5 pr-4">{o.customer}</td>
              <td className="py-0.5 pr-4 font-mono">{o.bw}M</td>
              <td className="py-0.5 pr-4 font-mono">{Math.round((o.bw / capacityM) * 100)}%</td>
              <td className="py-0.5 pr-4">{o.since}</td>
              <td className={`py-0.5 font-mono ${near ? "font-medium text-[#FF7D00]" : ""}`}>{until}{near ? "（临期）" : ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FragmentRow({ r, selected, onPick }: { r: SourceRow; selected?: boolean; onPick: () => void }) {
  const [expand, setExpand] = useState(false);
  const p = r.pool;
  return (
    <>
      <tr className="border-b last:border-0 hover:bg-[#F7F8FA]">
        <td className="px-3 py-2 font-mono text-xs text-[#4E5969]">{r.id}</td>
        <td className="px-3 py-2 font-medium text-[#1D2129]">
          {r.title}
          {p && (
            <button
              type="button"
              className="ml-2 text-xs font-normal text-[#165DFF] hover:underline"
              onClick={(e) => { e.stopPropagation(); setExpand(!expand); }}>
              {expand ? "▲ 收起" : "▼ 共用客户明细"}
            </button>
          )}
        </td>
        <td className="px-3 py-2 text-xs text-[#4E5969]">{r.sub}</td>
        <td className="px-3 py-2">
          {p ? (
            <LoadBar usedM={p.usedM} capacityM={p.capacityM} />
          ) : (
            <span className="text-xs text-[#C9CDD4]">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-right">
          <button
            type="button"
            className={`rounded-[2px] border px-2 py-0.5 text-xs ${
              selected
                ? "border-green-400 bg-[#E8F8F2] text-[#00B42A]"
                : "border-[#94BFFF] text-[#165DFF] hover:bg-[#0E42D2] hover:text-white"
            }`}
            onClick={onPick}>
            {selected ? "✓ 已选" : "选此条"}
          </button>
        </td>
      </tr>
      {expand && p && (
        <tr className="border-b bg-[#F7F8FA]/80">
          <td colSpan={5} className="px-3 py-2">
            <div className="text-xs font-medium text-[#4E5969]">
              {p.orders.length > 0
                ? <>本单按<strong>归属产品类型出口池</strong>计收：产品类型出口月租合计 ÷（池内已售合计＋本单带宽）× 本单带宽；本线当前已售 {p.usedM}M、承载 {p.orders.length} 家客户</>
                : <>本线尚未承载客户（容量 {p.capacityM}M，商用指标）；成本仍按归属产品类型出口池计收</>}
            </div>
            {p.orders.length > 0 && <OrderTable orders={p.orders} capacityM={p.capacityM} />}
          </td>
        </tr>
      )}
    </>
  );
}

/** 档案选择器：真实页面中的「搜索并选择」弹层 */
export default function ArchivePicker({ sourceKey, label, filterText, ptags, orderPtype, multi, onPick, onPickMulti }: Props) {
  const src = SOURCES[sourceKey];
  const [open, setOpen] = useState(false);
  const [kw, setKw] = useState("");
  const [picked, setPicked] = useState<SourceRow | null>(null);
  const [pickedRows, setPickedRows] = useState<SourceRow[]>([]);
  const [manual, setManual] = useState(false);
  const [manualPrice, setManualPrice] = useState("");
  const [manualNote, setManualNote] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  // 弹层用 fixed 定位锚定输入框：不随页面滚动漂移；打开期间跟随 scroll/resize 重定位
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const place = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: Math.min(560, window.innerWidth - r.left - 8) });
  };
  useEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("scroll", place, true); // capture：页面与内部滚动容器都触发
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /** 默认按本单产品类型过滤（订单带入，不由条目配置）；填报人可手动切换/清除 */
  const [tag, setTag] = useState<string | null>(orderPtype ?? null);
  // filterText："|" 分隔为 OR 组，组内空格分隔为多关键词 AND，全部命中才显示
  const alts = (filterText ?? "").split("|").filter(Boolean);
  const hit = (r: SourceRow, cond: string) =>
    cond.split(/\s+/).filter(Boolean).every((t) => r.title.includes(t) || r.sub.includes(t));
  const list = src.rows.filter(
    (r) =>
      (alts.length === 0 || alts.some((a) => hit(r, a))) &&
      (!kw || r.title.includes(kw) || r.sub.includes(kw) || r.id.includes(kw)) &&
      // 产品类型过滤：归属该类型、或标记可共享给该类型的行都显示
      (!tag || r.ptag === tag || r.shareTo?.includes(tag))
  );

  const confirmManual = () => {
    const row: SourceRow = {
      id: multi ? `MANUAL-${Date.now().toString(36).toUpperCase()}` : "MANUAL",
      title: "手动填入（未关联采购订单）",
      sub: manualNote.trim() || "手工录入单价，待补采购单关联",
      meta: manualPrice.trim() || "0",
    };
    if (multi) { commitRows([...pickedRows, row]); }
    else { setPicked(row); onPick?.(row); }
    setOpen(false);
    setManual(false);
  };

  /** 多选实时提交：每次增删立即上抛最新清单（金额 / IP 查询条件实时联动，不依赖「完成」按钮） */
  const commitRows = (rows: SourceRow[]) => {
    setPickedRows(rows);
    onPickMulti?.(rows);
  };
  const toggleRow = (r: SourceRow) =>
    commitRows(
      pickedRows.some((x) => x.id === r.id)
        ? pickedRows.filter((x) => x.id !== r.id)
        : [...pickedRows, r]
    );

  return (
    <div ref={ref} className="relative">
      {multi && pickedRows.length > 0 ? (
        <div>
          <div className="flex flex-wrap items-center gap-1.5 rounded-[2px] border border-[#E5E6EB] bg-white px-2.5 py-1.5 text-sm">
            <span className="text-xs text-[#86909C]">已选 {pickedRows.length} 条：</span>
            {pickedRows.map((r) => (
              <span key={r.id} className={`flex items-center gap-1 rounded-[2px] px-1.5 py-0.5 text-xs ${r.id.startsWith("MANUAL") ? "border border-[#FFCF8B] bg-[#FFF7E8] text-[#FF7D00]" : "bg-[#E8F3FF] text-[#165DFF]"}`}>
                <span className="font-mono">{r.id}</span>
                <span className="max-w-40 truncate">{r.title.split("｜")[0]}</span>
                {r.id.startsWith("MANUAL") && <span className="text-[10px]">待补关联</span>}
                <button type="button" className="text-[#86909C] hover:text-[#F53F3F]"
                  onClick={() => commitRows(pickedRows.filter((x) => x.id !== r.id))}>✕</button>
              </span>
            ))}
            <button type="button" className="ml-auto shrink-0 text-xs text-[#165DFF] hover:underline"
              onClick={() => setOpen(true)}>
              更换
            </button>
          </div>
        </div>
      ) : picked ? (
        <div>
          <div className={`flex items-center gap-2 rounded-[2px] border px-2.5 py-1.5 text-sm ${picked.id.startsWith("MANUAL") ? "border-[#FFCF8B] bg-[#FFF7E8]" : "border-[#E5E6EB] bg-white"}`}>
            <span className="truncate text-[#1D2129]">{picked.title}</span>
            <span className="hidden truncate text-xs text-[#86909C] lg:inline">{picked.sub}</span>
            <button
              type="button"
              className="ml-auto shrink-0 text-xs text-[#165DFF] hover:underline"
              onClick={() => { setPicked(null); setOpen(true); }}>
              {picked.id.startsWith("MANUAL") ? "补关联档案" : "更换"}
            </button>
          </div>
          {picked.id.startsWith("MANUAL") && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-[2px] border border-[#FFCF8B] bg-[#FFF7E8] px-1.5 py-0.5 text-[#FF7D00]">待补关联 · 未关联采购订单/档案</span>
              <span className="text-[#86909C]">签订采购合同 / 资源建档后点「补关联档案」替换为真实档案；实际单价与手工价不一致时触发核算变更复核（P01-8）</span>
            </div>
          )}
          {picked.pool && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[#4E5969]">
                本线已售 {picked.pool.usedM}/{picked.pool.capacityM}M（余 {picked.pool.capacityM - picked.pool.usedM}M · 已承载 {picked.pool.orders.length} 单：
                {picked.pool.orders.map((o) => `${o.customer} ${o.bw}M`).join("、")}）；成本按归属产品类型出口池计收
              </span>
              <span className="rounded-[2px] bg-amber-100 px-1.5 py-0.5 text-[#FF7D00]">余量由工程师人工确认</span>
            </div>
          )}
          {picked.segments && (
            <div className="mt-1 space-y-0.5 text-xs">
              <div className="text-[#86909C]">向该运营商下 2 张采购单：</div>
              {picked.segments.map((s) => (
                <div key={s.label} className="text-[#4E5969]">
                  <span className="font-medium text-[#4E5969]">{s.label}</span>
                  <span> · {s.price} 元/Mbps·月</span>
                </div>
              ))}
            </div>
          )}
          {picked.boundIp && (
            <div className="mt-1 text-xs">
              <span className="rounded-[2px] bg-indigo-50 px-1.5 py-0.5 text-[#165DFF]">{picked.boundIp}</span>
              <span className="ml-1 text-[#86909C]">→ 自动带入「IP 地址使用费」</span>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-2 rounded-[2px] border border-[#E5E6EB] bg-white px-2.5 py-1.5 text-sm text-[#4E5969] hover:border-[#4080FF] hover:text-[#165DFF]">
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <span className="truncate">{label ?? `选择${src.name.replace(/（.*）/, "")}`}</span>
        </button>
      )}

      {open && pos && (
        <div className="fixed z-50 rounded-[4px] border border-[#E5E6EB] bg-white shadow-2xl"
          style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: `calc(100vh - ${pos.top + 8}px)` }}>
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-medium text-[#4E5969]">选择{src.name}</span>
            <button type="button" className="text-[#86909C] hover:text-[#4E5969]" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="p-2">
            <Input autoFocus value={kw} onChange={(e) => setKw(e.target.value)} placeholder="输入编号 / 名称 / 关键词过滤" className="h-8 text-sm" />
            {ptags && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <span className="text-[11px] text-[#86909C]">
                  {orderPtype ? <>已按本单产品类型「{orderPtype}」过滤（可切换）：</> : "按产品类型分类查询："}</span>
                <button type="button"
                  className={`rounded-[2px] px-1.5 py-0.5 text-[11px] ${!tag ? "bg-[#165DFF] text-white" : "bg-[#F2F3F5] text-[#4E5969] hover:bg-[#E5E6EB]"}`}
                  onClick={() => setTag(null)}>
                  全部
                </button>
                {ptags.map((t) => (
                  <button key={t} type="button"
                    className={`rounded-[2px] px-1.5 py-0.5 text-[11px] ${tag === t ? "bg-[#165DFF] text-white" : "bg-[#F2F3F5] text-[#4E5969] hover:bg-[#E5E6EB]"}`}
                    onClick={() => setTag(tag === t ? null : t)}>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="max-h-[45vh] overflow-y-auto">
            <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-xs text-[#86909C]">
                <th className="px-3 py-1.5 font-normal">编号</th>
                <th className="px-3 py-1.5 font-normal">名称</th>
                <th className="px-3 py-1.5 font-normal">详情</th>
                <th className="px-3 py-1.5 font-normal">当前负载</th>
                <th className="px-3 py-1.5 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <FragmentRow
                  key={r.id}
                  r={r}
                  selected={multi ? pickedRows.some((x) => x.id === r.id) : undefined}
                  onPick={() => {
                    if (multi) { toggleRow(r); return; }
                    setPicked(r); setOpen(false); onPick?.(r);
                  }}
                />
              ))}
              {list.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-[#86909C]">无匹配记录</td></tr>
              )}
            </tbody>
          </table>
          </div>
          <div className="border-t bg-[#FFF7E8] px-3 py-2 text-xs leading-5 text-[#FF7D00]">
            ⚠ 出口线路可多家客户共用，剩余可负载量<strong>不由系统自动判定</strong>：已售带宽明细仅供工程师人工评估（需考虑各客户峰值时段叠加），确认可承载后再选此条。
          </div>
          {multi && (
            <div className="border-t bg-[#E8F3FF] px-3 py-2">
              <button type="button" disabled={pickedRows.length === 0}
                className="rounded-[2px] bg-[#165DFF] px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:bg-gray-300"
                onClick={() => { setOpen(false); onPickMulti?.(pickedRows); }}>
                完成并关闭（已选 {pickedRows.length} 条，选择已实时计入金额）
              </button>
              <span className="ml-2 text-[11px] text-[#86909C]">订单含多条线路时逐条添加，可跨分类选择</span>
            </div>
          )}
          <div className="border-t px-3 py-2">
            {manual ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium text-[#4E5969]">手动填入（尚未签订采购订单）:</span>
                <Input value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} placeholder="单价（元）" className="h-7 w-24 text-sm" />
                <Input value={manualNote} onChange={(e) => setManualNote(e.target.value)} placeholder="备注：如「待与电信签订 CT-2026-xxx」" className="h-7 w-64 text-sm" />
                <button type="button" className="rounded-[2px] bg-[#165DFF] px-2.5 py-1 text-xs text-white hover:bg-blue-700"
                  onClick={confirmManual}>确定</button>
                <button type="button" className="text-xs text-[#86909C] hover:text-[#4E5969]" onClick={() => setManual(false)}>取消</button>
              </div>
            ) : (
              <button type="button" className="text-xs text-[#165DFF] hover:underline" onClick={() => setManual(true)}>
                无合适档案？手动填入（未关联采购订单时兜底，全程留痕）
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
