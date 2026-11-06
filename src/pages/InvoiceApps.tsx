// P04-0 开票管理（/finance/invoices）：应收账单 → 开票申请 → 开票执行（金蝶人工）→ 发票回填 → 客户凭票付款
// 边界：本系统是开票申请与状态台账的唯一来源；金蝶不做接口，业务支撑照「登记单」录金蝶后回填发票号；红冲/作废发生在金蝶，此处仅状态标记。
import { useState } from "react";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInvoiceApps, getInvoiceApps, updateInvoiceApp, startInvoicing, fillInvoice, redFlushInvoice, invoiceTitleOf, BIZ_CATS, type InvoiceApp, type InvAppStatus } from "@/data/invoiceApps";
import { CONTRACTS } from "@/data/contracts";
import { ENTITY_BY_ID, ENTITY_NAME } from "@/data/entities";

/** 销方主体：从销售合同的签约主体带出（开票抬头 = 客户抬头，销方 = 我方主体） */
const sellerOf = (contractNo: string) => CONTRACTS.find((c) => c.id === contractNo)?.entityId;

const STATUS_CLS: Record<InvAppStatus, string> = {
  待开票: "bg-[#FFF3E8] text-[#FF7D00]",
  开票中: "bg-[#E8F3FF] text-[#165DFF]",
  已开票: "bg-[#E8F8F2] text-[#00B42A]",
  已红冲: "bg-[#F2F3F5] text-[#86909C]",
};

// ---------- 编辑开票要素（待开票） ----------
function EditForm({ a, onClose }: { a: InvoiceApp; onClose: () => void }) {
  const [invType, setInvType] = useState(a.invType);
  const [format, setFormat] = useState(a.format);
  const [bizCat, setBizCat] = useState(a.bizCat);
  const [buyerNote, setBuyerNote] = useState(a.buyerNote ?? "");
  const [contact, setContact] = useState(a.contact ?? "");
  const [err, setErr] = useState<string | null>(null);
  return (
    <CenterModal title={`编辑开票要素 · ${a.apNo}`} sub={`${a.customer} · ${a.invNo} · 金额 ${a.amount.toLocaleString("zh-CN")} 元`} width={560} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">开票类别 <span className="text-[#F53F3F]">*</span></div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={invType} onChange={(e) => setInvType(e.target.value as InvoiceApp["invType"])}>
              <option>增值税专用发票（电子）</option><option>普通发票（电子）</option>
            </select>
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">发票格式 <span className="text-[#F53F3F]">*</span></div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={format} onChange={(e) => setFormat(e.target.value as InvoiceApp["format"])}>
              {["PDF", "OFD", "XML"].map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">业务类别 <span className="text-[#F53F3F]">*</span></div>
          <div className="flex flex-wrap gap-1.5">
            {BIZ_CATS.map((c) => (
              <button key={c} onClick={() => setBizCat(c)}
                className={`rounded-[2px] border px-2 py-1 ${bizCat === c ? "border-[#165DFF] bg-[#E8F3FF] text-[#165DFF]" : "border-[#E5E6EB] text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{c}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">对方要求开票备注</div>
          <Input placeholder="如：备注栏注明合同号" value={buyerNote} onChange={(e) => setBuyerNote(e.target.value)} />
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">对方联系人</div>
          <Input value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>
        <div className="rounded-[2px] bg-[#FFF7E8] px-2 py-1.5 text-[10px] leading-4 text-[#4E5969]">
          开票抬头 / 税号取自客户主数据（客户档案维护）：{invoiceTitleOf(a.customer).title} · {invoiceTitleOf(a.customer).taxNo || "（未维护税号，专票将无法开具）"}
        </div>
        {err && <div className="rounded-[2px] bg-[#FFECE8] px-2 py-1.5 text-[#F53F3F]">{err}</div>}
        <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={() => {
            const e = updateInvoiceApp(a.apNo, { invType, format, bizCat, buyerNote: buyerNote || undefined, contact: contact || undefined });
            if (e) return setErr(e);
            onClose();
          }}>保存</Button>
        </div>
      </div>
    </CenterModal>
  );
}

// ---------- 回填发票号（开票中 → 已开票） ----------
function FillForm({ a, onClose }: { a: InvoiceApp; onClose: () => void }) {
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoicedAt, setInvoicedAt] = useState("2026-11-05");
  const [err, setErr] = useState<string | null>(null);
  return (
    <CenterModal title={`回填发票号 · ${a.apNo}`} sub={`${a.customer} · 金额 ${a.amount.toLocaleString("zh-CN")} 元（金蝶已开票，录入发票信息）`} width={480} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div>
          <div className="mb-0.5 text-[#4E5969]">发票号码 <span className="text-[#F53F3F]">*</span></div>
          <Input placeholder="金蝶开票返回的发票号码" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">开票日期 <span className="text-[#F53F3F]">*</span></div>
          <Input type="date" value={invoicedAt} onChange={(e) => setInvoicedAt(e.target.value)} />
        </div>
        {err && <div className="rounded-[2px] bg-[#FFECE8] px-2 py-1.5 text-[#F53F3F]">{err}</div>}
        <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={() => {
            const e = fillInvoice(a.apNo, invoiceNo, invoicedAt);
            if (e) return setErr(e);
            onClose();
          }}>确认已开票</Button>
        </div>
      </div>
    </CenterModal>
  );
}

// ---------- 开票登记单（照此录金蝶；对齐线下「开票及业务信息登记表」版式） ----------
function PrintSheet({ a, onClose }: { a: InvoiceApp; onClose: () => void }) {
  const t = invoiceTitleOf(a.customer);
  const seller = ENTITY_BY_ID(sellerOf(a.contractNo));
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex border-b border-[#E5E6EB]">
      <div className="w-36 shrink-0 border-r border-[#E5E6EB] bg-[#F7F8FA] px-3 py-2 text-[#4E5969]">{k}</div>
      <div className="flex-1 px-3 py-2 text-[#1D2129]">{v}</div>
    </div>
  );
  return (
    <CenterModal title={`开票登记单 · ${a.apNo}`} sub="业务支撑照此录入金蝶 → 财务开票 → 回填发票号" width={640} onClose={onClose}>
      <div className="rounded-[2px] border border-[#E5E6EB] text-xs">
        <div className="border-b border-[#E5E6EB] bg-[#F7F8FA] px-3 py-2 text-center text-sm font-semibold text-[#1D2129]">开票及业务信息登记表</div>
        <Row k="销方名称" v={<strong>{seller.fullName}</strong>} />
        <Row k="销方税号" v={<span className="font-mono">{seller.taxNo}</span>} />
        <Row k="开票类别" v={a.invType} />
        <Row k="开票客户名称" v={t.title} />
        <Row k="开票税号" v={t.taxNo || "（未维护）"} />
        <Row k="业务类别" v={a.bizCat} />
        <Row k="开票金额" v={<strong>{a.amount.toLocaleString("zh-CN")} 元</strong>} />
        <Row k="开票账期" v={a.periodText} />
        <Row k="业务内容" v={a.items.join("；")} />
        <Row k="发票格式" v={a.format} />
        <Row k="合同号" v={a.contractNo} />
        <Row k="对方要求开票备注" v={a.buyerNote || "—"} />
        <Row k="联系人" v={a.contact || "—"} />
      </div>
      <div className="mt-3 flex justify-end">
        <Button size="sm" variant="outline" onClick={() => window.print()}>打印 / 另存 PDF</Button>
      </div>
    </CenterModal>
  );
}

export default function InvoiceApps() {
  useInvoiceApps();
  const [kw, setKw] = useState("");
  const [status, setStatus] = useState<"全部" | InvAppStatus>("全部");
  const [editing, setEditing] = useState<InvoiceApp | null>(null);
  const [filling, setFilling] = useState<InvoiceApp | null>(null);
  const [printing, setPrinting] = useState<InvoiceApp | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const apps = getInvoiceApps().filter((a) =>
    (status === "全部" || a.status === status) &&
    (!kw || a.apNo.includes(kw) || a.invNo.includes(kw) || a.customer.includes(kw) || (a.invoiceNo ?? "").includes(kw)));
  const counts = (["待开票", "开票中", "已开票", "已红冲"] as const).map((s) => ({ s, n: getInvoiceApps().filter((a) => a.status === s).length }));

  return (
    <ArcoShell breadcrumb="财务 / 开票管理">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-[#1D2129]">开票管理</span>
            <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
              {(["全部", "待开票", "开票中", "已开票", "已红冲"] as const).map((s) => (
                <button key={s} onClick={() => setStatus(s)}
                  className={`rounded-[2px] px-2.5 py-1 text-xs ${status === s ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>
                  {s}{s !== "全部" && counts.find((c) => c.s === s)!.n ? `（${counts.find((c) => c.s === s)!.n}）` : ""}
                </button>
              ))}
            </div>
            <Input className="w-56" placeholder="搜索申请单号 / 账单号 / 客户 / 发票号" value={kw} onChange={(e) => setKw(e.target.value)} />
          </div>
        </div>

        {msg && <div className="rounded-[4px] border border-[#BEDAFF] bg-[#E8F3FF] px-4 py-2 text-xs text-[#0E42D2]">{msg}</div>}

        <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">申请单号</th><th className="px-3 py-2">关联账单</th><th className="px-3 py-2">客户 / 合同</th>
                <th className="px-3 py-2">销方主体</th><th className="px-3 py-2">开票账期</th><th className="px-3 py-2">开票金额</th><th className="px-3 py-2">发票类别 / 业务类别</th>
                <th className="px-3 py-2">发票号 / 开票日期</th><th className="px-3 py-2">状态</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.apNo} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                  <td className="px-3 py-2.5 font-mono font-semibold text-[#165DFF]">{a.apNo}</td>
                  <td className="px-3 py-2.5 font-mono text-[#4E5969]">{a.invNo}</td>
                  <td className="px-3 py-2.5"><div className="font-medium text-[#1D2129]">{a.customer}</div><div className="text-[10px] text-[#86909C]">{a.contractNo}</div></td>
                  <td className="px-3 py-2.5 text-[#4E5969]" title={ENTITY_BY_ID(sellerOf(a.contractNo)).fullName}>{ENTITY_NAME(sellerOf(a.contractNo))}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[#4E5969]">{a.periodText}</td>
                  <td className="px-3 py-2.5 font-medium">{a.amount.toLocaleString("zh-CN")}</td>
                  <td className="px-3 py-2.5 text-[#4E5969]"><div>{a.invType}</div><div className="text-[10px] text-[#86909C]">{a.bizCat} · {a.format}</div></td>
                  <td className="px-3 py-2.5 font-mono text-[#4E5969]">{a.invoiceNo ? <div>{a.invoiceNo}<div className="text-[10px] text-[#86909C]">{a.invoicedAt}</div></div> : "—"}</td>
                  <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${STATUS_CLS[a.status]}`}>{a.status}</span></td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="flex justify-end gap-2">
                      {(a.status === "待开票" || a.status === "开票中") && (
                        <button className="text-[#165DFF] hover:underline" onClick={() => setPrinting(a)}>登记单</button>
                      )}
                      {a.status === "待开票" && (
                        <>
                          <button className="text-[#165DFF] hover:underline" onClick={() => setEditing(a)}>编辑要素</button>
                          <button className="text-[#00B42A] hover:underline" onClick={() => {
                            const e = startInvoicing(a.apNo);
                            setMsg(e ? `✗ ${e}` : `✓ ${a.apNo} 已登记开票（开票中），业务支撑照「登记单」录金蝶，开完票后回填发票号`);
                          }}>登记开票</button>
                        </>
                      )}
                      {a.status === "开票中" && (
                        <button className="text-[#00B42A] hover:underline" onClick={() => setFilling(a)}>回填发票号</button>
                      )}
                      {a.status === "已开票" && (
                        <button className="text-[#F53F3F] hover:underline" onClick={() => {
                          if (confirm(`标记发票红冲（${a.invoiceNo}）？红冲/作废在金蝶完成，此处仅状态标记；关联应收 ${a.invNo} 走收款管理红冲审批。`)) {
                            const e = redFlushInvoice(a.apNo);
                            setMsg(e ? `✗ ${e}` : `✓ ${a.apNo} 已标记红冲`);
                          }
                        }}>红冲</button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
              {!apps.length && <tr><td colSpan={10} className="px-3 py-10 text-center text-[#C9CDD4]">无匹配开票申请（账单「通过并发出」后自动生成）</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          ① 应收账单「通过并发出」时自动生成开票申请（待开票），开票抬头 / 税号取自客户主数据（客户档案维护）；
          ② 业务支撑「登记开票」后照「登记单」录入金蝶，财务在金蝶开票；<strong className="text-[#4E5969]">金蝶不做接口</strong>；
          ③ 开完票在系统回填发票号码 → 已开票，客户凭票付款，收款核销在收款管理；
          ④ 红冲 / 作废在金蝶完成，此处仅状态标记，关联应收走收款管理红冲审批（AP-04）；
          ⑤ 月末按「发票号 + 金额 + 客户」与财务对账。提成比例 / 积分不属本系统。
        </div>
      </main>
      {editing && <EditForm a={editing} onClose={() => setEditing(null)} />}
      {filling && <FillForm a={filling} onClose={() => setFilling(null)} />}
      {printing && <PrintSheet a={printing} onClose={() => setPrinting(null)} />}
    </ArcoShell>
  );
}
