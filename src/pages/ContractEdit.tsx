// 合同起草（/contract/edit）—— 合同与订单合二为一；销售发起，提交后由业务支撑部出具正式合同并上传
// 分步：① 合同要素（选择客户 / 关联特批单带出锁定折扣）→ ② 订单行（规格来自产品基础数据选项）→ ③ 确认并提交申请
import { useState } from "react";
import { useNavigate } from "react-router";
import { SPECIALS, CONTRACTS, checkDiscount, fmtMoney, initContractApproval, type OrderLine } from "@/data/contracts";
import { GET_OPP, CUSTOMERS, OPPS_OF } from "@/data/customers";
import { ENTITIES, ENTITY_BY_ID } from "@/data/entities";
import { useCatalog, CATS, PTYPES, GET_TYPE, SPEC_FIELDS, PLANS, buildSpec, missingRequired } from "@/data/products";
import CustomerSelect from "@/components/CustomerSelect";
import ArcoShell from "@/components/ArcoShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const emptyLine = (): OrderLine => ({ cat: CATS()[0] ?? "", ptype: PTYPES(CATS()[0] ?? "")[0] ?? "", spec: "", specs: {}, price: 0 });

export default function ContractEdit() {
  useCatalog(); // 订阅产品目录：产品定义页的改动实时反映到订单行
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [base, setBase] = useState({
    customer: "", dealId: "", specialId: "", discount: "0", terms: "", entityId: "ENT-HQ",
    seal: "online" as "online" | "offline", pay: "月付" as "月付" | "季度付" | "半年付" | "年付",
    start: "2026-11-01", end: "2027-10-31",
  });
  const [lines, setLines] = useState<OrderLine[]>([emptyLine()]);

  const discountErr = checkDiscount(Number(base.discount) || 0, base.specialId || undefined);
  const amount = lines.reduce((s, l) => s + (Number(l.price) || 0), 0);
  /** 当前客户名下可签合同的商机（跟进中 / 已报价 / 赢单；输单关闭不可选） */
  const custId = CUSTOMERS.find((c) => c.name === base.customer)?.id ?? "";
  const oppsOfCust = OPPS_OF(custId).filter((d) => d.stage !== "输单");
  const canNext1 = base.customer && base.dealId && !discountErr;
  const entity = ENTITY_BY_ID(base.entityId);

  const pickSpecial = (id: string) => {
    const sp = SPECIALS.find((s) => s.id === id);
    // 特批单挂在具体商机上：选特批单时自动锁定其客户与商机，保证 客户→商机→特批→合同 链路一致
    setBase((b) => ({
      ...b, specialId: id,
      customer: sp ? sp.customer : b.customer,
      dealId: sp ? sp.dealId : b.dealId,
      discount: sp ? String(sp.discount) : b.discount,
      terms: sp ? sp.terms : b.terms,
    }));
  };

  const patchLine = (i: number, patch: Partial<OrderLine>) =>
    setLines((ls) => ls.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const submit = () => {
    if (discountErr) return alert(`折扣校验未通过：${discountErr}`);
    for (const l of lines) {
      const missing = missingRequired(l.cat, l.ptype, l.specs ?? {});
      if (missing.length) return alert(`订单行（${l.ptype}）存在必填规格未填：${missing.join("、")}`);
      if (!(Number(l.price) > 0)) return alert(`订单行（${l.ptype}）请填写月租`);
    }
    const id = `HT-2026-0${30 + CONTRACTS.length}`;
    const discount = Number(base.discount) || 0;
    CONTRACTS.unshift({
      id, customer: base.customer, entityId: base.entityId, dealId: base.dealId, specialId: base.specialId || undefined,
      discount, terms: base.terms || undefined,
      seal: base.seal, pay: base.pay, start: base.start, end: base.end, amount,
      status: "审批中", step: 0,
      approvals: initContractApproval(discount), approvalStep: 1,
      lines,
      versions: [{ v: 1, note: `销售提交合同申请（关联商机 ${base.dealId}${base.specialId ? `，特批 ${base.specialId}，折扣 ${base.discount}%` : "，标准合同"}），进入合同申请审批`, at: "2026-10-26" }],
    });
    navigate(`/contract/detail?id=${id}`);
  };

  const STEPS = ["① 合同要素", "② 订单行（与成本核算共用模型）", "③ 确认并提交申请"];

  return (
    <ArcoShell breadcrumb="合同管理 / 新建合同">
      <main className="mx-auto max-w-4xl space-y-4 p-6">
        <div className="rounded-[4px] border border-[#E5E6EB] bg-[#FFF7E8] px-4 py-2.5 text-[11px] leading-5 text-[#B25E00]">
          流程说明：合同流程由<strong>销售发起</strong>（填写合同要素 + 订单行并提交申请）→ <strong>合同申请审批</strong>（业务支撑部负责人复核；非标合同增加财务复核）→ 审批通过转业务支撑部<strong>出具正式合同并上传</strong>（执行折扣一致性校验）→ 登记「待用章」进入签署。
          上传正式合同不是销售的动作，请勿在本页寻找上传入口。
        </div>
        <div className="flex items-center rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-3">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center last:flex-none">
              <button onClick={() => i < step && setStep(i)} className={`flex items-center gap-2 text-sm ${i === step ? "font-semibold text-[#165DFF]" : i < step ? "text-[#00B42A]" : "text-[#C9CDD4]"}`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${i === step ? "bg-[#165DFF] text-white" : i < step ? "bg-[#E8F8F2] text-[#00B42A]" : "bg-[#F2F3F5]"}`}>{i < step ? "✓" : i + 1}</span>
                {s}
              </button>
              {i < STEPS.length - 1 && <div className={`mx-3 h-px flex-1 ${i < step ? "bg-[#00B42A]" : "bg-[#E5E6EB]"}`} />}
            </div>
          ))}
        </div>

        {/* ① 合同要素 */}
        {step === 0 && (
          <div className="space-y-4 rounded-[4px] border border-[#E5E6EB] bg-white p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">关联客户 <span className="text-[#F53F3F]">*</span>（从客户档案选择，不可手动录入）</div>
                <CustomerSelect value={base.customer} onChange={(name) => setBase((b) => ({ ...b, customer: name, dealId: "", specialId: "", discount: "0", terms: "" }))} />
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">关联商机 <span className="text-[#F53F3F]">*</span>{!base.customer && <span className="ml-1 text-[#86909C]">（先选客户）</span>}</div>
                <select className={`w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm ${base.customer && !oppsOfCust.length ? "text-[#FF7D00]" : ""}`}
                  value={base.dealId} disabled={!base.customer}
                  onChange={(e) => setBase((b) => ({ ...b, dealId: e.target.value }))}>
                  <option value="">{base.customer ? (oppsOfCust.length ? "选择该客户名下的商机" : "该客户暂无可签商机（请到商机管理创建）") : "请先选择客户"}</option>
                  {oppsOfCust.map((d) => (
                    <option key={d.id} value={d.id}>{d.id} · {d.name} · {d.ptype} · 预计 {fmtMoney(d.expectAmount)} 元/月{d.stage === "赢单" ? "（已赢单）" : ""}</option>
                  ))}
                </select>
                <div className="mt-0.5 text-[10px] text-[#C9CDD4]">形成 客户 → 商机 → 特批 → 合同 链路；合同生效后商机自动关闭并转生成订单</div>
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">关联特批单（非标时必选，通过后折扣与条款自动锁定）</div>
                <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={base.specialId} onChange={(e) => pickSpecial(e.target.value)}>
                  <option value="">无偏离 · 标准合同</option>
                  {SPECIALS.filter((s) => s.status === "已通过").map((s) => {
                    const d = GET_OPP(s.dealId);
                    return <option key={s.id} value={s.id}>{s.id} · {s.customer} · {d ? d.name : s.dealId} · 折扣 {s.discount}%</option>;
                  })}
                </select>
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">折扣率（%）{base.specialId && <span className="text-[#165DFF]">（特批单锁定，不可改）</span>}</div>
                <Input type="number" value={base.discount} disabled={!!base.specialId} onChange={(e) => setBase({ ...base, discount: e.target.value })} className={base.specialId ? "bg-[#F7F8FA] text-[#86909C]" : ""} />
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">签约主体（分子公司）<b className="text-[#F53F3F]">*</b></div>
                <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={base.entityId} onChange={(e) => setBase({ ...base, entityId: e.target.value })}>
                  {ENTITIES.filter((e) => e.status === "启用").map((e) => <option key={e.id} value={e.id}>{e.shortName} · {e.fullName}</option>)}
                </select>
                <div className="mt-0.5 text-[10px] text-[#C9CDD4]">抬头 / 用印 / 销方税号 / 收款账户由主体决定（主体与印章页维护）</div>
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">用章方式</div>
                <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
                  {([["online", "线上 · 契约锁"], ["offline", "线下 · 实物章"]] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setBase({ ...base, seal: k })} className={`flex-1 rounded-[2px] px-2 py-1.5 text-xs ${base.seal === k ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-0.5 text-xs text-[#4E5969]">付款方式</div>
                <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={base.pay} onChange={(e) => setBase({ ...base, pay: e.target.value as typeof base.pay })}>
                  {["月付", "季度付", "半年付", "年付"].map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="mb-0.5 text-xs text-[#4E5969]">合同起始</div>
                  <Input type="date" value={base.start} onChange={(e) => setBase({ ...base, start: e.target.value })} />
                </div>
                <div className="flex-1">
                  <div className="mb-0.5 text-xs text-[#4E5969]">合同截止</div>
                  <Input type="date" value={base.end} onChange={(e) => setBase({ ...base, end: e.target.value })} />
                </div>
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-xs text-[#4E5969]">特殊条款{base.specialId && <span className="text-[#165DFF]">（随特批单带出）</span>}</div>
              <textarea className="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5 text-sm" rows={2} value={base.terms} disabled={!!base.specialId} onChange={(e) => setBase({ ...base, terms: e.target.value })} placeholder="标准合同可为空" />
            </div>
            {discountErr && <div className="rounded-[2px] border border-[#F53F3F] bg-[#FFECE8] px-3 py-2 text-xs text-[#B3261E]">⚠ 折扣校验：{discountErr}</div>}
            {!discountErr && Number(base.discount) > 0 && <div className="rounded-[2px] border border-[#00B42A] bg-[#E8F8F2] px-3 py-2 text-xs text-[#00701A]">✓ 折扣校验通过：与特批单 {base.specialId} 一致（{base.discount}%）</div>}
            <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <Button variant="outline" onClick={() => navigate("/contract")}>取消</Button>
              <Button disabled={!canNext1} onClick={() => setStep(1)}>下一步：填写订单行</Button>
            </div>
          </div>
        )}

        {/* ② 订单行：规格来自产品基础数据选项 */}
        {step === 1 && (
          <div className="space-y-3 rounded-[4px] border border-[#E5E6EB] bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#1D2129]">订单行（合同生效即订单生效，本表数据直接进入成本核算）</span>
              <Button size="sm" variant="outline" onClick={() => setLines([...lines, emptyLine()])}>＋ 增行</Button>
            </div>
            {lines.map((l, i) => {
              const type = GET_TYPE(l.cat, l.ptype);
              const specFields = SPEC_FIELDS(l.cat, l.ptype);
              const specStr = buildSpec(l.cat, l.ptype, l.specs ?? {});
              const missing = missingRequired(l.cat, l.ptype, l.specs ?? {});
              return (
                <div key={i} className="space-y-3 rounded-[4px] border border-[#E5E6EB] p-4">
                  <div className="flex items-center justify-between">
                    <span className="rounded-[2px] bg-[#F2F3F5] px-2 py-0.5 text-[11px] font-medium text-[#4E5969]">订单行 {i + 1}</span>
                    <button className="text-[11px] text-[#86909C] hover:text-[#F53F3F] disabled:opacity-30" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}>删除此行</button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="mb-0.5 text-[11px] text-[#4E5969]">产品类别</div>
                      <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-xs" value={l.cat}
                        onChange={(e) => {
                          const ptype = PTYPES(e.target.value)[0] ?? "";
                          patchLine(i, { cat: e.target.value, ptype, plan: undefined, specs: {}, spec: "" });
                        }}>
                        {CATS().map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="mb-0.5 text-[11px] text-[#4E5969]">产品类型{type?.sla ? <span className="ml-1 text-[#86909C]">（SLA {type.sla}）</span> : null}</div>
                      <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-xs" value={l.ptype}
                        onChange={(e) => patchLine(i, { ptype: e.target.value, plan: undefined, specs: {}, spec: "" })}>
                        {PTYPES(l.cat).map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="mb-0.5 text-[11px] text-[#4E5969]">套餐<span className="ml-1 text-[#86909C]">（选了自动带出规格和价，可再微调）</span></div>
                      <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-xs" value={l.plan ?? ""}
                        onChange={(e) => {
                          const plan = PLANS(l.cat, l.ptype).find((p) => p.id === e.target.value);
                          if (!plan) return patchLine(i, { plan: undefined });
                          const specs = { ...(l.specs ?? {}), ...plan.values };
                          patchLine(i, { plan: plan.id, specs, spec: buildSpec(l.cat, l.ptype, specs), ...(plan.price ? { price: plan.price } : {}) });
                        }}>
                        <option value="">自由组合（不选套餐）</option>
                        {PLANS(l.cat, l.ptype).map((p) => <option key={p.id} value={p.id}>{p.name}{p.price ? ` · ${fmtMoney(p.price)} 元/月` : ""}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* 规格：产品基础数据结构化选项，不允许自由输入 */}
                  <div className="rounded-[2px] border border-[#E5E6EB] bg-[#F7F8FA] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-[#4E5969]">规格<span className="ml-1 font-normal text-[#86909C]">（选项来自产品定义，不可自由输入）</span></span>
                      {missing.length > 0 && <span className="text-[10px] text-[#F53F3F]">必填未填：{missing.join("、")}</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {specFields.map((f) => (
                        <div key={f.key}>
                          <div className="mb-0.5 text-[10px] text-[#86909C]">{f.label}{f.required && <span className="text-[#F53F3F]"> *</span>}</div>
                          {f.type === "select" ? (
                            <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1 text-xs" value={(l.specs ?? {})[f.key] ?? ""}
                              onChange={(e) => {
                                const specs = { ...(l.specs ?? {}), [f.key]: e.target.value };
                                patchLine(i, { specs, spec: buildSpec(l.cat, l.ptype, specs) });
                              }}>
                              <option value="">请选择</option>
                              {f.options!.map((o) => <option key={o}>{o}</option>)}
                            </select>
                          ) : f.type === "switch" ? (
                            <div className="flex h-7 overflow-hidden rounded-[2px] border border-[#E5E6EB]">
                              {["是", "否"].map((o) => (
                                <button key={o} type="button"
                                  onClick={() => {
                                    const cur = (l.specs ?? {})[f.key];
                                    const specs = { ...(l.specs ?? {}), [f.key]: cur === o ? "" : o };
                                    patchLine(i, { specs, spec: buildSpec(l.cat, l.ptype, specs) });
                                  }}
                                  className={`flex-1 text-xs transition-colors ${(l.specs ?? {})[f.key] === o ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{o}</button>
                              ))}
                            </div>
                          ) : (
                            <Input type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} className="h-7 text-xs" placeholder={f.placeholder} value={(l.specs ?? {})[f.key] ?? ""}
                              onChange={(e) => {
                                const specs = { ...(l.specs ?? {}), [f.key]: e.target.value };
                                patchLine(i, { specs, spec: buildSpec(l.cat, l.ptype, specs) });
                              }} />
                          )}
                        </div>
                      ))}
                      <div>
                        <div className="mb-0.5 text-[10px] text-[#86909C]">月租（元/月）<span className="text-[#F53F3F]">*</span></div>
                        <Input type="number" className="h-7 text-xs" value={l.price || ""} onChange={(e) => patchLine(i, { price: Number(e.target.value) })} />
                      </div>
                    </div>
                    {specStr && <div className="mt-2 border-t border-dashed border-[#E5E6EB] pt-2 font-mono text-[11px] text-[#165DFF]">规格摘要：{specStr}</div>}
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between border-t border-[#F2F3F5] pt-3">
              <span className="text-sm text-[#4E5969]">月租合计：<span className="font-mono text-lg font-semibold text-[#1D2129]">{fmtMoney(amount)}</span> 元/月{Number(base.discount) > 0 && <span className="ml-2 text-xs text-[#FF7D00]">（折扣 {base.discount}% 已含在报价中）</span>}</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)}>上一步</Button>
                <Button onClick={() => setStep(2)}>下一步：确认</Button>
              </div>
            </div>
          </div>
        )}

        {/* ③ 确认并提交申请（销售动作；上传正式合同是业务支撑部的动作，在详情页执行） */}
        {step === 2 && (
          <div className="space-y-4 rounded-[4px] border border-[#E5E6EB] bg-white p-5">
            <div>
              <div className="mb-2 text-sm font-semibold text-[#1D2129]">合同申请确认单</div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs md:grid-cols-3">
                {[
                  ["客户", base.customer], ["关联商机", `${base.dealId} · ${GET_OPP(base.dealId)?.name ?? ""}`],
                  ["关联特批单", base.specialId || "无（标准合同）"],
                  ["折扣率", `${base.discount}%`],
                  ["签约主体", `${entity.shortName}（${entity.fullName}）`], ["销方税号", entity.taxNo],
                  ["用章方式", base.seal === "online" ? "线上 · 契约锁（按主体开通企业章）" : "线下 · 实物章（按主体用印）"], ["付款方式", base.pay], ["合同期限", `${base.start} ~ ${base.end}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-dashed border-[#F2F3F5] py-1"><dt className="text-[#86909C]">{k}</dt><dd className="font-medium text-[#1D2129]">{v}</dd></div>
                ))}
              </dl>
            </div>
            <div className="overflow-x-auto rounded-[2px] border border-[#E5E6EB]">
              <table className="w-full text-xs">
                <thead><tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]"><th className="px-3 py-1.5">类别 / 产品类型</th><th className="px-3 py-1.5">规格（产品基础数据）</th><th className="px-3 py-1.5 text-right">月租</th></tr></thead>
                <tbody>
                  {lines.map((l, i) => <tr key={i} className="border-b last:border-0"><td className="px-3 py-1.5"><div className="font-medium">{l.ptype}{l.plan && <span className="ml-1 rounded-[2px] bg-[#E8F3FF] px-1 text-[10px] text-[#165DFF]">{PLANS(l.cat, l.ptype).find((p) => p.id === l.plan)?.name ?? l.plan}</span>}</div><div className="text-[10px] text-[#86909C]">{l.cat}</div></td><td className="px-3 py-1.5 font-mono text-[#4E5969]">{l.spec || "—"}</td><td className="px-3 py-1.5 text-right font-mono">{fmtMoney(Number(l.price) || 0)}</td></tr>)}
                  <tr className="font-semibold"><td colSpan={2} className="px-3 py-1.5 text-right">合计</td><td className="px-3 py-1.5 text-right font-mono">{fmtMoney(amount)} 元/月</td></tr>
                </tbody>
              </table>
            </div>
            <div className="rounded-[2px] bg-[#E8F3FF] px-3 py-2 text-xs leading-5 text-[#165DFF]">
              提交后合同进入<strong>合同申请审批</strong>（业务支撑部负责人复核；折扣 &gt; 0 时增加财务复核），审批通过后转「待出合同」：业务支撑部据此<strong>出具正式合同并上传</strong>（上传时执行折扣率与特批单一致性校验，不一致拦截），登记「待用章」后进入签署流程。
            </div>
            <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <Button variant="outline" onClick={() => setStep(1)}>上一步</Button>
              <Button onClick={submit}>提交合同申请</Button>
            </div>
          </div>
        )}
      </main>
    </ArcoShell>
  );
}
