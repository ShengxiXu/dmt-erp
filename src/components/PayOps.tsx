// 收款操作共用组件（财务中心「收款核销」页签与旧版收款管理页 /finance/payments 共用，勿两边各自复制）
import { useState } from "react";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getInvoices, addPayment, invBalance, type InvStatus } from "@/data/receivables";

const PAYABLE: InvStatus[] = ["已发出", "部分收款", "逾期", "欠停"];

// ---------- 新增收款登记（提交即自动核销） ----------
export function PayForm({ onClose }: { onClose: () => void }) {
  const payableInvoices = getInvoices().filter((i) => PAYABLE.includes(i.status));
  const [invNo, setInvNo] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 16).replace("T", " "));
  const [method, setMethod] = useState<"银行转账" | "支付宝" | "微信" | "现金">("银行转账");
  const [referenceNo, setReferenceNo] = useState("");
  const [payerAccount, setPayerAccount] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const inv = payableInvoices.find((i) => i.invNo === invNo);

  const save = () => {
    if (!inv) return setErr("请选择账单（仅「已发出 / 部分收款 / 逾期 / 欠停」可选）");
    const e = addPayment({ invNo, customer: inv.customer, amount: Number(amount), paidAt, method, referenceNo: referenceNo || undefined, payerAccount: payerAccount || undefined });
    if (e) return setErr(e);
    onClose();
  };
  return (
    <CenterModal title="收款登记" sub="一笔收款对应一张账单；提交即自动核销：累计已收 ≥ 账单金额 → 已收讫；欠停账单足额收讫 → 自动生成复机工单" width={560} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div>
          <div className="mb-0.5 text-[#4E5969]">账单 <span className="text-[#F53F3F]">*</span></div>
          <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={invNo} onChange={(e) => { setInvNo(e.target.value); const i = payableInvoices.find((x) => x.invNo === e.target.value); if (i) setAmount(String(invBalance(i))); }}>
            <option value="">请选择…（仅已发出 / 部分收款 / 逾期 / 欠停）</option>
            {payableInvoices.map((i) => <option key={i.invNo} value={i.invNo}>{i.invNo} · {i.customer} · 余额 {invBalance(i).toLocaleString("zh-CN")} 元</option>)}
          </select>
          {inv && (
            <div className="mt-1.5 rounded-[2px] bg-[#F7F8FA] px-2 py-1.5 text-[11px] text-[#4E5969]">
              客户 {inv.customer} · 账单金额 {inv.amount.toLocaleString("zh-CN")} 元 · 已收 {inv.received.toLocaleString("zh-CN")} 元 · 未收余额 <strong className="text-[#FF7D00]">{invBalance(inv).toLocaleString("zh-CN")} 元</strong>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">收款金额（元）<span className="text-[#F53F3F]"> *</span></div>
            <Input type="number" min={0} placeholder="默认未收余额" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <div className="mt-0.5 text-[10px] text-[#86909C]">0 &lt; 金额 ≤ 未收余额，超过拒绝</div>
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">收款时间 <span className="text-[#F53F3F]">*</span></div>
            <Input value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">收款方式 <span className="text-[#F53F3F]">*</span></div>
            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
              {["银行转账", "支付宝", "微信", "现金"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">流水号 / 支付单号 {method === "银行转账" && <span className="text-[#F53F3F]">*</span>}</div>
            <Input placeholder={method === "银行转账" ? "银行流水号（必填）" : "可空"} value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
          </div>
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">付款方账户名（对账用，可空）</div>
          <Input placeholder="如 中海贸易有限公司" value={payerAccount} onChange={(e) => setPayerAccount(e.target.value)} />
        </div>
        {err && <div className="rounded-[2px] bg-[#FFECE8] px-2 py-1.5 text-[#F53F3F]">{err}</div>}
        <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={save}>提交并核销</Button>
        </div>
      </div>
    </CenterModal>
  );
}
