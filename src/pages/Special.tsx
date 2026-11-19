// 特批申请列表（/special）
// 我的申请 / 待我审批 双页签；发起、审批（mock）、详情居中弹窗
// 特批必须挂在「商机」上（客户 → 商机 → 特批 → 合同），发起时先选客户再选该客户的商机
import { useState } from "react";
import { useNavigate } from "react-router";
import { SPECIALS, useSpecials, addSpecial, decideSpecial, SPECIAL_LEVELS, dealSpecialInflight, dealContractBlock, syncSpecialStatus, type Special } from "@/data/contracts";
import { CUSTOMERS, useOpps, getOpps, GET_OPP, type Opportunity } from "@/data/customers";
import { inDataScope, scopeBanner, currentUser } from "@/data/users";
import { useApprovalFlow, INSTANCE_OF_DOC, submitForApproval, approveInstance, rejectInstance, resolveApprover, nodeLabel, getFlows, type ApprovalInstance } from "@/data/approvalFlow";
import { ownerOfDeal } from "@/data/ownership";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import CustomerSelect from "@/components/CustomerSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_CLS: Record<string, string> = {
  审批中: "bg-[#FFF3E8] text-[#FF7D00]",
  已通过: "bg-[#E8F8F2] text-[#00B42A]",
  已驳回: "bg-[#FFECE8] text-[#F53F3F]",
};

function SpecialDetail({ sp, inst, myName, onClose, onDecide }: { sp: Special; inst: ApprovalInstance | undefined; myName: string; onClose: () => void; onDecide: (id: string, level: number, result: "通过" | "驳回", comment: string) => void }) {
  const [comment, setComment] = useState("");
  const pendingLevel = !inst && sp.status === "审批中" ? sp.current : null;   // 历史单（无引擎实例）：页面默认三级模板
  const pendingNode = inst && inst.status === "审批中" ? inst.snapshot.nodes[inst.curNodeIdx] : undefined; // 引擎单：当前节点
  const deal = GET_OPP(sp.dealId);
  return (
    <CenterModal title={sp.id} sub={`${sp.customer} · ${deal ? `${deal.name}（${deal.id}） · ` : ""}${sp.applicant} · ${sp.createdAt}`} width={560} onClose={onClose}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-[4px] border border-[#E5E6EB] p-3">
              <div className="text-[#86909C]">申请折扣率</div>
              <div className="mt-0.5 font-mono text-lg font-semibold text-[#FF7D00]">{sp.discount}%</div>
            </div>
            <div className="rounded-[4px] border border-[#E5E6EB] p-3">
              <div className="text-[#86909C]">当前状态</div>
              <div className="mt-1"><span className={`rounded-[2px] px-2 py-0.5 text-[11px] ${STATUS_CLS[sp.status]}`}>{sp.status}{pendingLevel ? ` · 待${["", "一", "二", "三"][pendingLevel]}级审批` : ""}</span></div>
            </div>
          </div>
          <div className="rounded-[4px] border border-[#E5E6EB] p-3 text-xs leading-5">
            <div className="mb-1 font-semibold text-[#4E5969]">特殊条款描述</div>
            <div className="text-[#1D2129]">{sp.terms}</div>
            <div className="mb-1 mt-3 font-semibold text-[#4E5969]">变更说明（申请原因）</div>
            <div className="text-[#1D2129]">{sp.reason}</div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold text-[#4E5969]">
              {inst ? <>审批进度（审批流「{inst.flowName}」{inst.branchName ? ` · ${inst.branchName}` : ""}）</> : <>三级审批进度（页面默认模板 · 可在「审批流配置」挂接「特批申请单 · 提交」自定义）</>}
            </div>
            <div className="space-y-2">
              {inst ? inst.snapshot.nodes.map((n, i) => {
                const res = inst.results.find((r) => r.nodeIdx === i);
                const isCur = inst.status === "审批中" && i === inst.curNodeIdx;
                return (
                  <div key={i} className={`rounded-[4px] border p-3 text-xs ${res?.action === "驳回" ? "border-[#F53F3F]" : res?.action === "通过" ? "border-[#E5E6EB]" : isCur ? "border-[#165DFF] bg-[#F7FAFF]" : "border-dashed border-[#E5E6EB] opacity-60"}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#1D2129]">第{i + 1}级 · {nodeLabel(n)}</span>
                      <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${res?.action === "通过" ? "bg-[#E8F8F2] text-[#00B42A]" : res?.action === "驳回" ? "bg-[#FFECE8] text-[#F53F3F]" : isCur ? "bg-[#BEDAFF] text-[#165DFF]" : "bg-[#F2F3F5] text-[#86909C]"}`}>
                        {res?.action ?? (isCur ? "待审批" : "未开始")}
                      </span>
                    </div>
                    <div className="mt-1 text-[#86909C]">{res ? `${res.by} · ${res.time}` : `审批方式：${n.mode} · 限时 ${n.timeoutHours}h`}</div>
                    {res && res.comment !== "—" && <div className="mt-1 leading-5 text-[#4E5969]">意见：{res.comment}</div>}
                  </div>
                );
              }) : sp.flows.map((f) => (
                <div key={f.level} className={`rounded-[4px] border p-3 text-xs ${f.result === "驳回" ? "border-[#F53F3F]" : f.result === "通过" ? "border-[#E5E6EB]" : f.level === pendingLevel ? "border-[#165DFF] bg-[#F7FAFF]" : "border-dashed border-[#E5E6EB] opacity-60"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#1D2129]">第{f.level}级 · {f.role}</span>
                    <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${f.result === "通过" ? "bg-[#E8F8F2] text-[#00B42A]" : f.result === "驳回" ? "bg-[#FFECE8] text-[#F53F3F]" : f.level === pendingLevel ? "bg-[#BEDAFF] text-[#165DFF]" : "bg-[#F2F3F5] text-[#86909C]"}`}>
                      {f.result ?? (f.level === pendingLevel ? "待审批" : "未开始")}
                    </span>
                  </div>
                  <div className="mt-1 text-[#86909C]">审批人：{f.name}{f.time ? ` · ${f.time}` : ""}</div>
                  {f.comment && <div className="mt-1 leading-5 text-[#4E5969]">意见：{f.comment}</div>}
                </div>
              ))}
            </div>
          </div>
          {(pendingNode || pendingLevel !== null) && (
            <div className="rounded-[4px] border border-[#BEDAFF] bg-[#F7FAFF] p-3">
              <div className="mb-1.5 text-xs font-semibold text-[#165DFF]">当前登录人待办：{pendingNode ? nodeLabel(pendingNode) : SPECIAL_LEVELS[pendingLevel! - 1]}</div>
              <Input placeholder="审批意见（驳回时必填）" value={comment} onChange={(e) => setComment(e.target.value)} />
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => {
                  if (inst) { const err = approveInstance(inst.id, myName, comment); if (err) alert(err); else onClose(); }
                  else onDecide(sp.id, pendingLevel!, "通过", comment);
                }}>通过</Button>
                <Button size="sm" variant="outline" className="text-[#F53F3F]" onClick={() => {
                  if (!comment.trim()) return alert("驳回必须填写审批意见");
                  if (inst) { const err = rejectInstance(inst.id, myName, comment); if (err) alert(err); else onClose(); }
                  else onDecide(sp.id, pendingLevel!, "驳回", comment);
                }}>驳回</Button>
              </div>
              <div className="mt-2 text-[10px] leading-4 text-[#86909C]">
                审批动作经可配置审批流引擎写回：全节点通过 → 特批单「已通过」，合同可引用；驳回 → 「已驳回」并通知发起人（驳回策略：{inst?.snapshot.rejectPolicy ?? "退回发起人修改后重报"}）
              </div>
            </div>
          )}
        </div>
    </CenterModal>
  );
}

export default function Special() {
  useOpps();
  useSpecials(); // 订阅共享特批台账：审批结果实时反映，且合同起草页可引用同一份数据
  useApprovalFlow(); // 订阅审批引擎：实例进度 / 审批流配置变化实时反映
  const navigate = useNavigate();
  const [tab, setTab] = useState<"mine" | "todo">("mine");
  const list = SPECIALS; // 直接读共享台账（发起 / 审批原地修改，刷新不丢）
  const [sel, setSel] = useState<Special | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ customer: "", dealId: "", discount: "", terms: "", reason: "" });
  const [kw, setKw] = useState("");

  // 当前登录人视角：引擎单按「当前节点审批人 = 登录人」匹配；历史单按页面默认模板中的固定审批人（演示数据）匹配
  const myName = currentUser()?.name ?? "";
  const todoList = list.filter((s) => {
    if (s.status !== "审批中") return false;
    const inst = INSTANCE_OF_DOC(s.id);
    if (inst) return inst.status === "审批中" && !!inst.snapshot.nodes[inst.curNodeIdx] && resolveApprover(inst.snapshot.nodes[inst.curNodeIdx]).includes(myName);
    return /周敏|陈立|赵启明/.test(s.flows[s.current - 1]?.name ?? "");
  });
  // 是否已配置「特批申请单 · 提交」的启用审批流（未配置时提交走页面默认三级模板）
  const engineFlowReady = getFlows().some((f) => f.docType === "特批申请单 · 提交" && f.enabled);
  // 数据权限：「我的申请」按归属（商机/客户）过滤；「待我审批」是审批职责不受数据范围限制
  const scopedList = list.filter((s) => inDataScope(ownerOfDeal(s.dealId, s.customer)));
  const banner = scopeBanner(list.length - scopedList.length);
  const shown = (tab === "mine" ? scopedList : todoList).filter((s) => !kw || s.id.includes(kw) || s.customer.includes(kw) || (GET_OPP(s.dealId)?.name ?? "").includes(kw));

  // 选中客户后可选择的商机（一个客户可有多个商机，特批必须指明针对哪一个）
  const customerObj = CUSTOMERS.find((c) => c.name === form.customer);
  const dealOptions: Opportunity[] = customerObj ? getOpps().filter((d) => d.customerId === customerObj.id) : [];
  const pickCustomer = (name: string) => setForm({ ...form, customer: name, dealId: "" });

  const decide = (id: string, level: number, result: "通过" | "驳回", comment: string) => {
    decideSpecial(id, level, result, comment); // 写共享台账：合同起草页立即能搜到「已通过」的特批单
    setSel(null);
  };

  const submitNew = () => {
    if (!form.customer || !form.dealId) return alert("请选择客户及其商机（特批必须针对具体机会发起）");
    if (!form.discount || !form.terms) return alert("请填写折扣率、特殊条款");
    // 商机维度唯一性：在途特批单唯一（已驳回可重新发起）；已有在途 / 已生效合同的商机不再发起特批
    const inflight = dealSpecialInflight(form.dealId);
    if (inflight) return alert(`该商机已有一张在途特批申请（${inflight.id}），请勿重复发起；如条款变更请先由原单走完审批（或驳回后重新发起）`);
    const blk = dealContractBlock(form.dealId);
    if (blk) return alert(`该商机已关联合同 ${blk.id}（${blk.status}），折扣与条款应在合同发起前完成特批，请勿再发起特批申请`);
    const id = addSpecial({ customer: form.customer, dealId: form.dealId, discount: Number(form.discount), terms: form.terms, reason: form.reason });
    const opp = GET_OPP(form.dealId);
    const r = submitForApproval("特批申请单 · 提交", id, `${form.customer} · 折扣 ${form.discount}%`, { discount: Number(form.discount), amount: opp?.expectAmount ?? 0 }, myName || "张弛（销售）");
    setCreating(false);
    setForm({ customer: "", dealId: "", discount: "", terms: "", reason: "" });
    if (r.hit) alert(`已提交审批：命中审批流「${r.instance!.flowName}」（${r.instance!.branchName}）· 当前节点 ${nodeLabel(r.instance!.snapshot.nodes[0])}；进度见详情或「审批中心」`);
    else { syncSpecialStatus(id, "已通过"); alert(`未命中已启用的特批审批流（${r.reason ?? "未配置"}）：本单按页面默认三级模板在途流转（见详情），管理员可在「审批流配置 → 新建审批流」挂接「特批申请单 · 提交」自定义审批链`); }
  };

  return (
    <ArcoShell breadcrumb="特批申请">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#1D2129]">特批申请</span>
            <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
              {([["mine", "我的申请"], ["todo", `待我审批（${todoList.length}）`]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} className={`rounded-[2px] px-3 py-1 text-xs ${tab === k ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{label}</button>
              ))}
            </div>
            <Input className="w-56" placeholder="搜索单号 / 客户 / 商机" value={kw} onChange={(e) => setKw(e.target.value)} />
          </div>
          <Button size="sm" onClick={() => setCreating(true)}>＋ 发起特批申请</Button>
        </div>

        {banner && (
          <div className="rounded-[4px] border border-[#FFECE8] bg-[#FFF7F5] px-4 py-2 text-[11px] text-[#F53F3F]">🔒 {banner}（「待我审批」页签为审批职责视图，不受数据范围限制）</div>
        )}

        <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">特批单号</th><th className="px-3 py-2">客户 / 商机</th><th className="px-3 py-2">折扣率</th>
                <th className="px-3 py-2">特殊条款摘要</th><th className="px-3 py-2">状态</th><th className="px-3 py-2">申请人 / 时间</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id} className="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]" onClick={() => setSel(s)}>
                  <td className="px-3 py-2.5 font-mono text-[#165DFF]">{s.id}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-[#1D2129]">{s.customer}</div>
                    <div className="mt-0.5 text-[10px] text-[#86909C]">{GET_OPP(s.dealId) ? `${GET_OPP(s.dealId)!.name}（${s.dealId}）` : s.dealId}</div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[#FF7D00]">{s.discount}%</td>
                  <td className="max-w-[280px] truncate px-3 py-2.5 text-[#4E5969]">{s.terms}</td>
                  <td className="px-3 py-2.5"><span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${STATUS_CLS[s.status]}`}>{s.status}</span></td>
                  <td className="px-3 py-2.5 text-[#86909C]">{s.applicant}<br />{s.createdAt}</td>
                  <td className="px-3 py-2.5 text-right"><button className="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">{s.status === "审批中" ? "去审批" : "查看"}</button></td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={7} className="px-3 py-10 text-center text-[#86909C]">暂无数据</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          要点：折扣与特殊条款在特批层一次性审定，特批必须挂在具体<strong>商机</strong>上（客户 → 商机 → 特批 → 合同）；合同起草时引用已通过特批单（折扣与条款自动带出并锁定）；上传合同时系统校验折扣率与特批单一致，不一致拦截。商机在「商机管理」中统一维护。
          <button className="ml-2 text-[#165DFF] hover:underline" onClick={() => navigate("/opportunity")}>去商机管理 →</button>
        </div>
      </main>

      {sel && <SpecialDetail sp={sel} inst={INSTANCE_OF_DOC(sel.id)} myName={myName} onClose={() => setSel(null)} onDecide={decide} />}

      {creating && (
        <CenterModal title="发起特批申请" onClose={() => setCreating(false)} width={520}>
          <div className="space-y-3">
            <div>
              <div className="mb-0.5 text-xs text-[#4E5969]">关联客户</div>
              <CustomerSelect value={form.customer} onChange={pickCustomer} />
            </div>
            <div>
              <div className="mb-0.5 text-xs text-[#4E5969]">商机 <span className="text-[#F53F3F]">*</span>{!form.customer && <span className="text-[#86909C]">（请先选择客户）</span>}</div>
              <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm disabled:bg-[#F7F8FA]" disabled={!form.customer}
                value={form.dealId} onChange={(e) => setForm({ ...form, dealId: e.target.value })}>
                <option value="">{form.customer ? "选择该客户下的商机" : "—"}</option>
                {dealOptions.map((d) => {
                  const spInflight = dealSpecialInflight(d.id);
                  const blk = dealContractBlock(d.id);
                  const reason = spInflight ? `在途特批 ${spInflight.id}` : blk ? `已关联合同 ${blk.id}（${blk.status}）` : "";
                  return <option key={d.id} value={d.id} disabled={!!reason}>{d.name} · {d.products.map((p) => `${p.cat}/${p.ptype}`).join("、")} · 预计合同 {d.expectAmount.toLocaleString("zh-CN")} 元{d.expectMonths ? `（${d.expectMonths} 个月）` : ""}（{d.stage}{reason ? ` · ${reason}，不可再发起` : ""}）</option>;
                })}
              </select>
              {form.customer && !dealOptions.length && (
                <div className="mt-1 text-[10px] leading-4 text-[#FF7D00]">该客户暂无商机，请先到商机管理创建后再发起特批</div>
              )}
            </div>
            <div>
              <div className="mb-0.5 text-xs text-[#4E5969]">折扣率（%）</div>
              <Input placeholder="如 12" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            </div>
            <div>
              <div className="mb-0.5 text-xs text-[#4E5969]">特殊条款描述</div>
              <textarea className="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5 text-sm" rows={3} placeholder="非标条款全文" value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} />
            </div>
            <div>
              <div className="mb-0.5 text-xs text-[#4E5969]">变更说明（申请原因）</div>
              <textarea className="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5 text-sm" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <Button variant="outline" size="sm" onClick={() => setCreating(false)}>取消</Button>
              <Button size="sm" onClick={submitNew}>提交（进入审批）</Button>
            </div>
            {engineFlowReady
              ? <div className="text-[10px] leading-4 text-[#86909C]">提交后进入可配置审批流：按「审批流配置」中「特批申请单 · 提交」的命中分支流转；任一级驳回 → 终止并通知发起人</div>
              : <div className="rounded-[4px] bg-[#FFF7E8] px-2 py-1.5 text-[10px] leading-4 text-[#FF7D00]">尚未配置特批审批流：提交后按页面默认三级模板流转（业务支撑部 → 财务 → 管理层）；管理员可在「审批流配置 → 新建审批流」挂接动作「特批申请单 · 提交」，按折扣率等条件自定义审批链</div>}
          </div>
        </CenterModal>
      )}
    </ArcoShell>
  );
}
