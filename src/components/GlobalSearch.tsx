// 全局搜索（顶栏 ⌘K / Ctrl+K）：跨客户 / 商机 / 特批 / 合同 / 核算单 / 开通工单 / 账单 / 采购单检索，选中直达页面
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Search } from "lucide-react";
import { CUSTOMERS, getOpps } from "@/data/customers";
import { CONTRACTS, SPECIALS } from "@/data/contracts";
import { SHEETS } from "@/data/sheets";
import { WORK_ORDERS } from "@/data/delivery";
import { RECEIVABLES } from "@/data/receivables";
import { getOrders } from "@/data/purchaseFlow";

interface Hit {
  group: string;
  title: string;
  sub: string;
  to: string;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/** 构建全量检索索引（数据为内存台账，量小，直接每次过滤） */
function buildIndex(): Hit[] {
  const hits: Hit[] = [];
  CUSTOMERS.forEach((c) => hits.push({ group: "客户", title: c.name, sub: `${c.id} · ${c.contact} ${c.phone}`, to: "/customer" }));
  getOpps().forEach((d) => hits.push({ group: "商机", title: `${d.id} ${d.name}`, sub: `${d.products.map((p) => p.ptype).join("+")} · ${d.stage}`, to: `/opportunity` }));
  SPECIALS.forEach((s) => hits.push({ group: "特批单", title: s.id, sub: `${s.customer} · 折扣 ${s.discount}% · ${s.status}`, to: "/special" }));
  CONTRACTS.forEach((c) => hits.push({ group: "合同", title: c.id, sub: `${c.customer} · ${c.lines.map((l) => l.ptype).join("+")} · ${c.status}`, to: `/contract/detail?id=${c.id}` }));
  SHEETS.forEach((s) => hits.push({ group: "核算单", title: s.id, sub: `${s.customer} · ${s.status}`, to: `/approval?id=${s.id}` }));
  WORK_ORDERS.forEach((w) => hits.push({ group: "开通工单", title: w.id, sub: `${w.customer} · ${w.contract}`, to: `/delivery/detail?id=${w.id}` }));
  RECEIVABLES.forEach((r) => hits.push({ group: "账单", title: r.invNo, sub: `${r.customer} · ${r.amount.toLocaleString("zh-CN")} 元 · ${r.status}`, to: "/finance?tab=ledger" }));
  getOrders().forEach((o) => hits.push({ group: "采购单", title: o.poNo, sub: `${o.supplier ?? ""} · ${o.status}`, to: `/purchase/orders/${o.poNo}` }));
  return hits;
}

const GROUP_ORDER = ["客户", "商机", "合同", "核算单", "开通工单", "账单", "特批单", "采购单"];
const GROUP_CLS: Record<string, string> = {
  客户: "bg-[#E8F3FF] text-[#165DFF]", 商机: "bg-[#F0EBFF] text-[#7B61FF]", 合同: "bg-[#E8F8F2] text-[#00B42A]",
  核算单: "bg-[#FFF3E8] text-[#FF7D00]", 开通工单: "bg-[#E8F8F2] text-[#0D9488]", 账单: "bg-[#FFF7E8] text-[#B25E00]",
  特批单: "bg-[#F2F3F5] text-[#4E5969]", 采购单: "bg-[#E8F3FF] text-[#0D9488]",
};

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [kw, setKw] = useState("");
  const [cursor, setCursor] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); setKw(""); setCursor(0); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const idx = buildIndex();
    if (!kw.trim()) return idx.slice(0, 12); // 空关键词：展示最近数据（索引前 12 条）
    const q = norm(kw);
    return idx.filter((h) => norm(`${h.title} ${h.sub}`).includes(q)).slice(0, 20);
  }, [kw]);

  useEffect(() => setCursor(0), [kw]);

  // 按分组排序 + 游标安全
  const sorted = useMemo(() => [...results].sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)), [results]);
  const clamped = Math.min(cursor, Math.max(sorted.length - 1, 0));

  const go = (h: Hit) => { setOpen(false); setKw(""); navigate(h.to); };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={boxRef} className="relative">
      <button onClick={() => { setOpen(true); setKw(""); }}
        className="hidden h-9 w-72 items-center gap-2 whitespace-nowrap rounded-full border border-[#E5E6EB] bg-[#F7F8FA] px-3.5 text-[13px] text-[#86909C] transition-colors hover:border-[#C9CDD4] md:flex">
        <Search size={14} />
        搜索客户 / 合同 / 核算单 / 工单
        <span className="ml-auto rounded-[4px] border border-[#E5E6EB] bg-white px-1.5 py-0.5 text-[10px] text-[#C9CDD4]">Ctrl K</span>
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[480px] overflow-hidden rounded-[8px] border border-[#E5E6EB] bg-white shadow-2xl">
          <div className="flex items-center gap-2 border-b border-[#F2F3F5] px-4 py-3">
            <Search size={15} className="text-[#86909C]" />
            <input autoFocus value={kw} onChange={(e) => setKw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setCursor(Math.min(clamped + 1, sorted.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setCursor(Math.max(clamped - 1, 0)); }
                if (e.key === "Enter" && sorted[clamped]) go(sorted[clamped]);
              }}
              placeholder="输入客户名 / 单号 / 合同号 / 工单号…"
              className="w-full bg-transparent text-[13px] text-[#1D2129] outline-none placeholder:text-[#C9CDD4]" />
            <span className="rounded-[4px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] text-[#86909C]">Esc</span>
          </div>
          <div className="max-h-[380px] overflow-y-auto py-1">
            {sorted.map((h, i) => (
              <button key={i} onClick={() => go(h)} onMouseEnter={() => setCursor(i)}
                className={`flex w-full items-center gap-2.5 px-4 py-2 text-left ${i === clamped ? "bg-[#F0F5FF]" : ""}`}>
                <span className={`shrink-0 rounded-[2px] px-1.5 py-0.5 text-[10px] ${GROUP_CLS[h.group]}`}>{h.group}</span>
                <span className="truncate text-[13px] text-[#1D2129]">{h.title}</span>
                <span className="ml-auto truncate pl-2 text-[11px] text-[#86909C]">{h.sub}</span>
              </button>
            ))}
            {!sorted.length && <div className="px-4 py-8 text-center text-[12px] text-[#C9CDD4]">没有匹配「{kw}」的单据</div>}
          </div>
          <div className="flex gap-3 border-t border-[#F2F3F5] bg-[#FBFBFC] px-4 py-1.5 text-[10px] text-[#C9CDD4]">
            <span>↑↓ 移动</span><span>Enter 打开</span><span>Esc 关闭</span>
          </div>
        </div>
      )}
    </div>
  );
}
