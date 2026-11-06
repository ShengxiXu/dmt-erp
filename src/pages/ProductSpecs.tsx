// 产品规格 · 第 3 级：某产品类型的规格字段 + 套餐维护（客户下单选什么）
//   /product/specs?cat=&type=（从产品类型列表行点入；侧边栏无独立菜单项）
// 口径说明：规格字段只定义「客户下单选什么」；算账口径的唯一出处在成本条目库，
// 条目按约定直接读订单行规格值（同名字段自动对应），不在字段上挂显式绑定。
import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { useCatalog, getCats, GET_TYPE, SPEC_FIELDS, updateType, moveField, buildSpec, savePlan, removePlan, type SpecField, type Plan } from "@/data/products";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ProductSpecs() {
  useCatalog();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const catName = sp.get("cat") ?? "";
  const typeName = sp.get("type") ?? "";
  const type = GET_TYPE(catName, typeName);
  // 未带参数进入时，先选择产品类型再维护
  const [pickCat, setPickCat] = useState(catName || getCats()[0]?.name || "");
  const [pickType, setPickType] = useState(typeName);
  const [editing, setEditing] = useState<(SpecField & { optionsText?: string }) | null>(null);
  const [planEditing, setPlanEditing] = useState<(Plan & { isNew?: boolean }) | null>(null); // 套餐编辑
  const [applyTargets, setApplyTargets] = useState<string[]>([]); // 同步应用的目标："cat||type"

  if (!type) {
    const catObj = getCats().find((c) => c.name === pickCat);
    const types = catObj?.types ?? [];
    const pt = types.some((t) => t.name === pickType) ? pickType : (types[0]?.name ?? "");
    return (
      <ArcoShell breadcrumb="产品规格 / 选择产品类型">
        <main className="p-6">
          <div className="max-w-md space-y-3 rounded-[4px] border border-[#E5E6EB] bg-white p-6 text-xs">
            <div className="text-sm font-semibold text-[#1D2129]">先选择要维护的产品类型</div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">产品类别</div>
              <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={pickCat}
                onChange={(e) => { setPickCat(e.target.value); setPickType(""); }}>
                {getCats().map((c) => <option key={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">产品类型</div>
              <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={pt}
                onChange={(e) => setPickType(e.target.value)}>
                {types.map((t) => <option key={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end border-t border-[#F2F3F5] pt-3">
              <Button size="sm" disabled={!pt}
                onClick={() => navigate(`/product/specs?cat=${encodeURIComponent(pickCat)}&type=${encodeURIComponent(pt)}`)}>
                进入维护
              </Button>
            </div>
          </div>
        </main>
      </ArcoShell>
    );
  }

  const fields = SPEC_FIELDS(catName, typeName);
  const patch = (p: Partial<typeof type>) => updateType(catName, typeName, p);

  const saveField = () => {
    if (!editing) return;
    if (!editing.label.trim()) return alert("请填写字段名称");
    const options = (editing.optionsText ?? (editing.options ?? []).join("\n"))
      .split("\n").map((s) => s.trim()).filter(Boolean);
    if (editing.type === "select" && !options.length) return alert("单选类型至少需要一个可选项");
    const key = editing.key || `f${Date.now() % 10000}`;
    const exists = fields.some((f) => f.key === key);
    const clean: SpecField = { key, label: editing.label, type: editing.type, options: editing.type === "select" ? options : undefined, placeholder: editing.placeholder, required: editing.required };
    patch({ specFields: exists ? fields.map((f) => (f.key === key ? clean : f)) : [...fields, clean] });
    // 新建字段时：同步应用到勾选的其他产品类型（目标里已有同名字段则跳过）
    if (!exists) {
      const skipped: string[] = [];
      for (const target of applyTargets) {
        const [tc, tt] = target.split("||");
        const targetType = GET_TYPE(tc, tt);
        if (!targetType) continue;
        if (targetType.specFields.some((f) => f.label === clean.label)) { skipped.push(`${tc} / ${tt}`); continue; }
        updateType(tc, tt, { specFields: [...targetType.specFields, { ...clean, key: `${clean.key}_${Date.now() % 100000}` }] });
      }
      if (skipped.length) alert(`以下类型已存在同名字段，已跳过：\n${skipped.join("\n")}`);
    }
    setEditing(null);
    setApplyTargets([]);
  };

  // 规格摘要实时预览（用每字段第一个可选项 / 占位示意）
  const preview = buildSpec(catName, typeName, Object.fromEntries(fields.map((f) => [f.key, f.type === "select" ? (f.options?.[0] ?? "") : f.type === "switch" ? "是/否" : (f.placeholder ?? (f.type === "date" ? "2026-01-01" : "—"))])));

  return (
    <ArcoShell breadcrumb={`产品规格 / ${catName} / ${typeName}`}>
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#1D2129]">产品规格</span>
            <span className="rounded-[2px] bg-[#F2F3F5] px-2 py-0.5 text-[11px] text-[#4E5969]">{catName}</span>
            <span className="rounded-[2px] bg-[#E8F3FF] px-2 py-0.5 text-[11px] text-[#165DFF]">{typeName}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate(`/product/types?cat=${encodeURIComponent(catName)}`)}>返回</Button>
            <Button size="sm" onClick={() => setEditing({ key: `f${Date.now() % 10000}`, label: "", type: "select", options: [], optionsText: "", required: false })}>＋ 新增字段</Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="w-14 px-3 py-2">排序</th><th className="px-3 py-2">字段名称</th><th className="px-3 py-2">类型</th><th className="px-3 py-2">可选项 / 占位</th>
                <th className="px-3 py-2">必填</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f, i) => (
                <tr key={f.key} className="border-b last:border-0">
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <button disabled={i === 0} className="text-[10px] text-[#165DFF] disabled:opacity-20" title="上移" onClick={() => moveField(catName, typeName, i, -1)}>▲</button>
                      <button disabled={i === fields.length - 1} className="text-[10px] text-[#165DFF] disabled:opacity-20" title="下移" onClick={() => moveField(catName, typeName, i, 1)}>▼</button>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-[#1D2129]">{f.label}<span className="ml-1.5 font-mono text-[10px] text-[#C9CDD4]">{f.key}</span></td>
                  <td className="px-3 py-2.5 text-[#4E5969]">{f.type === "select" ? "选档位" : f.type === "number" ? "填数字" : f.type === "date" ? "选日期" : f.type === "switch" ? "是/否" : "填文字"}</td>
                  <td className="max-w-[240px] truncate px-3 py-2.5 text-[#4E5969]">{f.type === "select" ? (f.options ?? []).join(" / ") : f.placeholder}</td>
                  <td className="px-3 py-2.5">{f.required ? <span className="text-[#F53F3F]">必填</span> : <span className="text-[#C9CDD4]">选填</span>}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button className="mr-2 text-[#165DFF] hover:underline" onClick={() => { setApplyTargets([]); setEditing({ ...f, optionsText: (f.options ?? []).join("\n") }); }}>编辑</button>
                    <button className="text-[#F53F3F] hover:underline" onClick={() => patch({ specFields: fields.filter((_, j) => j !== i) })}>删除</button>
                  </td>
                </tr>
              ))}
              {!fields.length && <tr><td colSpan={6} className="px-3 py-10 text-center text-[#C9CDD4]">暂无规格字段，点右上角「新增字段」创建</td></tr>}
            </tbody>
          </table>
          {preview && <div className="border-t border-dashed border-[#E5E6EB] px-4 py-2 font-mono text-[11px] text-[#165DFF]">规格摘要样式预览：{preview}</div>}
        </div>

        {/* ===== 套餐：把客户常买的规格搭配打包定价（不改算账逻辑） ===== */}
        <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
          <div className="flex items-center justify-between border-b border-[#F2F3F5] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#1D2129]">套餐</span>
              <span className="text-[11px] text-[#86909C]">把客户常买的几种规格搭配事先打包、每个包定个价；客户下单选套餐即带出规格，算账逻辑由资源清单决定</span>
            </div>
            <Button size="sm" variant="outline" disabled={!fields.length}
              title={fields.length ? "" : "先在上面创建规格字段，套餐才有可预设的内容"}
              onClick={() => setPlanEditing({ id: `plan_${Date.now() % 100000}`, name: "", price: undefined, values: {}, remark: "", isNew: true })}>
              ＋ 新增套餐
            </Button>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">套餐名</th><th className="px-3 py-2">套餐价（元/月）</th><th className="px-3 py-2">规格预设</th><th className="px-3 py-2">备注</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {(type.plans ?? []).map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-3 py-2.5 font-medium text-[#1D2129]">{p.name}</td>
                  <td className="px-3 py-2.5 font-mono text-[#4E5969]">{p.price ? p.price.toLocaleString("zh-CN") : "—"}</td>
                  <td className="max-w-[320px] truncate px-3 py-2.5 font-mono text-[11px] text-[#165DFF]" title={buildSpec(catName, typeName, p.values)}>
                    {buildSpec(catName, typeName, p.values) || "（未预设规格）"}
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-2.5 text-[#86909C]">{p.remark ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button className="mr-2 text-[#165DFF] hover:underline" onClick={() => setPlanEditing({ ...p, isNew: false })}>编辑</button>
                    <button className="text-[#F53F3F] hover:underline" onClick={() => {
                      if (confirm(`删除套餐「${p.name}」？已签合同不受影响（保存的是快照）。`)) removePlan(catName, typeName, p.id);
                    }}>删除</button>
                  </td>
                </tr>
              ))}
              {!(type.plans ?? []).length && <tr><td colSpan={5} className="px-3 py-8 text-center text-[#C9CDD4]">暂无套餐：客户下单时只能逐项自由组合规格</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          说明：① 字段按列表顺序拼接规格摘要，用「▲▼」调整顺序；② 已有合同 / 核算单保存的是规格文本快照，本页改版不影响历史单据；③ 算账口径的唯一出处在成本条目库：条目按约定直接读订单行规格值（字段名 / key 同名即自动对应），开通核算时无需在字段上做任何绑定配置；④ 套餐只打包「规格预设 + 价格」，不改动算账逻辑——同一套餐与散卖的成本完全一致。
        </div>
      </main>

      {/* 套餐编辑：居中弹窗 */}
      {planEditing && (
        <CenterModal title={`${planEditing.isNew ? "新增套餐" : "编辑套餐"} · ${typeName}`} sub="把规格预设好、定个价；客户下单选它，规格自动带出" onClose={() => setPlanEditing(null)} width={520}>
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-0.5 text-[#4E5969]">套餐名 <span className="text-[#F53F3F]">*</span></div>
                <Input autoFocus placeholder="如：标准版 / 尊享版" value={planEditing.name} onChange={(e) => setPlanEditing({ ...planEditing, name: e.target.value })} />
              </div>
              <div>
                <div className="mb-0.5 text-[#4E5969]">套餐价（元/月，可空）</div>
                <Input type="number" placeholder="客户选此套餐的默认月租" value={planEditing.price ?? ""} onChange={(e) => setPlanEditing({ ...planEditing, price: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
            </div>
            <div>
              <div className="mb-1 text-[#4E5969]">规格预设（留空的规格，客户下单时再自己选）</div>
              <div className="space-y-2 rounded-[2px] border border-[#E5E6EB] p-2.5">
                {fields.map((f) => (
                  <div key={f.key} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-[#4E5969]">{f.label}{f.required && <span className="text-[#F53F3F]"> *</span>}</span>
                    {f.type === "select" ? (
                      <select className="flex-1 rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1" value={planEditing.values[f.key] ?? ""}
                        onChange={(e) => setPlanEditing({ ...planEditing, values: { ...planEditing.values, [f.key]: e.target.value } })}>
                        <option value="">（不预设）</option>
                        {f.options!.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <Input className="h-7 flex-1" placeholder={f.placeholder ?? "不预设"} value={planEditing.values[f.key] ?? ""}
                        onChange={(e) => setPlanEditing({ ...planEditing, values: { ...planEditing.values, [f.key]: e.target.value } })} />
                    )}
                  </div>
                ))}
                {!fields.length && <div className="text-[11px] text-[#C9CDD4]">还没有规格字段，请先在上方创建</div>}
              </div>
              <div className="mt-1 text-[10px] text-[#C9CDD4]">建议必填字段都预设：否则客户选了这个套餐还得补选，套餐就失去意义了。</div>
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">备注（可空）</div>
              <Input placeholder="如：中小客户主推 / 含优先排障" value={planEditing.remark ?? ""} onChange={(e) => setPlanEditing({ ...planEditing, remark: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <Button variant="outline" size="sm" onClick={() => setPlanEditing(null)}>取消</Button>
              <Button size="sm" onClick={() => {
                if (!planEditing.name.trim()) return alert("请填写套餐名");
                savePlan(catName, typeName, { id: planEditing.id, name: planEditing.name.trim(), price: planEditing.price, values: planEditing.values, remark: planEditing.remark || undefined });
                setPlanEditing(null);
              }}>保存套餐</Button>
            </div>
          </div>
        </CenterModal>
      )}

      {/* 字段编辑：居中弹窗 */}
      {editing && (
        <CenterModal title={`${fields.some((f) => f.key === editing.key) ? "编辑规格" : "新建规格"} · ${typeName}`} sub="客户下单时要逐项选的内容" onClose={() => setEditing(null)} width={480}>
          <div className="space-y-3 text-xs">
            <div>
              <div className="mb-0.5 text-[#4E5969]">规格名称 <span className="text-[#F53F3F]">*</span>（客户下单时看到的）</div>
              <Input autoFocus placeholder="如：带宽 / IP / 基础线路" value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">字段 key（存储标识，英文字母）</div>
              <Input value={editing.key} onChange={(e) => setEditing({ ...editing, key: e.target.value.replace(/[^a-z0-9_]/g, "") })} />
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">客户怎么选</div>
              <div className="flex flex-wrap rounded-[2px] border border-[#E5E6EB] p-0.5">
                {([["select", "单选（固定档位）"], ["number", "数值"], ["date", "日期"], ["switch", "是/否"], ["text", "文本"]] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setEditing({ ...editing, type: k })} className={`flex-1 whitespace-nowrap rounded-[2px] px-2 py-1.5 text-xs ${editing.type === k ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{label}</button>
                ))}
              </div>
            </div>
            {editing.type === "select" ? (
              <div>
                <div className="mb-0.5 text-[#4E5969]">有哪些档位？每行一个</div>
                <textarea className="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5 font-mono text-xs" rows={5}
                  value={editing.optionsText ?? (editing.options ?? []).join("\n")}
                  onChange={(e) => setEditing({ ...editing, optionsText: e.target.value })} />
              </div>
            ) : editing.type === "switch" ? (
              <div className="rounded-[2px] bg-[#F7F8FA] px-2.5 py-2 text-[11px] text-[#86909C]">客户在「是 / 否」中选一个，无需配置可选项。</div>
            ) : (
              <div>
                <div className="mb-0.5 text-[#4E5969]">{editing.type === "date" ? "日期提示（可空）" : "输入框提示语"}</div>
                <Input placeholder={editing.type === "number" ? "如：台数 / 个数" : editing.type === "date" ? "如：期望开通日期" : "如：机房位置 / 备注"} value={editing.placeholder ?? ""} onChange={(e) => setEditing({ ...editing, placeholder: e.target.value })} />
              </div>
            )}
            <label className="flex items-center gap-2 text-xs text-[#4E5969]">
              <input type="checkbox" className="accent-[#165DFF]" checked={!!editing.required} onChange={(e) => setEditing({ ...editing, required: e.target.checked })} />
              必选项（客户不下单前必须选它）
            </label>
            {/* 新建字段：可同步应用到其他产品类型 */}
            {!fields.some((f) => f.key === editing.key) && (
              <div>
                <div className="mb-1 text-[#4E5969]">同步应用到其他产品类型（可选）</div>
                <div className="max-h-36 overflow-y-auto rounded-[2px] border border-[#E5E6EB] p-2">
                  {getCats().map((c) => (
                    <div key={c.name}>
                      <div className="px-1 pb-0.5 pt-1 text-[10px] font-semibold text-[#86909C]">{c.name}</div>
                      {c.types.filter((t) => !(c.name === catName && t.name === typeName)).map((t) => {
                        const id = `${c.name}||${t.name}`;
                        return (
                          <label key={id} className="flex cursor-pointer items-center gap-2 px-2 py-0.5 text-xs text-[#4E5969] hover:bg-[#F7F8FA]">
                            <input type="checkbox" className="accent-[#165DFF]" checked={applyTargets.includes(id)}
                              onChange={(e) => setApplyTargets(e.target.checked ? [...applyTargets, id] : applyTargets.filter((x) => x !== id))} />
                            {t.name}{t.status === "停用" && <span className="text-[10px] text-[#C9CDD4]">（已停用）</span>}
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {applyTargets.length > 0 && <div className="mt-1 text-[10px] text-[#165DFF]">将同步新增到 {applyTargets.length} 个产品类型（目标中已有同名字段的会自动跳过）</div>}
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>取消</Button>
              <Button size="sm" onClick={saveField}>保存字段</Button>
            </div>
          </div>
        </CenterModal>
      )}
    </ArcoShell>
  );
}
