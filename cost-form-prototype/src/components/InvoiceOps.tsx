// 开票操作共用组件（财务中心「开票任务」页签与旧版开票管理页 /finance/invoices 共用，勿两边各自复制）
import { useState } from "react";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateInvoiceApp, fillInvoice, invoiceTitleOf, BIZ_CATS, type InvoiceApp } from "@/data/invoiceApps";
import { CONTRACTS } from "@/data/contracts";
import { DEMO_TODAY } from "@/data/settings";
import { ENTITY_BY_ID } from "@/data/entities";

/** 销方主体：从销售合同的签约主体带出（开票抬头 = 客户抬头，销方 = 我方主体） */
export const sellerOf = (contractNo: string) => CONTRACTS.find((c) => c.id === contractNo)?.entityId;

export const INV_MARK_CLS: Record<InvoiceApp["status"], string> = {
  待开票: "bg-[#FFF3E8] text-[#FF7D00]",
  开票中: "bg-[#E8F3FF] text-[#165DFF]",
  已开票: "bg-[#E8F8F2] text-[#00B42A]",
  已红冲: "bg-[#F2F3F5] text-[#86909C]",
};

// ---------- 编辑开票要素（待开票） ----------
export function InvoiceEditForm({ a, onClose }: { a: InvoiceApp; onClose: () => void }) {
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
export function InvoiceFillForm({ a, onClose }: { a: InvoiceApp; onClose: () => void }) {
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoicedAt, setInvoicedAt] = useState(DEMO_TODAY);
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
export function InvoicePrintSheet({ a, onClose }: { a: InvoiceApp; onClose: () => void }) {
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
