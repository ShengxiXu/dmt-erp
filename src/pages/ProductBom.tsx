// 资源清单 · 独立维护页（自己的菜单入口，不是其他主数据里的一个页签）
//   /product/bom：产品由哪些资源组成（唯一手工入口）→ 直接成本由组成自动推导（可单个剔除）+ 成本中心勾选（间接）+ 版本历史
// 推导链：组成资源 → 条目的「适用资源」→ 直接成本自动进入核算单；无需逐个勾条目，也不会选出不一致的组合。
import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router";
import { useCatalog, getCats, GET_TYPE, updateType, COST_ITEM_NAME, getMaterials, MAT_DEF, type Material } from "@/data/products";
import { getCostItems, useCostItems } from "@/data/costItems";
import { getCenters, useCenters } from "@/data/costCenters";
import { ARCHIVES_OF_MATERIAL } from "@/data/resources";
import { typeProblems } from "@/data/chain";
import { CostGuide } from "@/components/Chain";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ProductBom() {
  useCatalog();
  useCostItems();
  useCenters();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const catName = sp.get("cat") ?? "";
  const typeName = sp.get("type") ?? "";
  const type = GET_TYPE(catName, typeName);
  // 未带参数进入（从菜单直接点入）时：产品目录——行业标准的清单维护入口，列表选择而非下拉跳转
  const [kw, setKw] = useState("");
  const [showCalc, setShowCalc] = useState(false); // 「这个产品怎么算账」逻辑树，默认收起
  // 清单草稿：产品资源（唯一手工入口）+ 剔除项 + 成本中心勾选；直接成本由组成推导。保存时由 store 自动升版本
  const [materials, setMaterials] = useState<Material[]>([]);
  const [off, setOff] = useState<string[]>([]);         // 推导结果中被单个剔除的直接条目 key（如转售只要 rs1 不要 rs2）
  const [centers, setCenters] = useState<string[]>([]); // 用到的成本中心（间接）
  const [pickOpen, setPickOpen] = useState(false); // 从资源目录选用资源
  const [histOpen, setHistOpen] = useState(false); // 版本历史展开
  useEffect(() => {
    setMaterials(type?.materials ?? []);
    setOff(type?.directOff ?? []);
    setCenters(type?.centers ?? []);
    setHistOpen(false);
  }, [catName, typeName, type?.asmVersion]);

  if (!type) {
    // 产品目录：列出全部产品类型的清单现状，点行进入维护（行业标准的列表式入口）
    const rows = getCats().flatMap((c) => c.types.map((t) => ({ cat: c, t })));
    const filtered = rows.filter(({ cat, t }) =>
      !kw.trim() || t.name.includes(kw.trim()) || cat.name.includes(kw.trim()));
    return (
      <ArcoShell breadcrumb="资源清单">
        <main className="space-y-4 p-6">
          <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
            <div>
              <span className="text-sm font-semibold text-[#1D2129]">资源清单</span>
              <span className="ml-2 text-[11px] text-[#86909C]">选择产品类型进入维护：清单 = 这个产品由哪些资源组成（直接成本自动推导）+ 用哪些成本中心（间接费用）</span>
            </div>
            <Input className="h-7 w-56 text-xs" placeholder="搜索产品类型 / 类别" value={kw} onChange={(e) => setKw(e.target.value)} />
          </div>

          <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                  <th className="px-3 py-2">产品类别</th><th className="px-3 py-2">产品类型</th>
                  <th className="px-3 py-2 text-right">清单资源</th><th className="px-3 py-2 text-right">间接成本中心</th>
                  <th className="px-3 py-2 text-right">账目数</th><th className="px-3 py-2 text-right">版本</th>
                  <th className="px-3 py-2">算账口径</th><th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ cat, t }) => {
                  const todos = typeProblems(t, getCostItems()).length;
                  const matN = t.materials?.length ?? 0;
                  const ctrN = t.centers?.length ?? 0;
                  const enter = () => navigate(`/product/bom?cat=${encodeURIComponent(cat.name)}&type=${encodeURIComponent(t.name)}`);
                  return (
                    <tr key={`${cat.name}/${t.name}`} className="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]" onClick={enter}>
                      <td className="px-3 py-2.5 text-[#86909C]">{cat.name}</td>
                      <td className="px-3 py-2.5 font-medium text-[#1D2129]">{t.name}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#4E5969]">{matN || <span className="text-[#FF7D00]">未归组</span>}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#4E5969]">{ctrN || <span className="text-[#C9CDD4]">0</span>}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#4E5969]">{t.costItems.length}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#4E5969]">v{t.asmVersion}</td>
                      <td className="px-3 py-2.5">
                        {todos
                          ? <span className="rounded-[2px] bg-[#FFECE8] px-1.5 py-0.5 text-[10px] text-[#F53F3F]">{todos} 项待补</span>
                          : <span className="text-[10px] text-[#00B42A]">✓ 齐全</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button className="rounded-[2px] border border-[#94BFFF] px-2 py-0.5 text-[10px] text-[#165DFF] hover:bg-[#E8F3FF]"
                          onClick={(e) => { e.stopPropagation(); enter(); }}>
                          {matN ? "维护清单" : "去建清单"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && <tr><td colSpan={8} className="px-3 py-10 text-center text-[#C9CDD4]">没有匹配的产品类型</td></tr>}
              </tbody>
            </table>
          </div>
        </main>
      </ArcoShell>
    );
  }

  const patch = (p: Partial<typeof type>) => updateType(catName, typeName, p);
  /** 算账配置待办数（按钮上的状态角标） */
  const calcTodos = typeProblems(type, getCostItems()).length;
  // ---------- 直接成本推导：组成里的资源类 → 适用资源命中的直接条目（自动带出，可单个剔除） ----------
  const compKeys = materials.map((m) => m.libKey);
  const autoDirect = getCostItems().filter((i) => i.settleType !== "间接" && i.appliesTo && compKeys.includes(i.appliesTo));
  const direct = autoDirect.filter((i) => !off.includes(i.key));
  /** 存量漂移检测：已装配的直接条目无法从当前组成推导（资源缺失或条目改了适用资源） */
  const legacyDrift = (type.costItems ?? []).filter((k) => {
    const it = getCostItems().find((i) => i.key === k);
    return it && it.settleType !== "间接" && !autoDirect.some((a) => a.key === k);
  });
  // 装配并集 = 推导的直接成本（剔除后）∪ 所选成本中心归集的间接费用（核算单按此预置表单行）
  const centerItems = centers.flatMap((id) => getCenters().find((c) => c.id === id)?.itemKeys ?? []);
  const derived: string[] = Array.from(new Set([...direct.map((i) => i.key), ...centerItems]));
  const dirty = derived.join() !== type.costItems.join()
    || JSON.stringify(materials) !== JSON.stringify(type.materials ?? [])
    || centers.join() !== (type.centers ?? []).join()
    || off.join() !== (type.directOff ?? []).join();
  const saveAsm = () => { if (dirty) patch({ materials: materials.map((m) => ({ ...m, itemKeys: [] })), centers, costItems: derived, directOff: off }); };

  // ---------- 计价方式标签：口径的唯一出处在成本条目库，这里只显示「怎么算」的标签 ----------
  // 收敛为五种 canonical 口径：按量计价 / 直接结转 / 工时计价 / 按出口合并计收 / 固定金额（间接费用没有自己的算式，金额由成本中心分法统一算）
  const priceLabel = (it?: { formula?: string; settleType?: string; category?: string }): { text: string; cls: string } => {
    if (!it) return { text: "—", cls: "bg-[#F2F3F5] text-[#86909C]" };
    if (it.settleType === "间接") return { text: "中心统一算", cls: "bg-[#FEF0FF] text-[#CB26FF]" };
    const f = it.formula ?? "";
    if (!f) return it.category === "手工录入" ? { text: "人工填报", cls: "bg-[#F2F3F5] text-[#4E5969]" } : { text: "未设计价方式", cls: "bg-[#FFECE8] text-[#F53F3F]" };
    if (f.includes("出口月租合计")) return { text: "按出口合并计收", cls: "bg-[#E8F3FF] text-[#165DFF]" };
    if (f.includes("人天") || f.includes("工时")) return { text: "工时计价", cls: "bg-[#E8F3FF] text-[#165DFF]" };
    if (f.includes("直接结转") || f.includes("采购价") || f.includes("批发")) return { text: "直接结转", cls: "bg-[#E8F3FF] text-[#165DFF]" };
    if (f.includes("填报金额")) return { text: "固定金额", cls: "bg-[#E8F3FF] text-[#165DFF]" };
    return { text: "按量计价", cls: "bg-[#E8F3FF] text-[#165DFF]" };
  };

  return (
    <ArcoShell breadcrumb={`资源清单 / ${catName} / ${typeName}`}>
      <main className="space-y-4 p-6">
        {/* 头部：产品类型上下文 + 版本 + 算账逻辑树（默认收起） */}
        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[#1D2129]">资源清单</span>
            <span className="rounded-[2px] bg-[#F2F3F5] px-2 py-0.5 text-[11px] text-[#4E5969]">{catName}</span>
            <span className="rounded-[2px] bg-[#E8F3FF] px-2 py-0.5 text-[11px] text-[#165DFF]">{typeName}</span>
            <span className="rounded-[2px] bg-[#E8F3FF] px-1.5 py-0.5 text-[10px] text-[#165DFF]" title="清单版本：保存变更自动 +1；存量合同绑定签订时的版本，不受影响">当前 v{type.asmVersion}</span>
            {calcTodos
              ? <span className="rounded-[2px] bg-[#FFECE8] px-1.5 py-0.5 text-[10px] text-[#F53F3F]">{calcTodos} 个条目算账口径待补</span>
              : <span className="text-[10px] text-[#00B42A]">✓ 算账口径齐全</span>}
            {type.asmHistory.length > 1 && (
              <button type="button" className="text-[10px] text-[#86909C] hover:text-[#165DFF]" onClick={() => setHistOpen((o) => !o)}>
                {histOpen ? "▲ 收起版本历史" : `▼ 版本历史（${type.asmHistory.length}）`}
              </button>
            )}
            <Link className="ml-auto text-[11px] text-[#165DFF] hover:underline" to="/cost-items">管理成本条目库 →</Link>
            <Button size="sm" variant="outline" onClick={() => setShowCalc((s) => !s)}>
              这个产品怎么算账 {showCalc ? "▲" : "▼"}
            </Button>
            <Button size="sm" disabled={!dirty} onClick={saveAsm}>{dirty ? "保存清单（版本自动 +1）" : "清单无改动"}</Button>
          </div>
          {histOpen && (
            <div className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded-[2px] border border-[#F2F3F5] bg-[#F7F8FA]/60 p-2">
              {[...type.asmHistory].reverse().map((h) => (
                <div key={h.v} className="flex items-center justify-between text-[10px] text-[#4E5969]">
                  <span className="font-mono font-semibold text-[#165DFF]">v{h.v}</span>
                  <span>{h.items.length} 个条目：{h.items.map(COST_ITEM_NAME).join("、") || "（空）"}</span>
                  <span className="text-[#86909C]">{h.date}{h.note ? ` · ${h.note}` : ""}</span>
                </div>
              ))}
            </div>
          )}
          {showCalc && (
            <div className="mt-3">
              <CostGuide catName={catName} typeName={typeName} />
            </div>
          )}
        </div>

        {/* 产品组成：成本结构唯一入口——每行内直接展示该资源关联的直接成本项（点击切换计入/不计入） */}
        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-[#1D2129]">产品组成</span>
              <span className="ml-2 text-[11px] text-[#86909C]">由哪些资源组成。各资源关联的直接成本项自动列出——点击可切换计入 / 不计入</span>
            </div>
            <Button size="sm" onClick={() => setPickOpen(true)}>＋ 选用资源</Button>
          </div>
          {materials.length ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                  <th className="w-56 px-3 py-2">资源</th><th className="w-24 px-3 py-2">形态</th>
                  <th className="px-3 py-2">关联直接成本（点击计入 / 不计入）</th><th className="w-16 px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => {
                  const def = MAT_DEF(m.libKey);
                  const group = autoDirect.filter((i) => i.appliesTo === m.libKey);
                  return (
                    <tr key={m.key} className="border-b align-top last:border-0">
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-[#1D2129]">
                          {def ? def.name : <span className="text-[#F53F3F]">资源目录已删除</span>}
                          {def?.status === "停用" && <span className="ml-1.5 rounded-[2px] bg-[#FFECE8] px-1 py-px text-[9px] text-[#F53F3F]">已停用</span>}
                        </span>
                        {def && ARCHIVES_OF_MATERIAL(def.key).length > 0 && (
                          <span className="ml-1.5 text-[10px] text-[#C9CDD4]">
                            {ARCHIVES_OF_MATERIAL(def.key).map((a, i) => (
                              <span key={a.key}>{i > 0 && " / "}<Link className="text-[#165DFF] hover:underline" to={`/resources/${a.key}`}>{a.code}</Link></span>
                            ))}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {def && <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${def.form === "实物" ? "bg-[#FFF3E8] text-[#FF7D00]" : def.form === "人工服务" ? "bg-[#F2F3F5] text-[#4E5969]" : "bg-[#E8F3FF] text-[#165DFF]"}`}>{def.form}</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {group.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {group.map((i) => {
                              const on = !off.includes(i.key);
                              const pl = priceLabel(i);
                              return (
                                <button key={i.key}
                                  onClick={() => setOff((x) => (on ? [...x, i.key] : x.filter((k) => k !== i.key)))}
                                  title={`${i.formula ? `算式：${i.formula}\n` : ""}${on ? "点击不计入本项成本" : "点击恢复计入"}`}
                                  className={`rounded-[2px] border px-1.5 py-0.5 text-[10px] transition-colors ${on
                                    ? "border-[#E5E6EB] text-[#1D2129] hover:border-[#F53F3F] hover:text-[#F53F3F]"
                                    : "border-dashed border-[#C9CDD4] text-[#C9CDD4] line-through hover:border-[#165DFF] hover:text-[#165DFF]"}`}>
                                  {i.name}
                                  <span className={`ml-1 rounded-[2px] px-1 py-px text-[9px] ${pl.cls}`}>{pl.text}</span>
                                  {!on && <span className="ml-1">不计入</span>}
                                </button>
                              );
                            })}
                          </div>
                        ) : <span className="text-[#C9CDD4]">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button className="text-[#F53F3F] hover:underline" onClick={() => {
                          if (!confirm(`把资源「${def?.name ?? m.libKey}」从本产品清单移除？其关联的直接成本项将一并移出核算单。`)) return;
                          setMaterials((x) => x.filter((y) => y.key !== m.key));
                        }}>移除</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="rounded-[2px] bg-[#F7F8FA] px-3 py-2.5 text-[11px] leading-5 text-[#86909C]">
              还没有资源。点「选用资源」从资源目录挑——挑好后，关联的直接成本项会自动列出。
            </div>
          )}
          {legacyDrift.length > 0 && (
            <div className="mt-2 space-y-1 rounded-[2px] border border-[#FFC998] bg-[#FFF7E8] px-3 py-2 text-[11px] leading-5">
              {legacyDrift.map((k) => (
                <div key={k} className="text-[#FF7D00]">⚠ 已装配的「{COST_ITEM_NAME(k)}」无法从当前组成推导：补选对应资源，或保存后该项成本将从清单移除</div>
              ))}
            </div>
          )}
        </div>

        {/* 间接费用：勾选成本中心 */}
        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-[#1D2129]">间接费用（成本中心归集）</span>
              <span className="ml-2 text-[11px] text-[#86909C]">分不清算哪单的共用账：平台运维、维保、监控等——月末由中心按分法切分到订单</span>
            </div>
            <Link className="shrink-0 text-[11px] text-[#165DFF] hover:underline" to="/cost-centers">管理成本中心 →</Link>
          </div>
          <div className="divide-y divide-[#F2F3F5] rounded-[2px] border border-[#E5E6EB]">
            {getCenters().map((c) => {
              const on = centers.includes(c.id);
              const items = c.itemKeys.map((k) => getCostItems().find((i) => i.key === k)).filter(Boolean);
              return (
                <label key={c.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-xs hover:bg-[#F7F8FA]"
                  title={`分法：${c.driver}\n归集条目：${items.length ? items.map((i) => i!.name).join("、") : "（中心未归集条目）"}`}>
                  <input type="checkbox" className="accent-[#165DFF]" checked={on} disabled={c.status === "停用" && !on}
                    onChange={(e) => setCenters((x) => (e.target.checked ? [...x, c.id] : x.filter((k) => k !== c.id)))} />
                  <span className="font-medium text-[#1D2129]">{c.name}</span>
                  <span className="rounded-[2px] bg-[#F7F8FA] px-1.5 py-0.5 text-[10px] text-[#86909C]">{c.driver}</span>
                  <span className="ml-auto text-[10px] text-[#86909C]">
                    {items.length ? <>归集 {items.length} 笔</> : <span className="text-[#FF7D00]">中心未归集条目</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* 汇总条：保存前的体检结论（明细已在上方两块展示，不再重复列表） */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] text-[#4E5969]">
          <span className="text-xs font-semibold text-[#1D2129]">清单汇总</span>
          <span>直接成本 <strong className="font-mono text-[#165DFF]">{direct.length}</strong> 笔
            （一次性 {direct.filter((i) => i.costType === "一次性").length} / 月度 {direct.filter((i) => i.costType !== "一次性").length}）</span>
          <span>间接费用 <strong className="font-mono text-[#CB26FF]">{centerItems.length}</strong> 笔</span>
          {off.length > 0 && <span className="text-[#86909C]">不计入 {off.length} 项</span>}
          <span className="text-[#86909C]">保存后版本 v{type.asmVersion + (dirty ? 1 : 0)}</span>
          {dirty
            ? <span className="rounded-[2px] bg-[#FFF7E8] px-1.5 py-0.5 text-[10px] text-[#FF7D00]">有未保存改动</span>
            : <span className="text-[10px] text-[#00B42A]">✓ 已保存</span>}
          <Link className="ml-auto shrink-0 text-[11px] text-[#165DFF] hover:underline" to="/cost-items">条目口径在成本条目库维护 →</Link>
        </div>
      </main>

      {/* 从资源目录选用资源 */}
      {pickOpen && (
        <CenterModal title={`选用资源 · ${typeName}`} sub="从资源目录挑这个产品由哪些资源组成" onClose={() => setPickOpen(false)} width={520}>
          <div className="space-y-2 text-xs">
            {getMaterials().filter((d) => d.status !== "停用" && !materials.some((m) => m.libKey === d.key)).map((d) => (
              <div key={d.key} className="flex items-center gap-2 rounded-[2px] border border-[#E5E6EB] px-3 py-2">
                <span className="font-medium text-[#1D2129]">{d.name}</span>
                <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${d.form === "实物" ? "bg-[#FFF3E8] text-[#FF7D00]" : d.form === "人工服务" ? "bg-[#F2F3F5] text-[#4E5969]" : "bg-[#E8F3FF] text-[#165DFF]"}`}>{d.form}</span>
                <span className="text-[10px] text-[#86909C]">{d.group ?? ""}</span>
                <span className="ml-auto max-w-[200px] truncate text-[10px] text-[#86909C]" title={d.remark}>{d.remark ?? ""}</span>
                <Button size="sm" variant="outline" onClick={() => {
                  setMaterials((x) => [...x, { key: `m${Date.now() % 100000}`, libKey: d.key, itemKeys: [] }]);
                  setPickOpen(false);
                }}>选用</Button>
              </div>
            ))}
            {!getMaterials().some((d) => !materials.some((m) => m.libKey === d.key)) && (
              <div className="rounded-[2px] bg-[#F7F8FA] px-3 py-4 text-center text-[11px] text-[#86909C]">
                资源目录里的资源都已选用。需要新资源请到 <Link className="text-[#165DFF] hover:underline" to="/materials" onClick={() => setPickOpen(false)}>资源目录</Link> 新增。
              </div>
            )}
            <div className="text-right">
              <Link className="text-[11px] text-[#165DFF] hover:underline" to="/materials" onClick={() => setPickOpen(false)}>去资源目录新增 / 维护资源 →</Link>
            </div>
          </div>
        </CenterModal>
      )}
    </ArcoShell>
  );
}
