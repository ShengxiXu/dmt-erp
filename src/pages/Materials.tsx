// 资源目录 · 独立主数据：资源的通用定义（名称 / 形态 / 属性模板）
// 资源清单不重复定义资源，只从这里选用（引用 libKey）+ 挂本产品自己的直接成本条目。
// 与成本条目库的关系：资源 = 产品由什么组成；成本条目 = 这笔账怎么算。
// 属性模板：类定义字段（label/类型/选项/说明），资源中心对应档案页的表单按此渲染，实例填值。
import { useState } from "react";
import { Link } from "react-router";
import { useCatalog, getMaterials, saveMaterial, removeMaterial, MAT_REFS, MATERIAL_GROUPS, type MaterialDef, type FieldDef } from "@/data/products";
import { ARCHIVES_OF_MATERIAL } from "@/data/resources";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const METHOD_LABEL: Record<FieldDef["method"], string> = {
  text: "文本", enum: "枚举", search: "关联搜索", region: "省市区", calc: "计算值", readonly: "系统只读",
};

const FORM_STYLE: Record<MaterialDef["form"], string> = {
  实物: "bg-[#FFF3E8] text-[#FF7D00]",
  服务化资源: "bg-[#E8F3FF] text-[#165DFF]",
  人工服务: "bg-[#F2F3F5] text-[#4E5969]",
};

/** 属性模板编辑弹窗：维护某资源类的字段定义（资源中心对应档案页的表单按此渲染） */
function AttrModal({ m, onClose }: { m: MaterialDef; onClose: () => void }) {
  const [rows, setRows] = useState<FieldDef[]>(m.attrs ?? []);
  const [f, setF] = useState<(FieldDef & { idx?: number }) | null>(null);

  const saveField = () => {
    if (!f) return;
    if (!f.label.trim() || !f.key.trim()) return alert("请填写字段名称与字段 key");
    if (rows.some((r, i) => r.key === f.key.trim() && i !== f.idx)) return alert(`字段 key「${f.key.trim()}」已存在，key 是算账取数的锚点，不可重复`);
    const row: FieldDef = {
      key: f.key.trim(), label: f.label.trim(), method: f.method,
      options: f.options?.length ? f.options : undefined,
      source: f.source || undefined, placeholder: f.placeholder || undefined,
      numeric: f.numeric || undefined, dynamic: f.dynamic || undefined,
    };
    setRows(f.idx == null ? [...rows, row] : rows.map((r, i) => (i === f.idx ? row : r)));
    setF(null);
  };

  return (
    <CenterModal title={`属性模板 · ${m.name}`} sub="类定义字段，资源中心档案页的表单按此渲染；key 是算账取数的锚点，创建后不建议改" width={720} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[#86909C]">共 {rows.length} 个字段；带「②」标记的是业务过程实时值（只读、不可手改）</span>
          <Button size="sm" variant="outline" onClick={() => setF({ key: "", label: "", method: "text" })}>＋ 新增字段</Button>
        </div>

        {f && (
          <div className="space-y-2 rounded-[4px] border border-[#94BFFF] bg-[#F7F8FA] p-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="mb-0.5 text-[#4E5969]">字段名称 <span className="text-[#F53F3F]">*</span></div>
                <Input autoFocus placeholder="如：月租(元)" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
              </div>
              <div>
                <div className="mb-0.5 text-[#4E5969]">字段 key <span className="text-[#F53F3F]">*</span>（英文，取数锚点）</div>
                <Input placeholder="如：monthlyCost" value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} />
              </div>
              <div>
                <div className="mb-0.5 text-[#4E5969]">类型</div>
                <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
                  {(Object.keys(METHOD_LABEL) as FieldDef["method"][]).map((k) => (
                    <button key={k} onClick={() => setF({ ...f, method: k })}
                      className={`flex-1 rounded-[2px] px-1 py-1 text-[10px] ${f.method === k ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{METHOD_LABEL[k]}</button>
                  ))}
                </div>
              </div>
            </div>
            {f.method === "enum" && (
              <div>
                <div className="mb-0.5 text-[#4E5969]">枚举选项（顿号分隔）</div>
                <Input placeholder="如：电信、联通、移动" value={(f.options ?? []).join("、")} onChange={(e) => setF({ ...f, options: e.target.value.split(/[、,，]/).map((s) => s.trim()).filter(Boolean) })} />
              </div>
            )}
            {f.method === "search" && (
              <div>
                <div className="mb-0.5 text-[#4E5969]">数据来源说明</div>
                <Input placeholder="如：采购合同档案（下拉选择）" value={f.source ?? ""} onChange={(e) => setF({ ...f, source: e.target.value })} />
              </div>
            )}
            <div>
              <div className="mb-0.5 text-[#4E5969]">占位说明（表单内灰字提示，可空）</div>
              <Input placeholder="填写引导语，如：向运营商采购的固定月租" value={f.placeholder ?? ""} onChange={(e) => setF({ ...f, placeholder: e.target.value })} />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-[#4E5969]">
                <input type="checkbox" checked={!!f.numeric} onChange={(e) => setF({ ...f, numeric: e.target.checked || undefined })} />
                数值字段（参与算账取数）
              </label>
              <label className="flex items-center gap-1.5 text-[#4E5969]">
                <input type="checkbox" checked={!!f.dynamic} onChange={(e) => setF({ ...f, dynamic: e.target.checked || undefined, method: e.target.checked ? "calc" : f.method })} />
                业务过程实时值（②层，只读）
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#E5E6EB] pt-2">
              <Button variant="outline" size="sm" onClick={() => setF(null)}>取消</Button>
              <Button size="sm" onClick={saveField}>{f.idx == null ? "添加字段" : "保存修改"}</Button>
            </div>
          </div>
        )}

        <div className="max-h-72 overflow-y-auto rounded-[4px] border border-[#E5E6EB]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">字段名称</th><th className="px-3 py-2">key</th><th className="px-3 py-2">类型</th>
                <th className="px-3 py-2">取值 / 说明</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium text-[#1D2129]">
                    {r.label}{r.dynamic && <span className="ml-1 rounded-[2px] bg-[#E8F3FF] px-1 text-[10px] text-[#165DFF]">②</span>}
                    {r.numeric && <span className="ml-1 rounded-[2px] bg-[#FFF3E8] px-1 text-[10px] text-[#FF7D00]">数值</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-[#86909C]">{r.key}</td>
                  <td className="px-3 py-2 text-[#4E5969]">{METHOD_LABEL[r.method]}</td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-[#86909C]" title={r.options?.join("、") ?? r.source ?? r.placeholder}>{r.options?.length ? r.options.join("、") : r.source ?? r.placeholder ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button className="mr-2 text-[#165DFF] hover:underline" onClick={() => setF({ ...r, idx: i })}>编辑</button>
                    <button className="text-[#F53F3F] hover:underline" onClick={() => {
                      if (rows.filter((x) => x.numeric).length <= 1 && r.numeric) return alert("至少保留一个数值字段：算账取数需要数值锚点");
                      if (!confirm(`删除字段「${r.label}」？已有档案的该字段值将不再显示。`)) return;
                      setRows(rows.filter((_, j) => j !== i));
                    }}>删除</button>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-[#C9CDD4]">暂无字段定义，点右上角「新增字段」创建</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-[#F2F3F5] pt-3">
          <span className="text-[10px] text-[#C9CDD4]">保存后资源中心对应档案页（{ARCHIVES_OF_MATERIAL(m.key).map((a) => a.code).join(" / ") || "无档案"}）的表单立即按新模板渲染</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
            <Button size="sm" onClick={() => { saveMaterial({ ...m, attrs: rows }); onClose(); }}>保存模板</Button>
          </div>
        </div>
      </div>
    </CenterModal>
  );
}

export default function Materials() {
  useCatalog();
  const [editing, setEditing] = useState<(MaterialDef & { isNew?: boolean }) | null>(null);
  const [attrM, setAttrM] = useState<MaterialDef | null>(null);
  const [kw, setKw] = useState("");
  const shown = getMaterials().filter((m) => !kw || m.name.includes(kw) || (m.group ?? "").includes(kw) || m.key.includes(kw));

  const save = () => {
    if (!editing) return;
    if (!editing.name.trim()) return alert("请填写资源名称");
    saveMaterial({
      key: editing.key, name: editing.name.trim(), form: editing.form,
      group: editing.group || undefined, status: editing.status ?? "启用",
      remark: editing.remark || undefined, attrs: editing.attrs,
    });
    setEditing(null);
  };
  const toggleStatus = (m: MaterialDef) => {
    const refs = MAT_REFS(m.key);
    const next = m.status === "停用" ? "启用" : "停用";
    if (next === "停用" && refs.length
      && !confirm(`停用「${m.name}」：已被 ${refs.length} 个产品类型的资源清单引用，存量不受影响，但新产品不能再选用。确定停用？`)) return;
    saveMaterial({ ...m, status: next });
  };

  return (
    <ArcoShell breadcrumb="资源目录">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div>
            <span className="text-sm font-semibold text-[#1D2129]">资源目录</span>
            <span className="ml-2 text-[11px] text-[#86909C]">资源的通用定义：产品由哪些实体 / 服务组成。资源清单从这里选用资源、再挂各自的成本条目</span>
          </div>
          <div className="flex items-center gap-2">
            <Input className="w-52" placeholder="搜索资源名称 / 分类 / 编码" value={kw} onChange={(e) => setKw(e.target.value)} />
            <Button size="sm" onClick={() => setEditing({ key: `mat_${Date.now() % 100000}`, name: "", form: "服务化资源", group: "", status: "启用", remark: "", isNew: true })}>＋ 新增资源</Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">资源名称</th><th className="px-3 py-2">形态</th><th className="px-3 py-2">分类</th><th className="px-3 py-2">状态</th><th className="px-3 py-2">实例档案</th>
                <th className="px-3 py-2">备注</th><th className="px-3 py-2">被引用</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => {
                const refs = MAT_REFS(m.key);
                const off = m.status === "停用";
                return (
                  <tr key={m.key} className={`border-b last:border-0 ${off ? "opacity-55" : ""}`}>
                    <td className="px-3 py-2.5 font-medium text-[#1D2129]">{m.name}<span className="ml-1.5 font-mono text-[10px] text-[#C9CDD4]">{m.key}</span></td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${FORM_STYLE[m.form]}`}>{m.form}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[#4E5969]">{m.group ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      {off
                        ? <span className="rounded-[2px] bg-[#FFECE8] px-1.5 py-0.5 text-[10px] text-[#F53F3F]">已停用</span>
                        : <span className="rounded-[2px] bg-[#E8F8F2] px-1.5 py-0.5 text-[10px] text-[#00B42A]">启用</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {ARCHIVES_OF_MATERIAL(m.key).length
                        ? ARCHIVES_OF_MATERIAL(m.key).map((a) => (
                            <Link key={a.key} className="mr-1.5 text-[#165DFF] hover:underline" to={`/resources/${a.key}`}>{a.code}</Link>
                          ))
                        : <span className="text-[#C9CDD4]">—</span>}
                    </td>
                    <td className="max-w-[240px] truncate px-3 py-2.5 text-[#86909C]" title={m.remark}>{m.remark ?? "—"}</td>
                    <td className="max-w-[220px] truncate px-3 py-2.5 text-[#4E5969]" title={refs.join("\n")}>
                      {refs.length ? `${refs.length} 个产品类型` : <span className="text-[#C9CDD4]">未引用</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button className="mr-2 text-[#165DFF] hover:underline" onClick={() => setEditing({ ...m, isNew: false })}>编辑</button>
                      <button className="mr-2 text-[#165DFF] hover:underline" onClick={() => setAttrM(m)}>属性模板{m.attrs?.length ? `(${m.attrs.length})` : ""}</button>
                      <button className={`mr-2 hover:underline ${off ? "text-[#00B42A]" : "text-[#FF7D00]"}`} onClick={() => toggleStatus(m)}>{off ? "启用" : "停用"}</button>
                      <button className="text-[#F53F3F] hover:underline" onClick={() => {
                        if (refs.length) {
                          if (!confirm(`资源「${m.name}」正被 ${refs.length} 个产品类型的资源清单引用：\n${refs.join("\n")}\n\n建议改用「停用」（存量清单保留显示）；物理删除后这些清单行会标「资源目录已删除」。确定删除？`)) return;
                        } else if (!confirm(`删除资源「${m.name}」？建议优先使用「停用」留档。确定删除？`)) return;
                        removeMaterial(m.key);
                      }}>删除</button>
                    </td>
                  </tr>
                );
              })}
              {!shown.length && <tr><td colSpan={8} className="px-3 py-10 text-center text-[#C9CDD4]">{kw ? "无匹配资源" : "资源目录为空，点右上角「新增资源」创建"}</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          ① 资源只管「产品由什么组成」，<strong className="text-[#4E5969]">不算账</strong>：账怎么算由成本条目库决定。资源是「类」，资源中心的档案是它的实例（「出口线路」资源 ↔ 一条条具体线路，见「实例档案」列）；
          ② 资源清单从这里选用资源；直接成本由组成自动推导，不需要逐个勾条目；
          ③ 有档案的类可点「属性模板」维护字段定义，资源中心对应档案页的表单按模板渲染；
          ④ 改名 / 改形态全库同步生效；「停用」留档，「删除」仅限从未被引用时。
          管理算账口径请到 <Link className="text-[#165DFF] hover:underline" to="/cost-items">成本条目库 →</Link>。
        </div>
      </main>

      {attrM && <AttrModal m={attrM} onClose={() => setAttrM(null)} />}

      {editing && (
        <CenterModal title={`${editing.isNew ? "新增资源" : "编辑资源"}`} sub="资源的通用定义：所有资源清单共享" onClose={() => setEditing(null)} width={460}>
          <div className="space-y-3 text-xs">
            <div>
              <div className="mb-0.5 text-[#4E5969]">资源名称 <span className="text-[#F53F3F]">*</span>（如：出口线路 / 网络设备 / 安装调测服务）</div>
              <Input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">形态</div>
              <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
                {(["实物", "服务化资源", "人工服务"] as const).map((f) => (
                  <button key={f} onClick={() => setEditing({ ...editing, form: f })}
                    className={`flex-1 rounded-[2px] px-2 py-1.5 ${editing.form === f ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{f}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">分类（行业标准归组；可从预设选，也可输入自定义）</div>
              <Input list="mat-group-opts" placeholder="如：线路资源 / 设备与备件 / 交付服务" value={editing.group ?? ""} onChange={(e) => setEditing({ ...editing, group: e.target.value })} />
              <datalist id="mat-group-opts">
                {MATERIAL_GROUPS.map((g) => <option key={g} value={g} />)}
              </datalist>
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">备注（可空）</div>
              <Input placeholder="如：向运营商采购的出口，可多家客户共享" value={editing.remark ?? ""} onChange={(e) => setEditing({ ...editing, remark: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>取消</Button>
              <Button size="sm" onClick={save}>保存资源</Button>
            </div>
          </div>
        </CenterModal>
      )}
    </ArcoShell>
  );
}
