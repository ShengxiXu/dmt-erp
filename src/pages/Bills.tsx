// 供应商账单：采购侧支出凭证 → 费用归类（成本条目）→ 直接/间接口径（间接归集成本中心）→ 被核算单引用 → 合同
// 设计原则：录入只需选「费用归类」一个业务字段，归属自动带出；与订单的关联由系统在月结/核算时自动建立，全程无需手选订单。
import { useMemo, useState } from "react";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bills, useBills, addBill, setBillStatus, billCenter, type SupplierBill, type BillStatus } from "@/data/bills";
import { getCostItems } from "@/data/costItems";
import { getContracts } from "@/data/purchase";
import { SHEET_ENTRIES, SHEETS, fmt } from "@/data/sheets";
import { R1_ROWS, R2_ROWS, R3_ROWS, R4_ROWS } from "@/data/resources";

/** 费用归类的取数来源 → 资源档案（决定账单可关联哪些资源；间接/字典类无映射 = 无需关联资源） */
const SRC_ARCHIVE: Record<string, string> = {
  linebase: "r2",   // 基础线路
  lineinternet: "r1", // 出口线路档案
  lineip: "r3",     // IP 地址段
  device: "r4",     // 设备库存
  asset: "r4",      // 设备资产
  material: "r4",   // 物料库存
  cabinet: "r1",    // 机柜
  port: "r1",       // 上联端口
  otu: "r1",        // OTU 端口台账
};
const ARCHIVE_NAME: Record<string, string> = { r1: "R1 出口资源", r2: "R2 基础线路", r3: "R3 IP 地址", r4: "R4 设备库存" };
const ARCHIVE_ROWS: Record<string, { id: string; name?: string }[]> = { r1: R1_ROWS, r2: R2_ROWS, r3: R3_ROWS, r4: R4_ROWS };

/** 费用归类 → 可关联的资源选项（无映射返回 null = 间接/字典类，无需关联资源） */
function resourceOptions(costItemKey: string): { key: string; label: string }[] | null {
  const src = getCostItems().find((i) => i.key === costItemKey)?.sourceArchive;
  if (!src) return null;
  const ak = SRC_ARCHIVE[src];
  if (!ak) return null;
  return (ARCHIVE_ROWS[ak] ?? []).map((r) => ({ key: r.id, label: `${ARCHIVE_NAME[ak]} · ${r.id}${r.name ? ` ${r.name}` : ""}` }));
}

const STATUS_COLOR: Record<BillStatus, string> = {
  待入账: "bg-[#FFF3E8] text-[#FF7D00]",
  已入账: "bg-[#E8F3FF] text-[#165DFF]",
  已月结: "bg-[#E8F8F2] text-[#00B42A]",
};
const FILTERS: ("全部" | BillStatus)[] = ["全部", "待入账", "已入账", "已月结"];

/** 账单被哪些核算单引用（账本耗用单的来源单号 = 账单号） */
function billRefs(b: SupplierBill) {
  const hit = SHEET_ENTRIES.filter((e) => e.srcType === "账本耗用单" && e.srcId === b.id);
  return hit.map((e) => {
    const sheet = SHEETS.find((s) => s.id === "CE-2026-1008")!; // 演示台账中条目归属该核算单
    return { sheetId: sheet.id, customer: sheet.customer, contract: sheet.contract, item: e.item, amount: e.amount };
  });
}

export default function Bills() {
  useBills();
  const [f, setF] = useState<(typeof FILTERS)[number]>("全部");
  const [kw, setKw] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);

  const rows = useMemo(() => bills.filter((b) => {
    if (f !== "全部" && b.status !== f) return false;
    if (!kw) return true;
    const item = getCostItems().find((i) => i.key === b.costItemKey);
    return b.id.includes(kw) || b.supplier.includes(kw) || b.period.includes(kw) || (item?.name ?? "").includes(kw) || (b.poNo ?? "").includes(kw) || (b.contractNo ?? "").includes(kw);
  }), [f, kw]);
  const stats = useMemo(() => ({
    wait: bills.filter((b) => b.status === "待入账").length,
    inAmt: bills.filter((b) => b.status !== "待入账").reduce((s, b) => s + b.amount, 0),
    settle: bills.filter((b) => b.status === "已月结").length,
  }), []);

  const det = detail ? bills.find((b) => b.id === detail) : null;

  return (
    <ArcoShell breadcrumb="供应商账单">
      <main className="space-y-4 p-6">
        {/* 关联链路说明（新手引导，一句话讲清账单和订单的关系） */}
        <section className="flex flex-wrap items-center gap-2 rounded-[4px] border border-[#BEDAFF] bg-[#F2F7FF] px-4 py-2.5 text-xs text-[#4E5969]">
          <span className="font-medium text-[#165DFF]">账单怎么关联到订单：</span>
          <span>录入账单，选一个「费用归类」</span><span className="text-[#C9CDD4]">→</span>
          <span>系统自动判断口径：专属成本随单算，间接费用归入对应成本中心</span><span className="text-[#C9CDD4]">→</span>
          <span>核算单按归属引用账单（来源单号 = 账单号）</span><span className="text-[#C9CDD4]">→</span>
          <span>核算单通过审批后挂在合同上。全程不用手选订单。</span>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          {[
            { t: "待入账", v: stats.wait, u: "张", c: "text-[#FF7D00]" },
            { t: "已入账金额（本期）", v: fmt(stats.inAmt), u: "元", c: "text-[#165DFF]" },
            { t: "已月结", v: stats.settle, u: "张", c: "text-[#00B42A]" },
          ].map((k) => (
            <div key={k.t} className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
              <div className="text-xs text-[#86909C]">{k.t}</div>
              <div className={`mt-1 text-2xl font-bold ${k.c}`}>{k.v} <span className="text-xs font-normal text-[#86909C]">{k.u}</span></div>
            </div>
          ))}
        </section>

        <section className="rounded-[4px] border border-[#E5E6EB] bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
            <span className="text-sm font-semibold">供应商账单</span>
            <div className="ml-4 flex gap-1">
              {FILTERS.map((x) => (
                <button key={x} onClick={() => setF(x)}
                  className={`rounded-[2px] px-2.5 py-1 text-xs ${f === x ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>
                  {x}
                </button>
              ))}
            </div>
            <Input className="ml-2 w-48" placeholder="搜索账单号 / 供应商 / 费用归类" value={kw} onChange={(e) => setKw(e.target.value)} />
            <Button size="sm" className="ml-auto" onClick={() => setShowAdd(true)}>录入账单</Button>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">账单号</th><th className="px-3 py-2">供应商</th><th className="px-3 py-2">账期</th>
                <th className="px-3 py-2">费用归类</th><th className="px-3 py-2">记到哪</th>
                <th className="px-3 py-2 text-right">金额（元）</th><th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">被引用</th><th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const item = getCostItems().find((i) => i.key === b.costItemKey);
                const refs = billRefs(b);
                return (
                  <tr key={b.id} className="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]" onClick={() => setDetail(b.id)}>
                    <td className="px-3 py-2.5 font-mono font-medium text-[#165DFF]">{b.id}</td>
                    <td className="px-3 py-2.5 font-medium text-[#1D2129]">{b.supplier}</td>
                    <td className="px-3 py-2.5 font-mono text-[#4E5969]">{b.period}</td>
                    <td className="px-3 py-2.5 text-[#4E5969]">{item?.name ?? b.costItemKey}{b.poNo && <div className="text-[10px] text-[#86909C]">采购单 {b.poNo}</div>}{b.contractNo && <div className="text-[10px] text-[#86909C]">合同 {b.contractNo}</div>}</td>
                    <td className="px-3 py-2.5"><span className="rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] text-[#4E5969]">{billCenter(b.costItemKey)}</span></td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmt(b.amount)}</td>
                    <td className="px-3 py-2.5"><Badge className={`${STATUS_COLOR[b.status]} hover:bg-inherit`}>{b.status}</Badge></td>
                    <td className="px-3 py-2.5 text-[#4E5969]">{refs.length ? `${refs.length} 条核算行` : "—"}</td>
                    <td className="px-3 py-2.5 text-[#C9CDD4]">详情 →</td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={9} className="px-3 py-10 text-center text-[#86909C]">无匹配账单</td></tr>}
            </tbody>
          </table>
        </section>
      </main>

      {showAdd && <AddModal onClose={() => setShowAdd(false)} />}
      {det && <DetailModal bill={det} onClose={() => setDetail(null)} />}
    </ArcoShell>
  );
}

// ---------- 录入账单：必填只有 4 项，费用归类决定口径与归属 ----------
function AddModal({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ supplier: "", period: "2026-10", costItemKey: "", amount: "", poNo: "", contractNo: "", resRef: "", note: "" });
  const items = getCostItems().filter((i) => i.category === "资源驱动" || i.settleType === "间接");
  const needRes = f.costItemKey ? resourceOptions(f.costItemKey) !== null : false;
  const ok = f.supplier.trim() && f.period && f.costItemKey && Number(f.amount) > 0 && (!needRes || !!f.resRef);

  const save = () => {
    addBill({
      supplier: f.supplier.trim(),
      period: f.period,
      costItemKey: f.costItemKey,
      amount: Number(f.amount),
      poNo: f.poNo.trim() || undefined,
      contractNo: f.contractNo.trim() || undefined,
      resRef: f.resRef.trim() || undefined,
      note: f.note.trim() || undefined,
    });
    onClose();
  };

  return (
    <CenterModal title="录入供应商账单" sub="必填只有 4 项：供应商、账期、金额、费用归类。记到哪由费用归类自动带出，不用手选。" onClose={onClose} width={560}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">供应商 <span className="text-[#F53F3F]">*</span></div>
            <Input placeholder="如：上海电信" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">账期 <span className="text-[#F53F3F]">*</span></div>
            <Input type="month" value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })} />
          </div>
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">费用归类（成本条目）<span className="text-[#F53F3F]">*</span></div>
          <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.costItemKey} onChange={(e) => setF({ ...f, costItemKey: e.target.value })}>
            <option value="">选择这笔费用属于哪类成本</option>
            {items.map((i) => <option key={i.key} value={i.key}>{i.name}（{i.settleType === "间接" ? "间接" : i.category}）</option>)}
          </select>
          {f.costItemKey && (
            <div className="mt-1.5 rounded-[2px] bg-[#F7F8FA] px-2.5 py-1.5 text-[11px] text-[#4E5969]">
              记到：<span className="font-medium text-[#165DFF]">{billCenter(f.costItemKey)}</span>
              <span className="ml-2 text-[#86909C]">核算单按归属切分时会引用本账单</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">金额（元）<span className="text-[#F53F3F]">*</span></div>
            <Input type="number" placeholder="0.00" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">关联采购单号（一次性类）</div>
            <Input placeholder="设备 / 按单线路填 PO；月租类留空" value={f.poNo} onChange={(e) => setF({ ...f, poNo: e.target.value })} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">关联采购合同（周期性月租类）</div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.contractNo} onChange={(e) => setF({ ...f, contractNo: e.target.value })}>
              <option value="">月租类账单选合同，便于按合同对账</option>
              {getContracts().filter((c) => c.billing === "周期性月租").map((c) => (
                <option key={c.id} value={c.id}>{c.id}（{c.name}）</option>
              ))}
            </select>
          </div>
        </div>
        {(() => {
          const opts = f.costItemKey ? resourceOptions(f.costItemKey) : null;
          if (!f.costItemKey) return null; // 先选费用归类，再决定是否要选资源
          if (opts === null) {
            return (
              <div className="rounded-[2px] bg-[#F7F8FA] px-2.5 py-1.5 text-[11px] text-[#86909C]">
                该费用归类属于间接/字典类，账单按归属成本中心归集即可，无需关联具体资源。
              </div>
            );
          }
          return (
            <div>
              <div className="mb-0.5 text-[#4E5969]">关联资源 <span className="text-[#F53F3F]">*</span><span className="ml-1 text-[#86909C]">（专属资源类账单必填，已按费用归类过滤）</span></div>
              <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.resRef} onChange={(e) => setF({ ...f, resRef: e.target.value })}>
                <option value="">选择这笔费用为哪个资源付的</option>
                {opts.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
          );
        })()}
        <div>
          <div className="mb-0.5 text-[#4E5969]">备注（可空）</div>
          <Input placeholder="如：整柜电力月租，待核对" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button disabled={!ok} onClick={save}>保存（待入账）</Button>
        </div>
      </div>
    </CenterModal>
  );
}

// ---------- 账单详情：引用链（被哪些核算单 / 合同使用） ----------
function DetailModal({ bill, onClose }: { bill: SupplierBill; onClose: () => void }) {
  const item = getCostItems().find((i) => i.key === bill.costItemKey);
  const refs = billRefs(bill);
  return (
    <CenterModal title={`账单 ${bill.id}`} sub={`${bill.supplier} · ${bill.period}`} onClose={onClose} width={620}>
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-[2px] bg-[#F7F8FA] p-3 text-[#4E5969]">
          <span>金额：<b className="font-mono text-[#1D2129]">{fmt(bill.amount)} 元</b></span>
          <span>状态：<Badge className={`${STATUS_COLOR[bill.status]} hover:bg-inherit`}>{bill.status}</Badge></span>
          <span>费用归类：{item?.name ?? bill.costItemKey}</span>
          <span>记到哪：{billCenter(bill.costItemKey)}</span>
          {bill.poNo && <span>采购单号：{bill.poNo}</span>}
          {bill.contractNo && <span>采购合同：{bill.contractNo}</span>}
          {bill.resRef && <span>关联资源：{bill.resRef}</span>}
          {bill.note && <span className="col-span-2">备注：{bill.note}</span>}
        </div>

        <div>
          <div className="mb-1 font-medium text-[#1D2129]">被哪些核算单引用（账本耗用单的来源）</div>
          {refs.length === 0 && <div className="text-[#86909C]">暂未被引用。账单「入账」后，核算单填报按归属切分时即可选择本账单。</div>}
          {refs.map((r, i) => (
            <div key={i} className="mb-1.5 flex items-center justify-between rounded-[2px] border border-[#E5E6EB] px-3 py-2">
              <div>
                <span className="font-mono text-[#165DFF]">{r.sheetId}</span>
                <span className="ml-2 text-[#1D2129]">{r.customer}</span>
                <span className="ml-2 text-[#86909C]">{r.contract}</span>
                <div className="mt-0.5 text-[#86909C]">核算行：{r.item} · <span className="font-mono">{fmt(r.amount)} 元</span></div>
              </div>
              <span className="text-[#C9CDD4]">→ 合同</span>
            </div>
          ))}
        </div>

        {bill.status === "待入账" && (
          <div className="flex items-center justify-end gap-2 border-t border-[#F2F3F5] pt-3">
            <span className="mr-auto text-[10px] text-[#86909C]">
              入账后归集：<span className="font-medium text-[#165DFF]">{billCenter(bill.costItemKey)}</span>，计入该中心 {bill.period} 真实费用（月结对比预估切分）
            </span>
            <Button variant="outline" onClick={onClose}>关闭</Button>
            <Button onClick={() => {
              const cc = billCenter(bill.costItemKey);
              if (!confirm(`确认入账？\n\n账单 ${bill.id}（¥ ${fmt(bill.amount)}）将归集至：${cc}\n月结时计入该中心 ${bill.period} 真实费用。`)) return;
              setBillStatus(bill.id, "已入账");
              onClose();
            }}>确认入账</Button>
          </div>
        )}
      </div>
    </CenterModal>
  );
}
