// 产品定义 · 第 2 级：某产品类别下的产品类型（/product/types?cat=产品类别）
// 新增产品 = 三步大白话向导（这是什么 → 客户选什么 → 算哪几笔账）；本页同时保留属性编辑等高级维护入口
// 点击类型行进入规格字段维护（第 3 级）
import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router";
import { useCatalog, getCats, addType, removeType, duplicateType, updateType, COST_ITEM_NAME, type ProductType, type SpecField } from "@/data/products";
import { useCostItems } from "@/data/costItems";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const fmtMoney = (n: number) => n.toLocaleString("zh-CN");

// ---------- 新增产品 · 三步大白话向导 ----------
// 第 1 步 这是什么：客户看到的商品；第 2 步 客户下单选什么：规格字段 + 套餐（常用规格一键带入，清单式管理）；
// 第 3 步 卖一单算哪几笔账：从算账清单勾（条目按约定直接读订单行规格值，无需绑定）
interface DraftSpec { id: number; label: string; kind: SpecField["type"]; optionsText: string; required: boolean }

// 常用规格模板：一键带入，免去逐字录入
const SPEC_PRESETS: { label: string; kind: SpecField["type"]; options: string }[] = [
  { label: "带宽", kind: "select", options: "50M\n100M\n200M\n500M\n1G\n10G" },
  { label: "IP", kind: "select", options: "1 个\n4 个\n8 个\n16 个\n32 个\n64 个\n128 个\n256 个（一个 C）" },
  { label: "基础线路", kind: "select", options: "1 条\n2 条（冗余）" },
  { label: "机柜", kind: "select", options: "10U\n20U\n半柜\n整柜 42U" },
  { label: "电力", kind: "select", options: "3kW\n5kW\n10kW\n16kW" },
  { label: "生效日期", kind: "date", options: "" },
];

// 规格类型名称（新建 / 编辑 / 清单展示共用）
const KIND_LABEL: Record<SpecField["type"], string> = { select: "选档位", number: "填数字", text: "填文字", date: "选日期", switch: "是 / 否" };

function ProductWizard({ catName, onClose }: { catName: string; onClose: (created?: string) => void }) {
  useCostItems();
  const [step, setStep] = useState(0);
  // 第 1 步
  const [name, setName] = useState("");
  const [sla, setSla] = useState("");
  // 第 2 步：客户要选的项（清单展示，新建 / 编辑走小弹窗）
  const [specs, setSpecs] = useState<DraftSpec[]>([]);
  let specSeq = specs.length ? Math.max(...specs.map((s) => s.id)) + 1 : 1;
  const [specEditor, setSpecEditor] = useState<(DraftSpec & { isNew: boolean }) | null>(null);
  // 套餐草稿：把某些规格定死成一个包（values 以 draft 规格 id 为键，finish 时换算成字段 key）
  const [draftPlans, setDraftPlans] = useState<{ id: string; name: string; price?: number; values: Record<number, string> }[]>([]);
  const [planEditor, setPlanEditor] = useState<{ id: string; name: string; price: string; fix: Record<number, string> } | null>(null);
  // 核算装配不在新建向导维护：直接成本由资源清单的产品组成推导，间接费用勾选成本中心（2026-11-05 移除第 3 步手勾条目）

  const next = () => {
    if (step === 0 && !name.trim()) return alert("先给产品起个名字");
    setStep((s) => s + 1);
  };
  const finish = () => {
    const n = name.trim();
    if (!addType(catName, n)) return alert("该产品类型已存在");
    const specFields: SpecField[] = specs
      .filter((s) => s.label.trim())
      .map((s, i) => ({
        key: `f${Date.now() % 100000}_${i}`,
        label: s.label.trim(),
        type: s.kind,
        options: s.kind === "select" ? s.optionsText.split("\n").map((x) => x.trim()).filter(Boolean) : undefined,
        required: s.required,
      }));
    // draft 规格 id → 最终字段 key（套餐预设值按此换算）
    const idToKey: Record<number, string> = {};
    specs.filter((s) => s.label.trim()).forEach((s, i) => { if (specFields[i]) idToKey[s.id] = specFields[i].key; });
    updateType(catName, n, {
      sla: sla || undefined,
      specFields,
      plans: draftPlans.length
        ? draftPlans.map((dp) => ({
            id: dp.id, name: dp.name, price: dp.price,
            values: Object.fromEntries(Object.entries(dp.values).map(([sid, v]) => [idToKey[Number(sid)] ?? sid, v])),
          }))
        : undefined,
    });
    onClose(n);
  };

  // 规格编辑器保存（新建 / 编辑共用）
  const saveSpec = () => {
    if (!specEditor) return;
    if (!specEditor.label.trim()) return alert("先给规格起个名字，如：带宽");
    if (specEditor.kind === "select" && !specEditor.optionsText.split("\n").some((x) => x.trim())) return alert("选档位的规格至少要填一个档位，每行一个");
    const clean: DraftSpec = { id: specEditor.id, label: specEditor.label.trim(), kind: specEditor.kind, optionsText: specEditor.optionsText, required: specEditor.required };
    setSpecs((x) => (specEditor.isNew ? [...x, clean] : x.map((y) => (y.id === clean.id ? clean : y))));
    setSpecEditor(null);
  };
  // 删除规格：同时清掉套餐里的引用
  const removeSpec = (id: number) => {
    setSpecs((x) => x.filter((y) => y.id !== id));
    setDraftPlans((x) => x.map((p) => ({ ...p, values: Object.fromEntries(Object.entries(p.values).filter(([sid]) => Number(sid) !== id)) })));
  };
  // 套餐编辑器保存（新建 / 编辑共用）
  const savePlanDraft = () => {
    if (!planEditor) return;
    if (!planEditor.name.trim()) return alert("先填套餐名");
    const values = Object.fromEntries(Object.entries(planEditor.fix).filter(([, v]) => v));
    if (!Object.keys(values).length) return alert("这个套餐一个规格都没定死，等于没建——至少给某个规格选一个档位");
    const plan = { id: planEditor.id || `plan_${Date.now() % 100000}_${draftPlans.length}`, name: planEditor.name.trim(), price: planEditor.price ? Number(planEditor.price) : undefined, values };
    setDraftPlans((x) => (x.some((p) => p.id === plan.id) ? x.map((p) => (p.id === plan.id ? plan : p)) : [...x, plan]));
    setPlanEditor(null);
  };

  const STEPS = ["① 这是什么", "② 客户下单选什么"] as const;

  return (
    <div className="space-y-4 text-xs">
      {/* 步骤条 */}
      <div className="flex items-center gap-2">
        {STEPS.map((t, i) => (
          <span key={t} className={`rounded-[2px] px-2 py-1 text-[11px] ${i === step ? "bg-[#165DFF] text-white" : i < step ? "text-[#00B42A]" : "bg-[#F2F3F5] text-[#86909C]"}`}>
            {i < step ? "✓ " : ""}{t}
          </span>
        ))}
      </div>

      {/* 第 1 步：这是什么 */}
      {step === 0 && (
        <div className="space-y-3">
          <div className="text-[#86909C]">客户看到的这件商品长什么样：</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-0.5 text-[#4E5969]">产品名称 <span className="text-[#F53F3F]">*</span></div>
              <Input autoFocus placeholder="如：AI 专线 / OTN / 机柜托管" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">属于哪一类</div>
              <Input value={catName} disabled />
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">SLA 等级</div>
              <Input placeholder="如 99.9%，可空" value={sla} onChange={(e) => setSla(e.target.value)} />
            </div>
          </div>
          <div className="mt-1 text-[10px] text-[#C9CDD4]">价格不在产品类型上定：订单行议价、套餐定价（第 2 步可加套餐），类型只定义「卖什么」。算哪些账不在本页配——创建后到「资源清单」配产品组成（直接成本自动推导）并勾选成本中心。</div>
        </div>
      )}

      {/* 第 2 步：客户下单选什么（清单式：常用规格一键带入，新建 / 编辑走小弹窗） */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="text-[#86909C]">客户买它的时候要逐项选什么？绝大多数产品至少让客户选「带宽」——点下面的常用规格一键带入，也可以新建自己的。</div>

          {/* 已添加的规格：每行一条，干净清爽 */}
          <div className="space-y-1.5">
            {specs.map((s) => {
              const opts = s.optionsText.split("\n").map((x) => x.trim()).filter(Boolean);
              return (
                <div key={s.id} className="flex items-center gap-2 rounded-[2px] border border-[#E5E6EB] px-2.5 py-1.5">
                  <span className="shrink-0 font-medium text-[#1D2129]">{s.label || "（未命名）"}</span>
                  <span className="shrink-0 rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] text-[#4E5969]">{KIND_LABEL[s.kind]}</span>
                  {s.required && <span className="shrink-0 rounded-[2px] bg-[#FFECE8] px-1.5 py-0.5 text-[10px] text-[#F53F3F]">必填</span>}
                  <span className="truncate font-mono text-[10px] text-[#C9CDD4]">{s.kind === "select" ? (opts.length > 4 ? `${opts.slice(0, 4).join(" / ")} …共 ${opts.length} 档` : opts.join(" / ")) : (s.optionsText || "—")}</span>
                  <button className="ml-auto shrink-0 text-[11px] text-[#165DFF] hover:underline" onClick={() => setSpecEditor({ ...s, isNew: false })}>编辑</button>
                  <button className="shrink-0 text-[11px] text-[#F53F3F] hover:underline" onClick={() => removeSpec(s.id)}>删除</button>
                </div>
              );
            })}
            {!specs.length && <div className="rounded-[2px] bg-[#F7F8FA] px-3 py-2.5 text-[11px] text-[#86909C]">还没有规格。建议至少加一个「带宽」，否则客户下单没什么可选的。</div>}
          </div>

          {/* 添加方式：常用规格一键带入 / 新建 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[#86909C]">常用规格：</span>
            {SPEC_PRESETS.map((p) => (
              <button key={p.label} disabled={specs.some((s) => s.label === p.label)} title={p.options.split("\n").join(" / ")}
                onClick={() => setSpecs((x) => [...x, { id: specSeq, label: p.label, kind: p.kind, optionsText: p.options, required: false }])}
                className="rounded-[2px] border border-[#BEDAFF] px-2 py-1 text-[11px] text-[#165DFF] transition-colors hover:bg-[#F7FBFF] disabled:cursor-not-allowed disabled:border-[#F2F3F5] disabled:text-[#C9CDD4] disabled:hover:bg-transparent">
                ＋ {p.label}
              </button>
            ))}
            <button onClick={() => setSpecEditor({ id: specSeq, label: "", kind: "select", optionsText: "", required: false, isNew: true })}
              className="rounded-[2px] border border-dashed border-[#C9CDD4] px-2 py-1 text-[11px] text-[#4E5969] transition-colors hover:border-[#165DFF] hover:text-[#165DFF]">
              ＋ 新建规格
            </button>
          </div>

          {/* 套餐（可选）：同样清单 + 弹窗 */}
          <div className="rounded-[4px] border border-dashed border-[#BEDAFF] bg-[#F7FBFF] p-3">
            <div className="mb-2 leading-5 text-[#4E5969]">套餐（可选）：把客户常买的搭配定死、定个价——客户下单选这个包，规格自动带出，不用逐项选。</div>
            {draftPlans.map((p) => (
              <div key={p.id} className="mb-1.5 flex items-center gap-2 rounded-[2px] border border-[#E5E6EB] bg-white px-2.5 py-1.5">
                <span className="shrink-0 font-medium text-[#1D2129]">{p.name}</span>
                <span className="shrink-0 text-[#4E5969]">{p.price ? `${fmtMoney(p.price)} 元/月` : "未定价"}</span>
                <span className="truncate font-mono text-[10px] text-[#86909C]">
                  {Object.entries(p.values).map(([sid, v]) => `${specs.find((s) => s.id === Number(sid))?.label ?? sid} ${v}`).join(" · ")}
                </span>
                <button className="ml-auto shrink-0 text-[11px] text-[#165DFF] hover:underline" onClick={() => setPlanEditor({ id: p.id, name: p.name, price: p.price ? String(p.price) : "", fix: { ...p.values } })}>编辑</button>
                <button className="shrink-0 text-[11px] text-[#F53F3F] hover:underline" onClick={() => setDraftPlans((x) => x.filter((y) => y.id !== p.id))}>删除</button>
              </div>
            ))}
            {!draftPlans.length && <div className="mb-1.5 rounded-[2px] bg-white/70 px-2.5 py-1.5 text-[11px] text-[#86909C]">还没套餐：客户只能逐项自由组合规格（建好产品后也可随时补）</div>}
            <Button size="sm" variant="outline" onClick={() => setPlanEditor({ id: "", name: "", price: "", fix: {} })}>＋ 添加套餐</Button>
          </div>
        </div>
      )}

      {/* 底部按钮 */}
      <div className="flex items-center justify-between border-t border-[#F2F3F5] pt-3">
        <Button variant="outline" size="sm" onClick={() => onClose()}>取消</Button>
        <div className="flex gap-2">
          {step > 0 && <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>上一步</Button>}
          {step < 1
            ? <Button size="sm" onClick={next}>下一步</Button>
            : <Button size="sm" onClick={finish}>创建产品</Button>}
        </div>
      </div>

      {/* 规格编辑器（新建 / 编辑共用） */}
      {specEditor && (
        <CenterModal title={specEditor.isNew ? "新建规格" : `编辑规格 · ${specEditor.label}`} sub="客户下单时要逐项选的内容" onClose={() => setSpecEditor(null)} width={440}>
          <div className="space-y-3 text-xs">
            <div>
              <div className="mb-0.5 text-[#4E5969]">规格名称 <span className="text-[#F53F3F]">*</span>（客户下单时看到的）</div>
              <Input autoFocus placeholder="如：带宽 / IP / 机柜" value={specEditor.label} onChange={(e) => setSpecEditor({ ...specEditor, label: e.target.value })} />
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">客户怎么选</div>
              <div className="flex flex-wrap rounded-[2px] border border-[#E5E6EB] p-0.5">
                {(Object.entries(KIND_LABEL) as [SpecField["type"], string][]).map(([k, label]) => (
                  <button key={k} onClick={() => setSpecEditor({ ...specEditor, kind: k })}
                    className={`flex-1 whitespace-nowrap rounded-[2px] px-2 py-1.5 ${specEditor.kind === k ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{label}</button>
                ))}
              </div>
            </div>
            {specEditor.kind === "select" ? (
              <div>
                <div className="mb-0.5 text-[#4E5969]">有哪些档位？每行一个</div>
                <textarea className="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5 font-mono text-[11px]" rows={4} placeholder={"50M\n100M\n200M"}
                  value={specEditor.optionsText} onChange={(e) => setSpecEditor({ ...specEditor, optionsText: e.target.value })} />
              </div>
            ) : specEditor.kind === "switch" ? (
              <div className="rounded-[2px] bg-[#F7F8FA] px-2.5 py-2 text-[11px] text-[#86909C]">客户在「是 / 否」中选一个，适合「是否需要公网广播」「是否含维保」这类判断项，无需配置内容。</div>
            ) : (
              <div>
                <div className="mb-0.5 text-[#4E5969]">{specEditor.kind === "date" ? "日期提示语（可空）" : "输入框提示语"}</div>
                <Input placeholder={specEditor.kind === "number" ? "如：台数" : specEditor.kind === "date" ? "如：期望开通日期" : "如：机房位置"} value={specEditor.optionsText} onChange={(e) => setSpecEditor({ ...specEditor, optionsText: e.target.value })} />
              </div>
            )}
            <label className="flex items-center gap-2 text-xs text-[#4E5969]">
              <input type="checkbox" className="accent-[#165DFF]" checked={specEditor.required} onChange={(e) => setSpecEditor({ ...specEditor, required: e.target.checked })} />
              必选项（客户不下单前必须选它）
            </label>
            <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <Button variant="outline" size="sm" onClick={() => setSpecEditor(null)}>取消</Button>
              <Button size="sm" onClick={saveSpec}>保存规格</Button>
            </div>
          </div>
        </CenterModal>
      )}

      {/* 套餐编辑器（新建 / 编辑共用） */}
      {planEditor && (
        <CenterModal title={planEditor.id ? "编辑套餐" : "添加套餐"} sub="把几个规格定死成一个包；客户选包，规格自动带出" onClose={() => setPlanEditor(null)} width={440}>
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-0.5 text-[#4E5969]">套餐名 <span className="text-[#F53F3F]">*</span></div>
                <Input autoFocus placeholder="如：标准版 / 尊享版" value={planEditor.name} onChange={(e) => setPlanEditor({ ...planEditor, name: e.target.value })} />
              </div>
              <div>
                <div className="mb-0.5 text-[#4E5969]">套餐价（元/月，可空）</div>
                <Input type="number" placeholder="客户选此套餐的默认月租" value={planEditor.price} onChange={(e) => setPlanEditor({ ...planEditor, price: e.target.value })} />
              </div>
            </div>
            <div>
              <div className="mb-1 text-[#4E5969]">规格预设（留空的规格，客户下单时再自己选）</div>
              <div className="space-y-2 rounded-[2px] border border-[#E5E6EB] p-2.5">
                {specs.filter((s) => s.label.trim() && (s.kind !== "select" || s.optionsText.trim())).map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-[#4E5969]">{s.label}</span>
                    {s.kind === "select" ? (
                      <select className="flex-1 rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1" value={planEditor.fix[s.id] ?? ""}
                        onChange={(e) => setPlanEditor({ ...planEditor, fix: { ...planEditor.fix, [s.id]: e.target.value } })}>
                        <option value="">客户自选</option>
                        {s.optionsText.split("\n").map((o) => o.trim()).filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : s.kind === "switch" ? (
                      <select className="flex-1 rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1" value={planEditor.fix[s.id] ?? ""}
                        onChange={(e) => setPlanEditor({ ...planEditor, fix: { ...planEditor.fix, [s.id]: e.target.value } })}>
                        <option value="">客户自选</option>
                        <option>是</option><option>否</option>
                      </select>
                    ) : (
                      <Input className="h-7 flex-1" placeholder={s.kind === "date" ? "如：2026-01-01（留空客户自填）" : s.kind === "number" ? "留空客户自填" : "留空客户自填"}
                        value={planEditor.fix[s.id] ?? ""} onChange={(e) => setPlanEditor({ ...planEditor, fix: { ...planEditor.fix, [s.id]: e.target.value } })} />
                    )}
                  </div>
                ))}
                {!specs.length && <div className="text-[11px] text-[#C9CDD4]">还没有规格——先返回上一屏添加规格</div>}
              </div>
              <div className="mt-1 text-[10px] text-[#C9CDD4]">建议把必填规格都定死：否则客户选了这个套餐还得补选，套餐就失去意义了。</div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <Button variant="outline" size="sm" onClick={() => setPlanEditor(null)}>取消</Button>
              <Button size="sm" onClick={savePlanDraft}>保存套餐</Button>
            </div>
          </div>
        </CenterModal>
      )}
    </div>
  );
}

export default function ProductTypes() {
  useCatalog();
  useCostItems();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const catName = sp.get("cat") ?? "";
  const cat = getCats().find((c) => c.name === catName);
  const [kw, setKw] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Partial<ProductType> | null>(null); // 编辑产品类型属性（仅商务属性；核算装配在类型详情页独立维护）

  if (!cat) {
    return (
      <ArcoShell breadcrumb="产品定义 / 产品类型">
        <main className="p-6"><div className="rounded-[4px] border border-[#E5E6EB] bg-white p-10 text-center text-sm text-[#86909C]">
          产品类别不存在（{catName}）<Link className="ml-2 text-[#165DFF] hover:underline" to="/product">返回产品类别</Link>
        </div></main>
      </ArcoShell>
    );
  }

  const shown = cat.types.filter((t) => !kw || t.name.includes(kw));

  const saveEdit = () => {
    if (!editing?.name?.trim()) return alert("请填写类型名称");
    updateType(cat.name, editing.name!, {
      status: editing.status,
      sla: editing.sla || undefined,
      billingCycle: editing.billingCycle || undefined,
      taxRate: editing.taxRate || undefined,
      leadTime: editing.leadTime || undefined,
    });
    setEditing(null);
  };

  return (
    <ArcoShell breadcrumb={`产品定义 / ${cat.name} / 产品类型`}>
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#1D2129]">产品类型</span>
            <span className="rounded-[2px] bg-[#F2F3F5] px-2 py-0.5 text-[11px] text-[#4E5969]">{cat.name}</span>
            {cat.remark && <span className="text-[11px] text-[#86909C]">{cat.remark}</span>}
            <Input className="w-48" placeholder="搜索类型" value={kw} onChange={(e) => setKw(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate("/product")}>返回类别</Button>
            <Button size="sm" onClick={() => setCreating(true)}>＋ 新增产品类型</Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">产品类型</th><th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">SLA</th><th className="px-3 py-2">计费周期</th><th className="px-3 py-2">默认成本条目</th>
                <th className="px-3 py-2">规格字段</th><th className="px-3 py-2">更新</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.name} className={`cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA] ${t.status === "停用" ? "opacity-55" : ""}`}
                  onClick={() => navigate(`/product/specs?cat=${encodeURIComponent(cat.name)}&type=${encodeURIComponent(t.name)}`)}>
                  <td className="px-3 py-2.5 font-medium text-[#1D2129]">{t.name}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={(e) => { e.stopPropagation(); updateType(cat.name, t.name, { status: t.status === "启用" ? "停用" : "启用" }); }}
                      title="点击切换上/下架"
                      className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${t.status === "启用" ? "bg-[#E8F8F2] text-[#00B42A]" : "bg-[#F2F3F5] text-[#86909C]"}`}>
                      {t.status}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{t.sla ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{t.billingCycle ?? "—"}</td>
                  <td className="max-w-[220px] truncate px-3 py-2.5" title={t.costItems.map(COST_ITEM_NAME).join("\n")}>
                    {t.costItems.length ? (
                      <button className="text-[#165DFF] hover:underline"
                        onClick={(e) => { e.stopPropagation(); navigate(`/product/bom?cat=${encodeURIComponent(cat.name)}&type=${encodeURIComponent(t.name)}`); }}>
                        {t.costItems.length} 项 · v{t.asmVersion}
                      </button>
                    ) : <span className="text-[#86909C]">—</span>}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[#4E5969]">{t.specFields.length}</td>
                  <td className="px-3 py-2.5 text-[#C9CDD4]">{t.updatedAt}</td>
                  <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button className="mr-1.5 text-[#165DFF] hover:underline" onClick={() => navigate(`/product/specs?cat=${encodeURIComponent(cat.name)}&type=${encodeURIComponent(t.name)}`)}>规格</button>
                    <button className="mr-1.5 text-[#4E5969] hover:underline" onClick={() => setEditing({ ...t })}>编辑</button>
                    <button className="mr-1.5 text-[#4E5969] hover:underline" onClick={() => duplicateType(cat.name, t.name)}>复制</button>
                    <button className="text-[#F53F3F] hover:underline" onClick={() => {
                      if (window.confirm(`删除产品类型「${t.name}」及其规格字段？已有合同不受影响（存的是文本快照）。`)) removeType(cat.name, t.name);
                    }}>删除</button>
                  </td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={8} className="px-3 py-10 text-center text-[#86909C]">该产品类别下暂无产品类型</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          「状态」切换上/下架：停用后不出现在合同起草的选项中（历史合同不受影响）；「复制」以「停用」状态创建副本，确认无误后再启用。算哪些账不在本页维护——到「资源清单」配产品组成（直接成本自动推导）并勾选成本中心；SLA / 计费周期 / 税率 / 交付周期为类型级商务属性（价格不在类型上维护：订单行议价、套餐定价）。
        </div>
      </main>

      {creating && (
        <CenterModal title={`新增产品 · ${cat.name}`} sub="回答三个问题就完成：这是什么 → 客户选什么 → 算哪几笔账" width={680} onClose={() => setCreating(false)}>
          <ProductWizard
            catName={cat.name}
            onClose={(n) => {
              setCreating(false);
              if (n) navigate(`/product/specs?cat=${encodeURIComponent(cat.name)}&type=${encodeURIComponent(n)}`);
            }}
          />
        </CenterModal>
      )}

      {editing && (
        <CenterModal title={`编辑产品类型 · ${editing.name}`} onClose={() => setEditing(null)} width={520}>
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-0.5 text-[#4E5969]">状态</div>
                <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as ProductType["status"] })}>
                  <option>启用</option><option>停用</option>
                </select>
              </div>
              <div>
                <div className="mb-0.5 text-[#4E5969]">SLA 等级</div>
                <Input placeholder="如 99.9%，可空" value={editing.sla ?? ""} onChange={(e) => setEditing({ ...editing, sla: e.target.value })} />
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">计费周期</div>
              <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={editing.billingCycle ?? ""} onChange={(e) => setEditing({ ...editing, billingCycle: e.target.value || undefined })}>
                <option value="">未设置</option><option>月付</option><option>季付</option><option>半年付</option><option>年付</option><option>一次性</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-0.5 text-[#4E5969]">税率（%）</div>
                <Input placeholder="如 6 / 9 / 13，可空" value={editing.taxRate ?? ""} onChange={(e) => setEditing({ ...editing, taxRate: e.target.value })} />
              </div>
              <div>
                <div className="mb-0.5 text-[#4E5969]">标准交付周期（个工作日）</div>
                <Input type="number" placeholder="可空" value={editing.leadTime ?? ""} onChange={(e) => setEditing({ ...editing, leadTime: e.target.value })} />
              </div>
            </div>
            <div className="rounded-[2px] bg-[#F7F8FA] px-2.5 py-2 text-[11px] leading-5 text-[#86909C]">
              「核算装配」（卖一单算哪几笔账）已与商务属性剥离，在资源清单独立维护（产品组成推导直接成本 + 勾选成本中心，含版本历史）：
              <Link className="ml-1 text-[#165DFF] hover:underline"
                to={`/product/bom?cat=${encodeURIComponent(cat.name)}&type=${encodeURIComponent(editing.name!)}`}>前往资源清单 →</Link>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>取消</Button>
              <Button size="sm" onClick={saveEdit}>保存</Button>
            </div>
          </div>
        </CenterModal>
      )}
    </ArcoShell>
  );
}
