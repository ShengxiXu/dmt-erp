// 客户档案（/customer）：主数据独立维护页；特批申请 / 新建合同时只能选择，不手动录入
// 客户下挂「商机」（一个客户可有多个，特批必须挂在具体商机上），统一在 /opportunity 维护，本页提供跳转入口
import { useState } from "react";
import { Link } from "react-router";
import { CUSTOMERS, useOpps, OPPS_OF, type Customer } from "@/data/customers";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { RegionCascader } from "@/components/RegionCascader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LEVEL_CLS: Record<string, string> = { A: "bg-[#FFECE8] text-[#F53F3F]", B: "bg-[#FFF3E8] text-[#FF7D00]", C: "bg-[#F2F3F5] text-[#4E5969]" };

export default function Customer() {
  useOpps(); // 商机数实时刷新
  const [list, setList] = useState<Customer[]>(CUSTOMERS);
  const [kw, setKw] = useState("");
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);
  const shown = list.filter((c) => !kw || c.name.includes(kw) || c.contact.includes(kw) || (c.creditCode ?? "").includes(kw));

  const save = () => {
    if (!editing?.name) return;
    if (editing.id) {
      setList((ls) => ls.map((c) => (c.id === editing.id ? { ...c, ...editing } as Customer : c)));
    } else {
      setList((ls) => [{ ...editing, id: `CU-0${String(ls.length + 1).padStart(2, "0")}`, createdAt: "2026-10-27", status: editing.status ?? "潜在" } as Customer, ...ls]);
    }
    setEditing(null);
  };

  return (
    <ArcoShell breadcrumb="客户档案">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#1D2129]">客户档案</span>
            <Input className="w-56" placeholder="搜索客户 / 联系人 / 信用代码" value={kw} onChange={(e) => setKw(e.target.value)} />
          </div>
          <Button size="sm" onClick={() => setEditing({ name: "", creditCode: "", level: "C", industry: "", source: "", address: "", contact: "", contactTitle: "", phone: "", email: "", sales: "张弛", status: "潜在" })}>＋ 新建客户</Button>
        </div>

        <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">客户编码</th><th className="px-3 py-2">客户名称</th><th className="px-3 py-2">等级</th>
                <th className="px-3 py-2">联系人 / 电话</th><th className="px-3 py-2">行业</th><th className="px-3 py-2">归属销售</th>
                <th className="px-3 py-2">商机</th><th className="px-3 py-2">状态</th><th className="px-3 py-2">建档时间</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-[#F7F8FA]">
                  <td className="px-3 py-2.5 font-mono text-[#86909C]">{c.id}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-[#1D2129]">{c.name}</div>
                    {c.remark && <div className="mt-0.5 max-w-[200px] truncate text-[10px] text-[#86909C]" title={c.remark}>{c.remark}</div>}
                  </td>
                  <td className="px-3 py-2.5">{c.level ? <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] font-semibold ${LEVEL_CLS[c.level]}`}>{c.level} 级</span> : "—"}</td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{c.contact}{c.contactTitle ? `（${c.contactTitle}）` : ""} · {c.phone}</td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{c.industry}</td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{c.sales}</td>
                  <td className="px-3 py-2.5">
                    <Link to={`/opportunity?customer=${c.id}`} className="rounded-[2px] bg-[#F7FAFF] px-1.5 py-0.5 text-[11px] text-[#165DFF] hover:bg-[#BEDAFF]">
                      {OPPS_OF(c.id).length} 个商机
                    </Link>
                  </td>
                  <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${c.status === "合作中" ? "bg-[#E8F8F2] text-[#00B42A]" : "bg-[#F2F3F5] text-[#4E5969]"}`}>{c.status}</span></td>
                  <td className="px-3 py-2.5 text-[#86909C]">{c.createdAt}</td>
                  <td className="px-3 py-2.5 text-right"><button onClick={() => setEditing({ ...c })} className="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">编辑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          客户为主数据：在此统一建档维护（含开票抬头 / 税号，开票申请自动带出）；特批申请与合同起草时<strong>只能搜索选择</strong>客户，不允许手动录入，保证客户口径唯一（编码 CU-xxx）。客户下挂<strong>商机</strong>（CJ-2026-xxx）：一个客户可有多个生意机会，特批申请必须挂在具体商机上，点击「商机」列进入商机管理维护。
        </div>
      </main>

      {editing && (
        <CenterModal title={editing.id ? `编辑客户 · ${editing.id}` : "新建客户"} sub="客户主数据：带 * 为关键字段" width={560} onClose={() => setEditing(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">客户名称 <span className="text-[#F53F3F]">*</span></div>
                <Input autoFocus value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">统一社会信用代码</div>
                <Input placeholder="18 位，合同主体核验用" value={editing.creditCode ?? ""} onChange={(e) => setEditing({ ...editing, creditCode: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">客户等级</div>
                <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={editing.level ?? "C"} onChange={(e) => setEditing({ ...editing, level: e.target.value as Customer["level"] })}>
                  <option value="A">A（战略/大客户）</option><option value="B">B（成长客户）</option><option value="C">C（普通客户）</option>
                </select>
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">所属行业 <span className="text-[#F53F3F]">*</span></div>
                <Input value={editing.industry ?? ""} onChange={(e) => setEditing({ ...editing, industry: e.target.value })} />
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">客户来源</div>
                <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={editing.source ?? ""} onChange={(e) => setEditing({ ...editing, source: e.target.value })}>
                  <option value="">未选择</option>{["老客户续扩", "转介绍", "市场活动", "招标", "陌拜", "其他"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-xs text-[#4E5969]">办公地址（省 / 市 / 区 + 详细地址）</div>
              <RegionCascader withDetail value={editing.address ?? ""} onChange={(v) => setEditing({ ...editing, address: v })} />
            </div>
            <div className="rounded-[2px] border border-[#E5E6EB] bg-[#F7F8FA] p-3">
              <div className="mb-2 text-[11px] font-semibold text-[#4E5969]">开票信息（客户主数据自维护；开票申请自动带出，专票必须维护税号）</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-0.5 text-xs text-[#4E5969]">开票抬头</div>
                  <Input placeholder="默认同客户名称" value={editing.invoiceTitle ?? ""} onChange={(e) => setEditing({ ...editing, invoiceTitle: e.target.value })} />
                </div>
                <div>
                  <div className="mb-0.5 text-xs text-[#4E5969]">开票税号</div>
                  <Input placeholder="统一社会信用代码" value={editing.taxNo ?? ""} onChange={(e) => setEditing({ ...editing, taxNo: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">联系人 <span className="text-[#F53F3F]">*</span></div>
                <Input value={editing.contact ?? ""} onChange={(e) => setEditing({ ...editing, contact: e.target.value })} />
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">联系人职务</div>
                <Input placeholder="如 IT 部负责人" value={editing.contactTitle ?? ""} onChange={(e) => setEditing({ ...editing, contactTitle: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">联系电话 <span className="text-[#F53F3F]">*</span></div>
                <Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">邮箱</div>
                <Input value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">归属销售 <span className="text-[#F53F3F]">*</span></div>
                <Input value={editing.sales ?? ""} onChange={(e) => setEditing({ ...editing, sales: e.target.value })} />
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">客户状态</div>
                <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as Customer["status"] })}>
                  <option>潜在</option><option>合作中</option>
                </select>
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-xs text-[#4E5969]">备注</div>
              <textarea className="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5 text-sm" rows={2} placeholder="经营要点、敏感点（如账期要求）、关键决策人等" value={editing.remark ?? ""} onChange={(e) => setEditing({ ...editing, remark: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>取消</Button>
              <Button size="sm" onClick={save}>保存</Button>
            </div>
          </div>
        </CenterModal>
      )}
    </ArcoShell>
  );
}
