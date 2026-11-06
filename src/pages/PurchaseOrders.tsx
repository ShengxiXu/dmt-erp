// P08 采购单列表（/purchase/orders）
// 需求 → 采购单 → 审批 → 下单/合同价 → 到货验收 → 入库建档 全流程在详情页（PurchaseOrderDetail）操作。
import { useState } from "react";
import { Link } from "react-router";
import { usePurchaseFlow, getOrders, poTotal, type POStatus } from "@/data/purchaseFlow";
import ArcoShell from "@/components/ArcoShell";
import { Input } from "@/components/ui/input";

const STATUS_CLS: Record<POStatus, string> = {
  草稿: "bg-[#F2F3F5] text-[#4E5969]",
  待审批: "bg-[#FFF3E8] text-[#FF7D00]",
  已下单: "bg-[#E8F3FF] text-[#165DFF]",
  部分到货: "bg-[#FEF0FF] text-[#722ED1]",
  验收完成: "bg-[#E8F8F2] text-[#00B42A]",
};

export default function PurchaseOrders() {
  usePurchaseFlow();
  const [kw, setKw] = useState("");
  const [status, setStatus] = useState<"全部" | POStatus>("全部");
  const shown = getOrders().filter((p) =>
    (status === "全部" || p.status === status) &&
    (!kw || p.poNo.includes(kw) || p.supplier.includes(kw) || p.lines.some((l) => l.spec.includes(kw)) || (p.contractNo ?? "").includes(kw)));

  return (
    <ArcoShell breadcrumb="采购管理 / 采购单">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-[#1D2129]">采购单</span>
            <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
              {(["全部", "草稿", "待审批", "已下单", "部分到货", "验收完成"] as const).map((s) => (
                <button key={s} onClick={() => setStatus(s)}
                  className={`rounded-[2px] px-2.5 py-1 text-xs ${status === s ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{s}</button>
              ))}
            </div>
            <Input className="w-56" placeholder="搜索采购单号 / 供应商 / 明细规格 / 合同号" value={kw} onChange={(e) => setKw(e.target.value)} />
          </div>
          <span className="text-[11px] text-[#86909C]">新建采购单：由 <Link to="/purchase/reqs" className="text-[#165DFF] hover:underline">采购需求</Link> 勾选「转采购单」生成</span>
        </div>

        <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">采购单号</th><th className="px-3 py-2">供应商</th><th className="px-3 py-2">引用需求</th>
                <th className="px-3 py-2">明细</th><th className="px-3 py-2">未税总额</th><th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">验收进度</th><th className="px-3 py-2">采购合同</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const totalQty = p.lines.reduce((s, l) => s + l.quantity, 0);
                const recvQty = p.lines.reduce((s, l) => s + l.receivedQty, 0);
                return (
                  <tr key={p.poNo} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                    <td className="px-3 py-2.5 font-mono font-semibold text-[#165DFF]">{p.poNo}
                      {p.version > 1 && <span className="ml-1 text-[10px] text-[#86909C]">v{p.version}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-[#4E5969]">{p.supplier}</td>
                    <td className="px-3 py-2.5 font-mono text-[#86909C]">{p.reqNos.length ? p.reqNos.join("、") : "—"}</td>
                    <td className="max-w-[280px] px-3 py-2.5">
                      <div className="truncate text-[#1D2129]" title={p.lines.map((l) => `${l.spec} × ${l.quantity}`).join("；")}>
                        {p.lines.map((l) => `${l.spec} × ${l.quantity}`).join("；")}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[#1D2129]">¥ {poTotal(p).toLocaleString("zh-CN")}</td>
                    <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${STATUS_CLS[p.status]}`}>{p.status}</span></td>
                    <td className="px-3 py-2.5">
                      {recvQty > 0 || p.status === "已下单" ? (
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#F2F3F5]">
                            <div className="h-full bg-[#165DFF]" style={{ width: `${totalQty ? Math.round((recvQty / totalQty) * 100) : 0}%` }} />
                          </div>
                          <span className="text-[10px] text-[#86909C]">{recvQty}/{totalQty}</span>
                        </div>
                      ) : <span className="text-[#C9CDD4]">—</span>}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[#86909C]">{p.contractNo ?? "未录入"}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Link to={`/purchase/orders/${p.poNo}`} className="text-[#165DFF] hover:underline">
                        {p.inboundDone ? "查看" : p.status === "草稿" ? "编辑/提交" : "办理"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!shown.length && <tr><td colSpan={9} className="px-3 py-10 text-center text-[#C9CDD4]">{kw || status !== "全部" ? "无匹配采购单" : "暂无采购单"}</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          ① 采购单由需求单汇总生成（草稿态可改明细与单价），提交后锁定进入审批；② 默认审批链为采购主管，
          <strong className="text-[#4E5969]">含税总额 ≥ 10 万自动加签管理层</strong>；③ 批准下单后录入采购合同价（作为供应商对账的自动核对基准）；
          ④ 到货支持<strong className="text-[#4E5969]">分批验收</strong>，合格部分先行入库、不合格差异登记退回；⑤ 全部验收完成后入库建档，资源正式可售，挂起工单自动恢复。
        </div>
      </main>
    </ArcoShell>
  );
}
