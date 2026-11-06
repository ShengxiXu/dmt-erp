// 成本条目库页面（/cost-items）
// 全系统算账逻辑的唯一出处：产品类型装配条目（BOM 物料挂直接条目、勾选成本中心收间接条目）→ 条目取数资源档案 → 间接费用归集成本中心月末分配
// 能力：条目档案维护、四要素生效校验、状态机、被装配反向可见、关键字段锁定
import { useState } from "react";
import { Link } from "react-router";
import {
  useCostItems, getCostItems, updateItem, addItem, missingElements, itemReferences,
  SETTLE_RULE, SOURCE_TO_MAT,
  type CostItem, type ItemStatus, type SettleType,
} from "@/data/costItems";
import { getCats, getMaterials } from "@/data/products";
import { ARCHIVES, ARCHIVE_FIELDS, R2_ROWS, R3_ROWS, R4_ROWS } from "@/data/resources";
import { PURCHASE_CONTRACTS } from "@/data/purchase";
import { currentRate } from "@/data/dicts";
import { DictsPanel } from "@/pages/Dicts";
import { getCenters, useCenters, CC_NAME, DRIVER_SENTENCE } from "@/data/costCenters";
// 注：条目字段不再展示「直接填空/搜索选择/自动计算」等提示标记，只看字段名与说明
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ARCHIVE_OPTS = [
  { key: "r1", name: "R1 出口线路档案" },
  { key: "r2", name: "R2 基础线路档案" },
  { key: "r3", name: "R3 IP 地址段" },
  { key: "r4", name: "R4 设备库存" },
  { key: "resale", name: "采购合同（转售批发价）" },
];
/** 资源目录类名（适用资源显示用） */
const MAT_NAME = (k?: string) => (k ? getMaterials().find((m) => m.key === k)?.name ?? k : "未选");

/** 手工录入条目的通用数量变量（无档案字段可引用时的兜底） */
const MANUAL_VARS = ["数量", "工时", "费率", "基数", "比例"];
/** 订单侧变量：核算单本身带入的数值（与档案无关），如客户买的带宽 */
const ORDER_VARS = ["本单带宽(M)", "本单数量", "本单工时(人天)"];

/** 计价方式：与设计文档第四章的五种 canonical 口径一一对应（按量计价 / 直接结转 / 工时计价 / 按出口合并计收 / 固定金额），
 *  再加「以上都不是」积木兜底（SLA 加成等特殊口径）；间接费用不设算式，金额由成本中心分法统一算 */
const PRICE_PRESETS: { key: string; name: string; desc: string; formula: string; example?: string; sceneKey?: string }[] = [
  { key: "qty", name: "按量计价", desc: "数量 × 档案单价：设备、IP 地址、整条线路月租、按带宽单价采购的，都算这一类", formula: "数量 × 档案单价", example: "2 台 × 4,500 元 = 9,000 元；100M × 18 元 = 1,800 元/月", sceneKey: "qty" },
  { key: "resale", name: "直接结转", desc: "转售业务：采购价直接结转、不加成", formula: "采购数量 × 采购价", example: "100M × 22 元 = 2,200 元/月", sceneKey: "resale" },
  { key: "manday", name: "工时计价", desc: "工程师投入：人天乘费率（费率统一维护）", formula: "本单工时(人天) × 费率", example: "4 人天 × 800 元 = 3,200 元", sceneKey: "manday" },
  { key: "pool", name: "按出口合并计收", desc: "同产品类型的所有出口合并：月租合计 ÷（已售＋本单带宽）× 本单带宽（边际计价，回答新增这一单的成本）", formula: "产品类型出口月租合计 ÷（该产品类型已售带宽合计 + 本单带宽）× 本单带宽", example: "113,000 ÷ (1,600+50) × 50 = 3,424 元/月", sceneKey: "pool" },
  { key: "fixed", name: "固定金额", desc: "一次性定额费用：物流、差旅、施工，按合同 / 约定直接填报金额（无档案单价，不算数量）", formula: "填报金额（一次性）", example: "施工费一次性 3,000 元", sceneKey: "fixed" },
  { key: "custom", name: "以上都不是，自己搭算式", desc: "用积木式编辑器把变量拼成算式（如按占用比例、SLA 加成等特殊口径）", formula: "" },
];

const fmtN = (n: number) => n.toLocaleString("zh-CN", { maximumFractionDigits: 2 });

// ---------- 计算场景：退为幕后「建议公式」规则，不再作为新建入口 ----------
// 用户新建条目时直接填四要素；选了取数档案后，按档案匹配的历史场景以「建议公式」chips 呈现，点一下即可套用。
interface Scene {
  key: string; name: string; desc: string; example: string;
  category: "资源驱动" | "手工录入";
  source: string; formula: string; unit: string; costType: "周期性" | "一次性";
  /** 试算：变量样例 + 计算 + 结果描述（样例数值可改，仅为验证公式结构） */
  trial?: { vars: { label: string; def: number }[]; calc: (v: number[]) => number; fmt: (v: number[], r: number) => string };
}

const SCENES: Scene[] = [
  {
    key: "qty", name: "按量计价", desc: "数量 × 单价：设备、物料、OTU 端口", example: "2 台 × 4,500 元 = 9,000 元",
    category: "资源驱动", source: "r4", formula: "数量 × 档案单价", unit: "元/月", costType: "周期性",
    trial: { vars: [{ label: "数量", def: 2 }, { label: "档案单价（元）", def: 4500 }], calc: (v) => v[0] * v[1], fmt: (v, r) => `${v[0]} 台 × ${fmtN(v[1])} 元 = ${fmtN(r)} 元` },
  },
  {
    key: "pool", name: "出口带宽共用计收", desc: "同一归属产品类型的所有出口合并计收，多家客户共用（不做减法；边际计价）", example: "113,000 ÷ (1,600+50) × 50 = 3,424 元/月",
    category: "资源驱动", source: "r1", formula: "产品类型出口月租合计 ÷（该产品类型已售带宽合计 + 本单带宽）× 本单带宽", unit: "元/月", costType: "周期性",
    trial: { vars: [{ label: "产品类型出口月租合计（元）", def: 113000 }, { label: "已售带宽合计（M）", def: 1600 }, { label: "本单带宽（M）", def: 50 }], calc: (v) => (v[0] / (v[1] + v[2])) * v[2], fmt: (v, r) => `${fmtN(v[0])} ÷ (${fmtN(v[1])}+${v[2]}) × ${v[2]} = ${fmtN(r)} 元/月` },
  },
  {
    key: "resale", name: "直接结转", desc: "采购价直接结转、不加成：转售业务", example: "100M × 22 元 = 2,200 元/月",
    category: "资源驱动", source: "resale", formula: "采购数量 × 采购价", unit: "元/月", costType: "周期性",
    trial: { vars: [{ label: "采购数量（M）", def: 100 }, { label: "采购价（元/M）", def: 22 }], calc: (v) => v[0] * v[1], fmt: (v, r) => `${v[0]}M × ${fmtN(v[1])} 元 = ${fmtN(r)} 元/月` },
  },
  {
    key: "manday", name: "工时计价", desc: "人天 × 费率：实施 / 运维人工", example: "4 人天 × 800 元 = 3,200 元（一次性）",
    category: "手工录入", source: "", formula: "工时 × 费率（费率取工时字典）", unit: "元", costType: "一次性",
    trial: { vars: [{ label: "工时（人天）", def: 4 }, { label: "费率（元/人天）", def: 800 }], calc: (v) => v[0] * v[1], fmt: (v, r) => `${v[0]} 人天 × ${fmtN(v[1])} 元 = ${fmtN(r)} 元` },
  },
  {
    key: "share", name: "按对象分配", desc: "总成本 ÷ 端口数 / 节点数 / 客户数", example: "120,000 元 ÷ 12 月 ÷ 200 户 = 50 元/月",
    category: "手工录入", source: "", formula: "月总成本 ÷ 12 ÷ 分配对象数", unit: "元/月", costType: "周期性",
    trial: { vars: [{ label: "月总成本（元）", def: 120000 }, { label: "分配对象数", def: 200 }], calc: (v) => v[0] / 12 / v[1], fmt: (v, r) => `${fmtN(v[0])} 元 ÷ 12 月 ÷ ${v[1]} 户 = ${fmtN(r)} 元/月` },
  },
  {
    key: "fixed", name: "固定金额", desc: "定额费用：按合同或约定填列", example: "按合同定额填列",
    category: "手工录入", source: "", formula: "固定金额（按合同定额填列）", unit: "元", costType: "一次性",
  },
  {
    key: "sla", name: "SLA 加成", desc: "基数 × 比例：高等级服务附加", example: "1,000 元 × 20% = 200 元/月",
    category: "手工录入", source: "", formula: "基数 × 加成比例", unit: "元/月", costType: "周期性",
    trial: { vars: [{ label: "基数（元）", def: 1000 }, { label: "加成比例", def: 0.2 }], calc: (v) => v[0] * v[1], fmt: (v, r) => `${fmtN(v[0])} 元 × ${v[1]} = ${fmtN(r)} 元/月` },
  },
];

const STATUS_CLS: Record<ItemStatus, string> = {
  草稿: "bg-[#F2F3F5] text-[#4E5969]",
  生效: "bg-[#E8F8F2] text-[#00B42A]",
  停用: "bg-[#FFECE8] text-[#F53F3F]",
};

/** 生效校验 + 状态流转 */
function StatusFlow({ item, refs, onChanged }: { item: CostItem; refs: ReturnType<typeof itemReferences>; onChanged: () => void }) {
  const miss = missingElements(item);
  const assembled = refs.length > 0;
  const setStatus = (s: ItemStatus) => {
    if (s === "生效" && miss.length) return alert(`四要素未齐全，无法生效：缺少 ${miss.join("、")}`);
    if (s === "停用" && assembled)
      return alert(`该条目正被 ${refs.map((r) => r.type).join("、")} 装配/引用，请先解除装配关系再停用`);
    updateItem(item.key, { status: s });
    onChanged();
  };
  return (
    <div className="flex items-center gap-2">
      <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${STATUS_CLS[item.status]}`}>{item.status}</span>
      {item.status !== "生效" && (
        <button className="text-[11px] text-[#165DFF] hover:underline" title={miss.length ? `缺少：${miss.join("、")}` : "置为生效"} onClick={() => setStatus("生效")}>生效</button>
      )}
      {item.status !== "停用" && (
        <button className="text-[11px] text-[#F53F3F] hover:underline" title={assembled ? "已被装配，须先解除" : "停用"} onClick={() => setStatus("停用")}>停用</button>
      )}
    </div>
  );
}

/** 新建 / 编辑条目表单：直接填四要素 → 常用口径一键套用 → 人话摘要 → 试算 */
function ItemForm({ initial, onClose }: { initial?: CostItem; onClose: () => void }) {
  useCenters();
  const refs = initial ? itemReferences(initial.key, getCats()) : [];
  const locked = refs.length > 0; // 被装配条目：关键字段锁定
  const [f, setF] = useState<Partial<CostItem>>(() => ({
    name: "", dept: "ops", costType: "周期性", unit: "元/月", required: "按装配",
    category: "资源驱动", settleType: "直接", sourceArchive: "", formula: "", costCenter: "", remark: "",
    ...initial,
  }));
  /** 用户点选的「计价方式」对应的试算场景（仅用于试算与提示）；编辑时按 类别+档案 反推 */
  const [appliedScene, setAppliedScene] = useState<Scene | null>(null);
  const [expand, setExpand] = useState(true);
  const [trialVals, setTrialVals] = useState<number[]>([]);
  /** 计价方式：false = 预设单选列表（点现成的）；true = 积木式编辑器（选了「以上都不是」） */
  const [customFormula, setCustomFormula] = useState(false);
  const [numDraft, setNumDraft] = useState("");
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const miss = missingElements(f as CostItem);

  /** 切换算账去向：间接费用无自己的算式（金额唯一出处 = 成本中心分法） */
  const onSettleType = (st: SettleType) => {
    setAppliedScene(null);
    setF((x) => ({ ...x, settleType: st, formula: st === "间接" ? "" : x.formula }));
  };

  /** 所选档案的字段定义（与资源中心表单同源）：数值字段是公式的「档案带出」变量 */
  const archDef = ARCHIVES.find((a) => a.key === f.sourceArchive);
  /** 公式变量 = 订单带入（核算单上的数值）+ 档案带出（选中资源的数值字段） */
  const archiveVars = (archDef ? ARCHIVE_FIELDS(archDef) : []).filter((fd) => fd.numeric && !fd.dynamic).map((fd) => fd.label);
  const varChips = f.category === "手工录入" ? MANUAL_VARS : [...ORDER_VARS, ...archiveVars];

  // ---------- 公式 token 化：奇数位 = 运算符（仅 × ÷ ＋ −），偶数位 = 操作数（变量名或数字）；存储仍是空格分隔文本 ----------
  const OPS = ["×", "÷", "+", "−"] as const;
  const isOp = (t: string) => (OPS as readonly string[]).includes(t);
  const toks = (f.formula ?? "").split(" ").filter(Boolean);
  const setToks = (t: string[]) => set("formula", t.join(" "));
  /** 追加操作数：自动补一个 × 连接（用户只需选数，运算符再改） */
  const appendOperand = (tok: string) => {
    const t = [...toks];
    if (t.length && !isOp(t[t.length - 1])) t.push("×");
    t.push(tok);
    setToks(t);
  };
  /** 删除操作数：清理悬空的连续/首尾运算符 */
  const removeTok = (i: number) => {
    let t = toks.filter((_, j) => j !== i);
    t = t.filter((x, j) => !(isOp(x) && (j === 0 || isOp(t[j - 1]))));
    while (t.length && isOp(t[t.length - 1])) t.pop();
    setToks(t);
  };

  const matchedScene = SCENES.find((s) =>
    f.category === s.category && (f.sourceArchive ?? "") === s.source);
  const active = appliedScene ?? (initial ? matchedScene : undefined);
  const tvals = active?.trial ? (trialVals.length ? trialVals : active.trial.vars.map((x) => x.def)) : [];
  /** 试算联动（价格规则下沉）：按量计价的单价取自所选资源档案的首条示例；工时计价的费率取自计价字典 */
  const archPrice = (() => {
    const k = f.sourceArchive;
    if (k === "r2" && R2_ROWS[0]) return { value: R2_ROWS[0].price, src: `R2 档案示例「${R2_ROWS[0].name}」整条月租` };
    if (k === "r3" && R3_ROWS[0]) return { value: R3_ROWS[0].unitPrice, src: `R3 档案示例「${R3_ROWS[0].name}」单价` };
    if (k === "r4" && R4_ROWS[0]) return { value: R4_ROWS[0].costPrice, src: `R4 档案示例「${R4_ROWS[0].name}」采购价` };
    if (k === "resale") { const c = PURCHASE_CONTRACTS.find((x) => x.billing === "按单计价") ?? PURCHASE_CONTRACTS[0]; return { value: c.unitPrice ?? 0, src: `采购合同示例「${c.id}」框架单价` }; }
    return null;
  })();
  const dictRate = currentRate();
  const linked = active?.trial
    ? active.key === "qty" && archPrice
      ? { vals: [tvals[0] ?? 1, archPrice.value], note: `单价已联动${archPrice.src}（随档案维护，不用手填）`, lockedIdx: 1 }
      : active.key === "manday" && dictRate
        ? { vals: [tvals[0] ?? 1, dictRate.rate], note: `费率已联动计价字典「${dictRate.role}」${fmtN(dictRate.rate)} 元/人天`, lockedIdx: 1 }
        : { vals: tvals, note: "", lockedIdx: -1 }
    : null;
  const tresult = active?.trial?.calc(linked?.vals ?? tvals);

  /** 点选计价方式：带入算式，并启用对应试算场景（「以上都不是」进入积木编辑器） */
  const pickPreset = (p: (typeof PRICE_PRESETS)[number]) => {
    if (p.key === "custom") { setCustomFormula(true); return; }
    setF((x) => ({ ...x, formula: p.formula }));
    const scene = p.sceneKey ? SCENES.find((s) => s.key === p.sceneKey) : undefined;
    setAppliedScene(scene ?? null);
    if (scene?.trial) setTrialVals(scene.trial.vars.map((v) => v.def));
  };
  /** 可选取数档案（直接/间接均可从档案归集；老数据不在名单内时保留显示，编辑不丢值） */
  const archiveOpts = ARCHIVE_OPTS;

  const save = () => {
    if (!f.name?.trim()) return alert("请填写条目名称");
    if (initial) {
      updateItem(initial.key, f);
    } else {
      addItem({ ...f, sourceArchive: f.category === "手工录入" ? undefined : f.sourceArchive } as CostItem);
    }
    onClose();
  };

  // ---------- 人话摘要（始终可见，折叠态下的唯一口径呈现） ----------
  const archiveName = ARCHIVE_OPTS.find((a) => a.key === f.sourceArchive)?.name;
  const ccName = CC_NAME(f.costCenter);
  const selCenter = getCenters().find((c) => c.id === f.costCenter);
  const tail = f.settleType === "间接"
    ? <>归集到成本中心【{ccName || "未选成本中心"}】，月末按中心的分法分配。</>
    : <>随单实时算，计入本订单直接成本。</>;
  /** 间接费用没有自己的算式：金额的唯一出处是成本中心的分法 */
  const calcTxt = f.settleType === "间接"
    ? (selCenter ? <>金额由成本中心统一算（{DRIVER_SENTENCE(selCenter)}）</> : "金额由成本中心的分法统一算")
    : <>按「{f.formula || "未设置公式"}」计算</>;
  const summary = f.category === "资源驱动"
    ? <>从【{archiveName ?? "未选档案"}】取数（填报时按订单的产品类型自动过滤可选资源），{calcTxt}，{tail}</>
    : <>{f.settleType === "间接" ? "共用费用，先归集后分配" : "核算时人工填报"}，{calcTxt}，{tail}</>;

  const lockTip = locked ? "（被装配锁定）" : "";
  return (
    <div className="space-y-3 text-xs">
      {/* 口径摘要 + 展开 */}
      <div className="rounded-[4px] border border-[#BEDAFF] bg-[#F7FBFF] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[#165DFF]">这笔账的口径（大白话）</span>
          <button type="button" className="ml-auto text-[10px] text-[#165DFF] hover:underline" onClick={() => setExpand((e) => !e)}>
            {expand ? "收起口径明细 ▲" : "展开口径明细 ▼"}
          </button>
        </div>
        <div className="leading-5 text-[#4E5969]">{summary}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-0.5 text-[#4E5969]">条目名称 <span className="text-[#F53F3F]">*</span></div>
          <Input autoFocus placeholder="如：出口带宽租用费" value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <div className="mb-0.5 text-[#4E5969]">填报部门</div>
          <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.dept} onChange={(e) => set("dept", e.target.value)}>
            <option value="ops">业务支撑部</option><option value="tech">技术部</option>
          </select>
        </div>
      </div>

      {/* 配好这笔账：回答 4 个问题（是什么费用 / 数从哪来 / 钱怎么算 / 记到哪） */}
      {expand && (
        <>
        <div className="space-y-3 rounded-[4px] border border-[#E5E6EB] p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-0.5 text-[#4E5969]">数从哪来？{lockTip}</div>
              <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.category} disabled={locked}
                onChange={(e) => set("category", e.target.value)}>
                <option value="资源驱动">从档案里挑一条资源（自动带出价格）</option>
                <option value="手工录入">填核算单时人工填数（没有现成档案）</option>
              </select>
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">这笔账算到哪？ <span className="text-[#F53F3F]">*</span></div>
              <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.settleType} onChange={(e) => onSettleType(e.target.value as SettleType)}>
                <option value="直接">直接成本（这单专属，随单算）</option>
                <option value="间接">间接费用（大家共用，成本中心月结分）</option>
              </select>
              {f.settleType && (
                <div className="mt-0.5 text-[10px] leading-4 text-[#C9CDD4]">{SETTLE_RULE[f.settleType as CostItem["settleType"]]}</div>
              )}
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">费用类型</div>
              <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.costType} onChange={(e) => set("costType", e.target.value)}>
                <option>周期性</option><option>一次性</option>
              </select>
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">计量单位</div>
              <Input list="ci-unit-opts" placeholder="如：元/月" value={f.unit ?? ""} onChange={(e) => set("unit", e.target.value)} />
              <datalist id="ci-unit-opts">
                {["元/月", "元", "人天", "台", "条", "个", "M"].map((u) => <option key={u} value={u} />)}
              </datalist>
            </div>
            <div>
              <div className="mb-0.5 text-[#4E5969]">填报要求</div>
              <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm"
                value={f.required === "按装配" ? "默认" : "按需"}
                onChange={(e) => {
                  const v = e.target.value;
                  setF((x) => ({ ...x, required: v === "默认" ? "按装配" : "否" }));
                }}>
                <option value="默认">默认填报（随模板带出，可删可补回）</option>
                <option value="按需">按需选配（默认不带出）</option>
              </select>
            </div>
          </div>
          {f.category === "资源驱动" && (
            <div className="space-y-1.5">
              <div>
                <div className="mb-0.5 text-[#4E5969]">从哪个档案挑？{f.category === "资源驱动" && <span className="text-[#F53F3F]">*</span>}{lockTip}</div>
                <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.sourceArchive ?? ""} disabled={locked}
                  onChange={(e) => {
                    const v = e.target.value;
                    // 适用资源自动跟随取数来源（推导桥：组成资源 → 这笔账）
                    setF((x) => ({ ...x, sourceArchive: v, appliesTo: SOURCE_TO_MAT[v] ?? x.appliesTo }));
                  }}>
                  <option value="">请选择…</option>
                  {archiveOpts.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
                </select>
                <div className="mt-0.5 text-[10px] leading-4 text-[#C9CDD4]">
                  核算填报时，填报人从这个档案里挑选资源；<strong className="text-[#86909C]">挑选列表自动按订单的产品类型过滤</strong>——只显示适用于该类型的资源（由资源档案上的「归属产品类型 / 可共享产品类型」决定，无需在这里设置）。
                </div>
              </div>
            </div>
          )}
          {f.settleType !== "间接" && (
            <div>
              <div className="mb-0.5 text-[#4E5969]">适用资源（这笔账对应哪个资源）<span className="text-[#F53F3F]">*</span>{lockTip}</div>
              <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.appliesTo ?? ""}
                disabled={locked || (f.category === "资源驱动" && !!f.sourceArchive)}
                onChange={(e) => set("appliesTo", e.target.value)}>
                <option value="">请选择…</option>
                {getMaterials().map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
              </select>
              <div className="mt-0.5 text-[10px] leading-4 text-[#C9CDD4]">
                {f.category === "资源驱动" && f.sourceArchive
                  ? <>已按取数来源自动确定（<strong className="text-[#86909C]">{MAT_NAME(f.appliesTo)}</strong>），无需手选。</>
                  : <>产品组成里有这个资源时，这笔账自动进入该产品的核算单（资源清单页的直接成本由组成推导）。</>}
              </div>
            </div>
          )}
          {f.settleType !== "间接" ? (<>
          <div>
            <div className="mb-1 text-[#4E5969]">钱怎么算？选一种计价方式{lockTip}</div>
            {!customFormula ? (
              /* 计价方式单选：点一种现成的，算式自动带入 */
              <div className="space-y-1.5">
                {PRICE_PRESETS.map((p) => (
                  <label key={p.key}
                    className={`flex cursor-pointer items-start gap-2 rounded-[2px] border px-2.5 py-1.5 ${p.key !== "custom" && f.formula === p.formula ? "border-[#165DFF] bg-[#F7FBFF]" : "border-[#E5E6EB] hover:bg-[#F7F8FA]"}`}>
                    <input type="radio" name="priceKey" className="mt-1 accent-[#165DFF]" disabled={locked}
                      checked={p.key !== "custom" && f.formula === p.formula}
                      onChange={() => pickPreset(p)} />
                    <span className="leading-5">
                      <span className="font-medium text-[#1D2129]">{p.name}</span>
                      <span className="ml-2 text-[#86909C]">{p.desc}</span>
                      {p.formula && <span className="ml-2 font-mono text-[#165DFF]">{p.formula}</span>}
                      {p.example && <span className="ml-2 text-[#C9CDD4]">例：{p.example}</span>}
                    </span>
                  </label>
                ))}
                {f.formula && !PRICE_PRESETS.some((p) => p.key !== "custom" && p.formula === f.formula) && (
                  <div className="flex items-center gap-2 rounded-[2px] border border-[#FF7D00] bg-[#FFF7E8] px-2.5 py-1.5">
                    <span className="text-[11px] text-[#FF7D00]">当前算式：{f.formula}（特殊口径）</span>
                    {!locked && (
                      <button type="button" className="text-[10px] text-[#165DFF] hover:underline" onClick={() => setCustomFormula(true)}>调整</button>
                    )}
                  </div>
                )}
                {!f.formula && (
                  <div className="rounded-[2px] bg-[#FFF7E8] px-2.5 py-1.5 text-[11px] text-[#FF7D00]">还没选计价方式：在上面点一种，或点最下面的「以上都不是」自己搭算式</div>
                )}
              </div>
            ) : (
              /* 积木式编辑器：操作数只能选变量或填数字，运算符只有四个下拉 */
              <div className="space-y-1.5 rounded-[2px] border border-[#E5E6EB] p-2">
                <div className="flex flex-wrap items-center gap-1">
                  {toks.length === 0 && <span className="text-[11px] text-[#C9CDD4]">从下方选变量或填数字，搭出计算步骤</span>}
                  {toks.map((t, i) => i % 2 === 1 ? (
                    <select key={i} value={(OPS as readonly string[]).includes(t) ? t : "×"} disabled={locked}
                      onChange={(e) => { const nt = [...toks]; nt[i] = e.target.value; setToks(nt); }}
                      className="h-6 rounded-[2px] border border-[#E5E6EB] bg-white px-1 font-mono text-[11px] text-[#86909C] disabled:bg-[#F2F3F5]">
                      {OPS.map((op) => <option key={op}>{op}</option>)}
                    </select>
                  ) : (
                    <span key={i} className="flex items-center gap-0.5 rounded-[2px] bg-[#E8F3FF] px-1.5 py-0.5 text-[11px] text-[#165DFF]">
                      {Number.isNaN(Number(t)) ? (
                        <span className="font-mono">{t}</span>
                      ) : (
                        <Input type="number" className="h-5 w-20 border-0 bg-transparent p-0 text-right font-mono text-[11px]" value={t} disabled={locked}
                          onChange={(e) => { const nt = [...toks]; nt[i] = e.target.value; setToks(nt); }} />
                      )}
                      {!locked && (
                        <button type="button" className="text-[#86909C] hover:text-[#F53F3F]" title="删除" onClick={() => removeTok(i)}>✕</button>
                      )}
                    </span>
                  ))}
                </div>
                {!locked && (
                  <div className="flex flex-wrap items-center gap-1 border-t border-dashed border-[#F2F3F5] pt-1.5">
                    <span className="text-[10px] text-[#C9CDD4]">添加：</span>
                    {f.category === "手工录入" ? (
                      varChips.map((v) => (
                        <button key={v} type="button" onClick={() => appendOperand(v)}
                          className="rounded-[2px] border border-[#BEDAFF] bg-white px-1.5 py-0.5 text-[10px] text-[#165DFF] hover:bg-[#E8F3FF]">
                          ＋ {v}
                        </button>
                      ))
                    ) : (
                      <>
                        <span className="text-[10px] text-[#C9CDD4]">订单带入</span>
                        {ORDER_VARS.map((v) => (
                          <button key={v} type="button" onClick={() => appendOperand(v)}
                            className="rounded-[2px] border border-[#94BFFF] bg-white px-1.5 py-0.5 text-[10px] text-[#165DFF] hover:bg-[#E8F3FF]">
                            ＋ {v}
                          </button>
                        ))}
                        <span className="mx-0.5 h-3.5 w-px bg-[#E5E6EB]" />
                        <span className="text-[10px] text-[#C9CDD4]">档案带出</span>
                        {archiveVars.map((v) => (
                          <button key={v} type="button" onClick={() => appendOperand(v)}
                            className="rounded-[2px] border border-[#BEDAFF] bg-white px-1.5 py-0.5 text-[10px] text-[#165DFF] hover:bg-[#E8F3FF]">
                            ＋ {v}
                          </button>
                        ))}
                      </>
                    )}
                    <span className="mx-0.5 h-3.5 w-px bg-[#E5E6EB]" />
                    <Input type="number" className="h-6 w-20 text-right text-[11px]" placeholder="数字" value={numDraft}
                      onChange={(e) => setNumDraft(e.target.value)} />
                    <button type="button" disabled={!numDraft} onClick={() => { appendOperand(numDraft); setNumDraft(""); }}
                      className="rounded-[2px] border border-[#E5E6EB] px-1.5 py-0.5 text-[10px] text-[#4E5969] hover:border-[#94BFFF] disabled:opacity-40">
                      ＋ 数字
                    </button>
                  </div>
                )}
                {!locked && (
                  <div className="pt-0.5">
                    <button type="button" className="text-[10px] text-[#165DFF] hover:underline" onClick={() => setCustomFormula(false)}>
                      ← 返回常用计价方式
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="mt-0.5 text-[10px] leading-4 text-[#C9CDD4]">
            大多数账用现成方式就够了：点一种，算式自动带入，下方还会给个试算例子验证。只有口径特殊才点「以上都不是」自己搭算式。
          </div>
          </>) : (
            <div className="rounded-[2px] bg-[#F7F8FA] px-2.5 py-2 text-[11px] leading-5 text-[#86909C]">
              这笔钱<strong className="text-[#4E5969]">不用单独设算式</strong>：先归集到成本中心，月末由中心按它选的分法统一算出每单该摊多少。
              {selCenter ? <>该中心当前的分法：<span className="text-[#4E5969]">{DRIVER_SENTENCE(selCenter)}</span></> : "（选好下面的成本中心后，这里会显示中心的分法）"}
              <Link className="ml-1 text-[#165DFF] hover:underline" to="/cost-centers">改分法 → 成本中心</Link>
            </div>
          )}
        </div>
          <div>
            <div className="mb-1 text-[#4E5969]">算出的钱记到哪？</div>
            <div className="grid grid-cols-2 gap-2">
              <label className={`cursor-pointer rounded-[2px] border px-2.5 py-2 leading-5 ${f.settleType !== "间接" ? "border-[#165DFF] bg-[#F7FBFF]" : "border-[#E5E6EB] hover:bg-[#F7F8FA]"}`}>
                <input type="radio" name="settleTo" className="accent-[#165DFF]" checked={f.settleType !== "间接"} disabled={locked}
                  onChange={() => onSettleType("直接")} />
                <span className="ml-1.5 font-medium text-[#1D2129]">算进这单里</span>
                <div className="mt-0.5 text-[10px] text-[#86909C]">直接成本：随订单实时计价（在产品类型上选配条目）</div>
              </label>
              <label className={`cursor-pointer rounded-[2px] border px-2.5 py-2 leading-5 ${f.settleType === "间接" ? "border-[#165DFF] bg-[#F7FBFF]" : "border-[#E5E6EB] hover:bg-[#F7F8FA]"}`}>
                <input type="radio" name="settleTo" className="accent-[#165DFF]" checked={f.settleType === "间接"} disabled={locked}
                  onChange={() => onSettleType("间接")} />
                <span className="ml-1.5 font-medium text-[#1D2129]">先归集，月底再分</span>
                <div className="mt-0.5 text-[10px] text-[#86909C]">间接费用：先归集到成本中心，月末按中心所选的分法分到各订单</div>
              </label>
            </div>
            {f.settleType === "间接" && (
              <div className="mt-2">
                <div className="mb-0.5 text-[#4E5969]">归到哪个成本中心 <span className="text-[#F53F3F]">*</span>{lockTip}</div>
                <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={f.costCenter ?? ""} disabled={locked} onChange={(e) => set("costCenter", e.target.value)}>
                  <option value="">请选择…</option>
                  {getCenters().filter((c) => c.status !== "停用").map((c) => <option key={c.id} value={c.id}>{c.id} {c.name}</option>)}
                </select>
                <div className="mt-0.5 text-[10px] leading-4 text-[#C9CDD4]">管理成本中心（建中心、选分法）→ 侧边栏「成本中心」。</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* 试算：代入样例值验证公式（间接费用无算式，不试算——金额由成本中心分法决定） */}
      {f.settleType !== "间接" && active?.trial && linked && tresult != null && (
        <div className="space-y-1.5 rounded-[4px] border border-[#7BD9A8] bg-[#F0FBF5] px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-[#00701A]">试算（改数值即时验算）</span>
            {linked.note && <span className="rounded-[2px] bg-[#E8F3FF] px-1.5 py-0.5 text-[10px] text-[#165DFF]">🔗 {linked.note}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {active.trial.vars.map((tv, i) => (
              <label key={tv.label} className="flex items-center gap-1 text-[11px] text-[#4E5969]">
                {tv.label}
                <Input type="number" className="h-7 w-24 text-right text-xs" value={linked.vals[i]} disabled={i === linked.lockedIdx}
                  title={i === linked.lockedIdx ? "该值联动档案 / 字典，不可手改" : undefined}
                  onChange={(e) => setTrialVals(() => { const n = [...linked.vals]; n[i] = Number(e.target.value); return n; })} />
              </label>
            ))}
          </div>
          <div className="font-mono text-[12px] font-semibold text-[#00701A]">= {fmtN(tresult)} 元</div>
          <div className="text-[10px] leading-4 text-[#86909C]">算例：{active.trial.fmt(linked.vals, tresult)}</div>
        </div>
      )}

      <div>
        <div className="mb-0.5 text-[#4E5969]">备注</div>
        <textarea className="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5 text-sm" rows={2} placeholder="口径说明、例外处理等" value={f.remark ?? ""} onChange={(e) => set("remark", e.target.value)} />
      </div>
      {locked && (
        <div className="rounded-[2px] border border-[#FFCF8B] bg-[#FFF3E8] px-2 py-1.5 text-[11px] leading-5 text-[#FF7D00]">
          该条目正被 {refs.map((r) => r.type).join("、")} 使用，取数来源 / 适用资源 / 计价方式 / 算账去向 / 归属成本中心 已锁定；如需修改，请先在对应产品类型中解除装配。
        </div>
      )}
      {!locked && miss.length > 0 && (
        <div className="rounded-[2px] bg-[#F7F8FA] px-2 py-1.5 text-[11px] text-[#86909C]">距可生效还缺：{miss.join("、")}</div>
      )}
      <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
        <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
        <Button size="sm" onClick={save}>{initial ? "保存变更（全程留痕）" : "保存为草稿"}</Button>
      </div>
    </div>
  );
}

export default function CostItems() {
  useCostItems();
  const items = getCostItems();
  const [kw, setKw] = useState("");
  const [dept, setDept] = useState<"all" | "ops" | "tech">("all");
  const [status, setStatus] = useState<"all" | ItemStatus>("all");
  const [detail, setDetail] = useState<CostItem | null>(null);
  const [form, setForm] = useState<{ open: boolean; initial?: CostItem }>({ open: false });
  const [tab, setTab] = useState<"items" | "rates">("items");

  const cats = getCats();
  const refsOf = (key: string) => itemReferences(key, cats);
  const shown = items.filter((i) =>
    (dept === "all" || i.dept === dept) &&
    (status === "all" || i.status === status) &&
    (!kw || i.name.includes(kw) || i.key.includes(kw)),
  );
  const assembledCnt = items.filter((i) => refsOf(i.key).length > 0).length;

  const tabBar = (
    <div className="flex items-center gap-1 border-b border-[#E5E6EB]">
      {([["items", "成本条目"], ["rates", "计价标准（工时费率）"]] as const).map(([k, label]) => (
        <button key={k} onClick={() => setTab(k)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? "border-[#165DFF] font-semibold text-[#165DFF]" : "border-transparent text-[#4E5969] hover:text-[#1D2129]"}`}>
          {label}
        </button>
      ))}
    </div>
  );

  if (tab === "rates") return (
    <ArcoShell breadcrumb="成本条目库 / 计价标准">
      <main className="space-y-4 p-6">
        {tabBar}
        <DictsPanel />
      </main>
    </ArcoShell>
  );

  return (
    <ArcoShell breadcrumb="成本条目库">
      <main className="space-y-4 p-6">
        {tabBar}
        {/* 主线说明 */}
        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2 text-[11px] leading-5 text-[#86909C]">
          <span className="mr-1 font-semibold text-[#4E5969]">成本模型主线：</span>
          直接成本随单实时算，间接费用归集成本中心、月末按中心分法分到订单。
          本库是全系统算账口径的唯一出处：资源清单按产品组成推导直接成本时，从这里的条目取口径，页面不写死条目。
          <Link className="ml-1 text-[#165DFF] hover:underline" to="/product/bom">前往资源清单 →</Link>
        </div>

        {/* 统计 + 操作条 */}
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#1D2129]">成本条目库</span>
            <span className="rounded-[2px] bg-[#F2F3F5] px-2 py-0.5 text-[11px] text-[#4E5969]">共 {items.length} 项</span>
            <span className="rounded-[2px] bg-[#E8F8F2] px-2 py-0.5 text-[11px] text-[#00B42A]">生效 {items.filter((i) => i.status === "生效").length}</span>
            <span className="rounded-[2px] bg-[#E8F3FF] px-2 py-0.5 text-[11px] text-[#165DFF]">被装配 {assembledCnt}</span>
            <Input className="w-48" placeholder="搜索名称 / 编码" value={kw} onChange={(e) => setKw(e.target.value)} />
          </div>
          <Button size="sm" onClick={() => setForm({ open: true })}>＋ 新建条目</Button>
        </div>

        {/* 部门页签 + 状态过滤 */}
        <div className="flex items-center gap-2">
          {([["all", "全部"], ["ops", "业务支撑部"], ["tech", "技术部"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setDept(k)}
              className={`rounded-[2px] border px-2.5 py-1 text-xs ${dept === k ? "border-[#165DFF] bg-[#E8F3FF] text-[#165DFF]" : "border-[#E5E6EB] text-[#4E5969] hover:border-[#94BFFF]"}`}>
              {label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-[#E5E6EB]" />
          {([["all", "全部状态"], ["生效", "生效"], ["草稿", "草稿"], ["停用", "停用"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setStatus(k)}
              className={`rounded-[2px] px-2 py-1 text-xs ${status === k ? "bg-[#F2F3F5] font-medium text-[#1D2129]" : "text-[#86909C] hover:text-[#4E5969]"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* 条目表格 */}
        <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">编码</th><th className="px-3 py-2">条目名称</th><th className="px-3 py-2">类别</th>
                <th className="px-3 py-2">取数来源</th><th className="px-3 py-2">成本中心</th><th className="px-3 py-2">被装配</th>
                <th className="px-3 py-2">状态</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => {
                const refs = refsOf(i.key);
                return (
                  <tr key={i.key} className={`cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA] ${i.status === "停用" ? "opacity-55" : ""}`} onClick={() => setDetail(i)}>
                    <td className="px-3 py-2.5 font-mono text-[#4E5969]">{i.key}</td>
                    <td className="max-w-[260px] truncate px-3 py-2.5 font-medium text-[#1D2129]" title={i.name}>
                      {i.name}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${i.category === "资源驱动" ? "bg-[#E8F3FF] text-[#165DFF]" : "bg-[#FFF3E8] text-[#FF7D00]"}`}>{i.category}</span>
                      <span className="ml-1 rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] text-[#4E5969]" title={SETTLE_RULE[i.settleType]}>{i.settleType}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[#4E5969]">{i.category === "资源驱动" ? (ARCHIVE_OPTS.find((a) => a.key === i.sourceArchive)?.name ?? i.sourceArchive ?? "—") : "—"}</td>
                    <td className="px-3 py-2.5 text-[#4E5969]">{i.settleType === "间接" ? (CC_NAME(i.costCenter) || <span className="text-[#F53F3F]">未选中心</span>) : <span className="text-[#C9CDD4]">随单直接成本</span>}</td>
                    <td className="px-3 py-2.5">
                      {refs.length ? (
                        <span className="rounded-[2px] bg-[#E8F3FF] px-1.5 py-0.5 text-[10px] text-[#165DFF]" title={refs.map((r) => `${r.cat} / ${r.type}`).join("\n")}>{refs.length} 个类型</span>
                      ) : <span className="text-[#C9CDD4]">—</span>}
                    </td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <StatusFlow item={i} refs={refs} onChanged={() => {}} />
                    </td>
                    <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <button className="mr-1.5 text-[#4E5969] hover:underline" onClick={() => setForm({ open: true, initial: i })}>编辑</button>
                    </td>
                  </tr>
                );
              })}
              {!shown.length && <tr><td colSpan={8} className="px-3 py-10 text-center text-[#86909C]">无匹配条目</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          「资源驱动」从资源档案取数，「手工录入」核算时人工填报。直接成本要声明<strong className="text-[#4E5969]">适用资源</strong>：资源清单按产品组成推导直接成本时靠它把账带出来（组成里有这个资源 = 这笔账进核算单）。怎么算从五种计价方式里点选（按量计价 / 直接结转 / 工时计价 / 按出口合并计收 / 固定金额），都不匹配再自己搭算式。要素齐全才能「生效」；被装配的条目关键字段锁定，停用前先解除装配；默认行可删可补回（删除留痕，审批流兜底）。
        </div>
      </main>

      {/* 详情弹窗 */}
      {detail && (
        <CenterModal title={`${detail.name}`} sub={`${detail.key} · ${detail.dept === "ops" ? "业务支撑部" : "技术部"}填报 · ${detail.costType} · 单位 ${detail.unit}`} width={640} onClose={() => setDetail(null)}>
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 rounded-[2px] bg-[#F7F8FA] p-3 leading-5 text-[#4E5969]">
              <div>条目类别：<span className="font-medium text-[#1D2129]">{detail.category}</span></div>
              <div>状态：<span className="font-medium text-[#1D2129]">{detail.status}</span></div>
              <div>算账去向：<span className="font-medium text-[#1D2129]">{detail.settleType === "间接" ? "间接费用" : "直接成本"}</span></div>
              <div>归属成本中心：<span className="font-medium text-[#1D2129]">{detail.settleType === "间接" ? (CC_NAME(detail.costCenter) || "未选") : "—（直接成本随单算）"}</span></div>
              <div>取数来源：{detail.category === "资源驱动" ? (ARCHIVE_OPTS.find((a) => a.key === detail.sourceArchive)?.name ?? detail.sourceArchive ?? "—") : "—"}</div>
              <div>适用资源：<span className="font-medium text-[#1D2129]">{detail.settleType !== "间接" ? MAT_NAME(detail.appliesTo) : "—（间接费用不从组成推导）"}</span></div>
              {(detail.appliesToLog?.length ?? 0) > 0 && (
                <div className="col-span-2 rounded-[2px] border border-[#FFE8C8] bg-[#FFF7E8] px-2 py-1 text-[#FF7D00]">
                  适用资源变更留痕：{detail.appliesToLog!.map((l) => `${l.at} ${MAT_NAME(l.from) || "空"} → ${MAT_NAME(l.to) || "空"}`).join("；")}
                </div>
              )}
              <div>取数过滤：填报时按订单的产品类型自动过滤（资源档案的「归属产品类型 / 可共享产品类型」决定）</div>
              <div className="col-span-2 rounded-[2px] bg-[#FFF7E8] px-2 py-1 text-[#FF7D00]">{SETTLE_RULE[detail.settleType]}</div>
              <div className="col-span-2">怎么算：{detail.settleType === "间接" ? "金额由成本中心的分法统一算（本条目不设算式）" : detail.formula ?? "—"}</div>
              {detail.specDriver && <div className="col-span-2">规格驱动：{detail.specDriver}</div>}
            </div>
            {detail.methods.length > 0 && (
              <div>
                <div className="mb-1 font-medium text-[#4E5969]">字段与填入方式</div>
                <div className="space-y-1">
                  {detail.methods.map((m) => (
                    <div key={m.field} className="flex items-start gap-2 rounded-[2px] border border-[#E5E6EB] px-2 py-1.5">
                      <div className="leading-5">
                        <span className="font-medium text-[#1D2129]">{m.field}</span>
                        <span className="ml-1.5 text-[#86909C]">{m.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {detail.hint && <div className="rounded-[2px] bg-[#E8F3FF] px-2 py-1.5 leading-5 text-[#165DFF]">演算示例：{detail.hint}</div>}
            {(() => {
              const refs = refsOf(detail.key);
              return refs.length ? (
                <div className="rounded-[2px] border border-[#BEDAFF] px-2 py-1.5 leading-5 text-[#4E5969]">
                  <span className="font-medium">被装配/引用：</span>
                  {refs.map((r) => <span key={`${r.cat}${r.type}`} className="mr-2">{r.cat} / {r.type}</span>)}
                </div>
              ) : (
                <div className="text-[11px] text-[#C9CDD4]">暂未被任何产品类型装配</div>
              );
            })()}
            <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <Button variant="outline" size="sm" onClick={() => setDetail(null)}>关闭</Button>
              <Button size="sm" onClick={() => { setForm({ open: true, initial: detail }); setDetail(null); }}>编辑该条目</Button>
            </div>
          </div>
        </CenterModal>
      )}

      {/* 新建 / 编辑 */}
      {form.open && (
        <CenterModal title={form.initial ? `编辑条目 · ${form.initial.key}` : "新建成本条目"} sub={form.initial ? "修改条目档案，保存全程留痕" : "保存为草稿，四要素齐全后可置为生效"} width={560} onClose={() => setForm({ open: false })}>
          <ItemForm initial={form.initial} onClose={() => setForm({ open: false })} />
        </CenterModal>
      )}
    </ArcoShell>
  );
}
