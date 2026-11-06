// 资源中心 · v3
// v3 改进（2026-10-23 反馈）：
//   ① 每个档案支持 卡片 / 列表 双视图切换
//   ② 详情与编辑全部走居中弹窗（CenterModal），不再用右侧抽屉
//   ③ R3 IP 卡片瘦身：256 格改 32×8 紧凑热力格，一屏可看更多网段
//   ④ 所有档案补「编辑」入口（居中表单，预填原值，变更留痕），支持停用/启用
import { useState } from "react";
import { useParams, Link } from "react-router";
import {
  ARCHIVES, ARCHIVE_FIELDS, R1_ROWS, R2_ROWS, R3_ROWS, R4_ROWS, IP_CAT_L1, IP_CAT_L2_DEMO, R1_CONTRACTS, R1_CONTRACT_META, R2_CONTRACT_META, SUPPLIERS,
  INV_IN_DOCS, INV_OUT_DOCS,
  useInventory, stockIn, stockOut,
  type ArchiveDef, type FieldDef,
} from "@/data/resources";
import { MAT_DEF, useCatalog } from "@/data/products";
import { usePurchase } from "@/data/purchase";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import RelatedList from "@/components/RelatedList";
import { RegionCascader } from "@/components/RegionCascader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const fmt = (n: number) => n.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
// 多选字段容错：既有数据为数组，表单保存中间态为 "、" 连接字符串
const asList = (v: unknown): string[] => (Array.isArray(v) ? v : typeof v === "string" && v ? v.split("、") : []);

// 水位配色：≤60% 绿 / ≤85% 橙 / >85% 红（阈值未来在资源建模时可配）
const utilColor = (pct: number) => (pct <= 60 ? "#00B42A" : pct <= 85 ? "#FF7D00" : "#F53F3F");
const utilLabel = (pct: number) => (pct <= 60 ? "健康" : pct <= 85 ? "偏高" : "紧张");

// 各档案字段取值器（含②层动态值）
const CELL: Record<string, (row: any, f: FieldDef) => string> = {
  r1: (r, f) => {
    if (f.key === "id") return r.id;
    if (f.key === "product") return r.product;
    if (f.key === "sharedWith") return r.sharedWith || "—（专属）";
    if (f.key === "monthlyCost") return `${fmt(r.monthlyCost)} 元/月`;
    if (f.key === "capacityM") return `${fmt(r.capacityM)} M（商用参考）`;
    if (f.key === "usedM") return `${fmt(r.dynamic.usedM)} M（商用指标）`;
    if (f.key === "orders") return r.dynamic.orders.length ? `${r.dynamic.orders.length} 单` : "—";
    return String(r[f.key] ?? "—");
  },
  r2: (r, f) => {
    if (f.key === "price") return `${fmt(r.price)} 元${r.billing === "周期性（月）" ? "/月" : "（买断）"}`;
    if (f.key === "bwM") return `${fmt(r.bwM)} M`;
    if (f.key === "usedBy") return r.dynamic?.usedBy ?? "—";
    return String(r[f.key] ?? "—");
  },
  r3: (r, f) => {
    if (f.key === "unitPrice") return `${fmt(r.unitPrice)} 元/个·月`;
    if (f.key === "reserved") return `${r.reserved ?? 0} 个（网关/广播预留）`;
    if (f.key === "usable") return `${r.total - (r.reserved ?? 0)} 个`;
    if (f.key === "product") return r.product || "—（未关联）";
    if (f.key === "boundLines") return asList(r.boundLines).join("、");
    if (f.key === "ipCat") return r.ipCat ?? "—";
    if (f.key === "allocated") return `${r.dynamic.allocated} 个`;
    if (f.key === "remain") return `${r.total - (r.reserved ?? 0) - r.dynamic.allocated} 个`;
    if (f.key === "allocDetail") return r.dynamic.orders.length ? `${r.dynamic.orders.length} 单占用` : "—";
    return String(r[f.key] ?? "—");
  },
  r4: (r, f) => {
    if (f.key === "costPrice") return `${fmt(r.costPrice)} 元`;
    if (f.key === "stock") return `${r.dynamic.stock} 台`;
    if (f.key === "locked") return `${r.dynamic.locked} 台`;
    if (f.key === "available") return `${r.dynamic.stock - r.dynamic.locked} 台`;
    return String(r[f.key] ?? "—");
  },
};

const NAV_NAME: Record<string, string> = {
  r1: "R1 出口线路档案", r2: "R2 基础线路", r3: "R3 IP 地址段",
  r4: "R4 设备库存",
};

// 列表视图隐藏的大字段（卡片/弹窗里看）
const HIDE_IN_LIST = ["effect", "region", "supplier", "location", "source", "pool", "contractNo", "category", "util", "remark"];

// 解析 CIDR 掩码 → 地址总数（如 /24 = 256）；解析失败返回 null
const parseCidrTotal = (seg: string): number | null => {
  const m = seg.match(/\/(\d{1,2})/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 0 && n <= 32 ? Math.pow(2, 32 - n) : null;
};
// R3 派生：IP 编码预览（取归属段前两段 + .0）
const r3IdPreview = (seg: string): string | null => {
  const m = seg.match(/(\d{1,3})\.(\d{1,3})\./);
  return m ? `IP-${m[1]}.${m[2]}.0` : null;
};

// ---------- R3 CIDR 工具（Number 算术，避免 32 位溢出） ----------
// 解析 "58.40.0.0/24" → { ip, prefix }；非法返回 null
const parseCidr = (seg: string): { ip: number; prefix: number } | null => {
  const m = seg.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/);
  if (!m) return null;
  const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (parts.some((p) => p > 255)) return null;
  const prefix = Number(m[5]);
  if (prefix > 32) return null;
  const ip = parts[0] * 16777216 + parts[1] * 65536 + parts[2] * 256 + parts[3];
  return { ip, prefix };
};
// 两个 CIDR 是否重叠：按网络块整数区间 [net, net+size) 判相交
const cidrOverlap = (a: { ip: number; prefix: number }, b: { ip: number; prefix: number }): boolean => {
  const sizeA = Math.pow(2, 32 - a.prefix), sizeB = Math.pow(2, 32 - b.prefix);
  const netA = Math.floor(a.ip / sizeA) * sizeA, netB = Math.floor(b.ip / sizeB) * sizeB;
  return netA < netB + sizeB && netB < netA + sizeA;
};
// 从既有档案中找出与目标归属段冲突的网段（编辑时排除自身）
const findSegmentConflicts = (seg: string, excludeId?: string) => {
  const target = parseCidr(seg);
  if (!target) return [];
  return R3_ROWS.filter((r) => r.id !== excludeId)
    .map((r) => ({ row: r, c: parseCidr(r.segment) }))
    .filter((x): x is { row: (typeof R3_ROWS)[number]; c: { ip: number; prefix: number } } => !!x.c && cidrOverlap(target, x.c))
    .map((x) => x.row);
};
// 归属段形态说明（替代原「网段类型」手填：由掩码自动推导）
const segmentKindHint = (seg: string): string | null => {
  const c = parseCidr(seg);
  if (!c) return null;
  const n = Math.pow(2, 32 - c.prefix);
  if (c.prefix === 32) return "单个主机地址（/32，1 个）";
  if (c.prefix === 24) return "C 段（一对多切分，256 个）";
  return `自定义 CIDR（${n.toLocaleString("zh-CN")} 个）`;
};

// ---------- 档案表单（新建 / 编辑共用，居中弹窗承载） ----------
function ArchiveForm({ archive, initial, onSave, onDisable, onClose }: {
  archive: ArchiveDef; initial?: any; onSave: (vals: Record<string, string>) => void; onDisable?: () => void; onClose: () => void;
}) {
  useCatalog();
  usePurchase();
  const fields = ARCHIVE_FIELDS(archive);
  const editable = fields.filter((f) => !f.dynamic && f.key !== "status");
  const readonlyF = fields.filter((f) => f.method === "readonly");
  const isR3 = archive.key === "r3";
  const isR1 = archive.key === "r1";
  const isR2 = archive.key === "r2";
  const isR4 = archive.key === "r4";
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    editable.forEach((f) => {
      const initVal = initial?.[f.key];
      if (initVal == null) return;
      // 多选字段（关联出口线路 / 业务类型）以 "、" 连接存取
      v[f.key] = Array.isArray(initVal) ? initVal.join("、") : String(initVal);
    });
    return v;
  });
  // R1 共享设置：勾选「允许其他产品类型使用」后才出现多选；存储格式仍为 "、" 连接。
  // 启用状态独立维护（新建时共享列表为空，仅看 sharedWith 无法区分「未启用」与「启用但未选」）
  const [shareEnabled, setShareEnabled] = useState((vals.sharedWith ?? "").trim().length > 0);
  const shareList = asList(vals.sharedWith);
  const toggleShare = (opt: string, checked: boolean) => {
    const next = checked ? [...shareList, opt] : shareList.filter((o) => o !== opt);
    setVals((v) => ({ ...v, sharedWith: next.join("、") }));
  };
  // 采购合同（R1 出口 / R2 基础线路）：下拉选择为主，无合适合同时手工填入
  const contractVal = vals.contractNo ?? "";
  const contractManual = contractVal !== "" && !R1_CONTRACTS.includes(contractVal);
  const [manualContract, setManualContract] = useState(contractManual);
  // 供应商（R4 设备）：下拉选择为主，无合适合同时手工填入
  const supplierVal = vals.supplier ?? "";
  const supplierManual = supplierVal !== "" && !SUPPLIERS.includes(supplierVal);
  const [manualSupplier, setManualSupplier] = useState(supplierManual);
  // 复杂控件占满整行，其余字段两列排布（一屏看全，不滚动）
  const FULL_KEYS = new Set(["boundLines", "ipCat", "remark", "sharedWith", "segment"]);
  // R3 联动：归属段 → 地址总数（掩码自动计算）；总数 − 保留 = 可用
  const r3Total = isR3 ? (parseCidrTotal(vals.segment ?? "") ?? (Number(vals.total) || null)) : null;
  const r3Usable = isR3 && r3Total != null ? r3Total - (Number(vals.reserved) || 0) : null;
  // R3 归属段冲突检测：点击「检测冲突」异步触发（非提交时校验）；归属段一变即重置结果
  const [segCheck, setSegCheck] = useState<"idle" | "checking" | "ok" | "conflict">("idle");
  const [segConflicts, setSegConflicts] = useState<typeof R3_ROWS>([]);
  const runSegCheck = () => {
    setSegCheck("checking");
    // 异步校验：原型用延时模拟服务端 CIDR 重叠核查；正式环境走后端查询
    setTimeout(() => {
      const found = findSegmentConflicts(vals.segment ?? "", initial?.id);
      setSegConflicts(found);
      setSegCheck(found.length > 0 ? "conflict" : "ok");
    }, 600);
  };
  const setField = (key: string, value: string) => {
    if (isR3 && key === "segment") { setSegCheck("idle"); setSegConflicts([]); }
    setVals((v) => {
      const next = { ...v, [key]: value };
      if (isR3 && key === "segment") {
        const t = parseCidrTotal(value);
        if (t != null) next.total = String(t);
      }
      return next;
    });
  };
  // R3 多选勾选（关联出口线路 / 业务类型）
  const r3Checked = (key: string) => (vals[key] ?? "").split("、").filter(Boolean);
  const toggleR3 = (key: string, opt: string, checked: boolean) => {
    const cur = r3Checked(key);
    const next = checked ? [...cur, opt] : cur.filter((o) => o !== opt);
    setVals((v) => ({ ...v, [key]: next.join("、") }));
  };
  // R3 IP 分类：两级（一级固定，二级未来用户自定义维护）；存储格式 "一级/二级"
  const [ipCatL1, setIpCatL1] = useState(() => String(initial?.ipCat ?? "").split("/")[0] || "");
  const ipCatL2 = () => String(vals.ipCat ?? "").split("/")[1] ?? "";
  const setIpCat = (l1: string, l2: string) => {
    setIpCatL1(l1);
    setVals((v) => ({ ...v, ipCat: l1 ? `${l1}/${l2}` : "" }));
  };
  const handleSave = () => { onSave(vals); };
  // 关联出口线路：折叠选择器（默认收起，点击展开、支持搜索；不平铺全量，真实数据量大）
  const [lineOpen, setLineOpen] = useState(false);
  const [lineQ, setLineQ] = useState("");
  const lockedLines: string[] = (initial?.boundLines as string[] | undefined) ?? [];
  // R3 联动：先选归属产品类型 → 仅列出归属该类型、或标记可共享给该类型的出口线路
  const selectedProduct = vals.product ?? "";
  const productLines = selectedProduct
    ? R1_ROWS.filter((r) => r.product === selectedProduct || asList(r.sharedWith).includes(selectedProduct)).map((r) => r.id)
    : [];
  const lineOptions = Array.from(new Set([...productLines, ...lockedLines]));
  const lineQTrim = lineQ.trim().toLowerCase();
  const lineFiltered = lineOptions.filter((id) => {
    if (!lineQTrim) return true;
    const row = R1_ROWS.find((r) => r.id === id);
    return id.toLowerCase().includes(lineQTrim) || (row?.name ?? "").toLowerCase().includes(lineQTrim) || (row?.carrier ?? "").toLowerCase().includes(lineQTrim);
  });
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {editable.map((f) => (
          <div key={f.key} className={FULL_KEYS.has(f.key) || (f.method === "search" && !(isR1 && f.key === "contractNo")) ? "col-span-2" : ""}>
            <div className="mb-0.5 flex items-center gap-1.5 text-xs text-[#4E5969]">
              <span className="font-medium">{f.label}</span>
              {f.method === "search" && <span className="text-[10px] text-[#165DFF]">来源：{f.source}</span>}
            </div>
            {f.method === "readonly" ? (
              <div className="rounded-[2px] border border-dashed border-[#E5E6EB] bg-[#F7F8FA] px-2 py-1.5 text-xs text-[#86909C]">
                {isR3 && f.key === "id" && !initial?.id && r3IdPreview(vals.segment ?? "")
                  ? `${r3IdPreview(vals.segment ?? "")}（预览，按网段自动生成）`
                  : initial?.[f.key] ?? f.placeholder ?? "系统生成"}
              </div>
            ) : f.method === "calc" ? (
              // 非②层的 calc 字段：①层静态推导值（total / usable），只读展示
              <div className="rounded-[2px] border border-dashed border-[#BEDAFF] bg-[#F7FAFF] px-2 py-1.5 font-mono text-xs text-[#165DFF]">
                {isR3 && f.key === "total" ? (r3Total != null ? `${r3Total} 个` : "填写网段后按掩码自动计算（/24 = 256）")
                  : isR3 && f.key === "usable" ? (r3Usable != null ? `${r3Usable} 个（= 总数 − 保留）` : "—")
                  : initial?.[f.key] ?? f.placeholder ?? "自动计算"}
              </div>
            ) : isR3 && f.key === "boundLines" ? (
              // 关联出口线路：折叠选择器（默认收起、点击展开、支持搜索；不平铺全量）
              <div className="rounded-[2px] border border-[#E5E6EB]">
                {/* 已选摘要条：chip 展示，点击展开/收起选择面板 */}
                <button type="button" onClick={() => setLineOpen((o) => !o)} className="flex w-full flex-wrap items-center gap-1.5 px-2 py-1.5 text-left">
                  <span className="text-[10px] text-[#165DFF]">{lineOpen ? "▴ 收起" : "▾ 选择"}</span>
                  {r3Checked("boundLines").length === 0 ? (
                    <span className="text-xs text-[#C9CDD4]">{selectedProduct ? "点击选择出口线路（已按归属产品类型过滤，来源 R1 档案）" : "请先选择上方「归属产品类型」"}</span>
                  ) : (
                    r3Checked("boundLines").map((id) => (
                      <span key={id} className="flex items-center gap-1 rounded-[2px] bg-[#E8F3FF] px-1.5 py-0.5 text-[11px] text-[#165DFF]">
                        <span className="font-mono">{id}</span>
                        {!lockedLines.includes(id) && (
                          <span className="cursor-pointer leading-none hover:text-[#F53F3F]"
                            onClick={(e) => { e.stopPropagation(); toggleR3("boundLines", id, false); }}>×</span>
                        )}
                      </span>
                    ))
                  )}
                </button>
                {lineOpen && (
                  <div className="border-t border-[#F2F3F5] p-2">
                    {!selectedProduct ? (
                      <div className="px-1 py-0.5 text-[11px] text-[#C9CDD4]">先选「归属产品类型」，这里只显示该类型可用（含可共享给它）的出口线路</div>
                    ) : (<>
                    <Input placeholder="搜索线路编码 / 名称 / 运营商…" value={lineQ} onChange={(e) => setLineQ(e.target.value)} className="mb-1.5" />
                    <div className="max-h-36 space-y-1 overflow-y-auto">
                      {lineFiltered.map((id) => {
                        const locked = lockedLines.includes(id);
                        const checked = r3Checked("boundLines").includes(id);
                        const row = R1_ROWS.find((r) => r.id === id);
                        return (
                          <label key={id} className="flex items-center gap-2 text-xs text-[#1D2129]">
                            <input type="checkbox" className="accent-[#165DFF]" checked={checked} disabled={locked && checked} onChange={(e) => toggleR3("boundLines", id, e.target.checked)} />
                            <span className="font-mono">{id}</span>
                            <span className="truncate text-[#86909C]">{row ? `${row.name} · ${row.carrier}` : "（历史关联，档案已调整）"}</span>
                            {locked && <span className="shrink-0 rounded-[2px] bg-[#FFF3E8] px-1 text-[10px] text-[#FF7D00]">已关联·只增不删</span>}
                          </label>
                        );
                      })}
                      {lineFiltered.length === 0 && <div className="px-1 py-0.5 text-[11px] text-[#C9CDD4]">该类型暂无可关联的出口线路（可在 R1 档案新增或调整共享标记）</div>}
                    </div>
                    </>)}
                  </div>
                )}
              </div>
            ) : isR3 && f.key === "ipCat" ? (
              // IP 地址分类：两级（一级固定「给客户用 / 自用」；二级未来用户在系统内自行维护，可自定义录入）
              <div className="flex items-center gap-2">
                <select className="w-32 shrink-0 rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={ipCatL1} onChange={(e) => setIpCat(e.target.value, "")}>
                  <option value="">请选择…</option>
                  {IP_CAT_L1.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="flex-1">
                  <Input placeholder={ipCatL1 ? `填写或选择${ipCatL1}的具体类型（正式环境由您在字典中维护）` : "请先选择一级分类"} value={ipCatL2()} list="r3-ip-cat-l2" disabled={!ipCatL1} onChange={(e) => setIpCat(ipCatL1, e.target.value)} />
                  {ipCatL1 && (
                    <datalist id="r3-ip-cat-l2">
                      {(IP_CAT_L2_DEMO[ipCatL1] ?? []).map((s) => <option key={s} value={s} />)}
                    </datalist>
                  )}
                </div>
              </div>
            ) : isR3 && f.key === "remark" ? (
              <textarea className="w-full rounded-[2px] border border-[#E5E6EB] px-2 py-1.5 text-sm" rows={2} placeholder={f.placeholder} value={vals[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)} />
            ) : isR1 && f.key === "sharedWith" ? (
              // 出口共享设置：先勾选项，再选可共享的产品类型（不勾选 = 仅归属产品类型使用，也可能只服务一家客户）
              <div className="rounded-[2px] border border-[#E5E6EB] p-2.5">
                <label className="flex items-center gap-2 text-xs text-[#1D2129]">
                  <input type="checkbox" className="accent-[#165DFF]" checked={shareEnabled}
                    onChange={(e) => { setShareEnabled(e.target.checked); if (!e.target.checked) setField("sharedWith", ""); }} />
                  <span>允许其他产品类型使用本出口</span>
                </label>
                {shareEnabled ? (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-dashed border-[#F2F3F5] pt-2">
                    <span className="w-full text-[10px] text-[#86909C]">勾选可使用本出口的产品类型（可多选）：</span>
                    {(f.options ?? []).filter((o) => o !== vals.product).map((o) => {
                      const checked = shareList.includes(o);
                      return (
                        <button key={o} type="button" onClick={() => toggleShare(o, !checked)}
                          className={`rounded-[2px] border px-2 py-1 text-xs transition-colors ${checked ? "border-[#165DFF] bg-[#E8F3FF] text-[#165DFF]" : "border-[#E5E6EB] text-[#4E5969] hover:border-[#94BFFF]"}`}>
                          {checked ? "✓ " : ""}{o}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-1 text-[10px] text-[#86909C]">不勾选 = 仅归属产品类型使用；具体服务一家还是多家客户，由订单承载情况决定</div>
                )}
              </div>
            ) : (isR1 || isR2) && f.key === "contractNo" ? (
              // 采购合同：下拉选择为主，无合适合同转手工填入（留痕）；选合同后按已签订条款自动带出商务参数（可再修改）
              <div className="space-y-1.5">
                <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={manualContract ? "__manual__" : contractVal}
                  onChange={(e) => {
                    if (e.target.value === "__manual__") { setManualContract(true); setField("contractNo", ""); return; }
                    setManualContract(false);
                    if (isR1) {
                      // R1 出口：带出容量 / 月租 / 生效日期 / 运营商
                      const meta = R1_CONTRACT_META[e.target.value];
                      setVals((v) => ({
                        ...v,
                        contractNo: e.target.value,
                        ...(meta?.capacityM ? { capacityM: String(meta.capacityM) } : {}),
                        ...(meta?.monthlyCost ? { monthlyCost: String(meta.monthlyCost) } : {}),
                        ...(meta?.effect ? { effect: meta.effect } : {}),
                        ...(meta?.carrier ? { carrier: meta.carrier } : {}),
                      }));
                      return;
                    }
                    if (isR2) {
                      // R2 基础线路：带出带宽 / 整线月租 / 生效日期 / 运营商
                      const meta = R2_CONTRACT_META[e.target.value];
                      setVals((v) => ({
                        ...v,
                        contractNo: e.target.value,
                        ...(meta?.bwM ? { bwM: String(meta.bwM) } : {}),
                        ...(meta?.price ? { price: String(meta.price) } : {}),
                        ...(meta?.effect ? { effect: meta.effect } : {}),
                        ...(meta?.carrier ? { carrier: meta.carrier } : {}),
                      }));
                      return;
                    }
                    setField("contractNo", e.target.value);
                  }}>
                  <option value="">请选择…</option>
                  {R1_CONTRACTS.map((c) => {
                    const meta = isR1 ? R1_CONTRACT_META[c] : R2_CONTRACT_META[c];
                    return <option key={c} value={c}>{c}{meta?.name ? `（${meta.name}）` : ""}</option>;
                  })}
                  <option value="__manual__">手工填入（尚无采购合同）</option>
                </select>
                {isR1 && !manualContract && contractVal && R1_CONTRACT_META[contractVal]?.monthlyCost && (
                  <div className="rounded-[2px] bg-[#E8F8F2] px-2 py-1 text-[10px] text-[#00B42A]">
                    ✓ 已按合同 {contractVal} 带出：容量 {R1_CONTRACT_META[contractVal].capacityM}M · 月租 {Number(R1_CONTRACT_META[contractVal].monthlyCost).toLocaleString("zh-CN")} 元 · 生效 {R1_CONTRACT_META[contractVal].effect}（可修改）
                  </div>
                )}
                {isR2 && !manualContract && contractVal && R2_CONTRACT_META[contractVal]?.price && (
                  <div className="rounded-[2px] bg-[#E8F8F2] px-2 py-1 text-[10px] text-[#00B42A]">
                    ✓ 已按合同 {contractVal} 带出：带宽 {R2_CONTRACT_META[contractVal].bwM}M · 整线月租 {Number(R2_CONTRACT_META[contractVal].price).toLocaleString("zh-CN")} 元 · 生效 {R2_CONTRACT_META[contractVal].effect}（可修改）
                  </div>
                )}
                {manualContract && (
                  <Input autoFocus placeholder="填入合同编号（如 CT-2026-xxx），留痕" value={contractVal} onChange={(e) => setField("contractNo", e.target.value)} />
                )}
              </div>
            ) : isR4 && f.key === "supplier" ? (
              // 供应商：下拉选择为主，无合适合同时手工填入（留痕）
              <div className="space-y-1.5">
                <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={manualSupplier ? "__manual__" : supplierVal}
                  onChange={(e) => {
                    if (e.target.value === "__manual__") { setManualSupplier(true); setField("supplier", ""); return; }
                    setManualSupplier(false);
                    setField("supplier", e.target.value);
                  }}>
                  <option value="">请选择…</option>
                  {SUPPLIERS.map((s) => <option key={s} value={s}>{s}</option>)}
                  <option value="__manual__">手工填入（供应商不在列表）</option>
                </select>
                {manualSupplier && (
                  <Input autoFocus placeholder="填入供应商名称，留痕" value={supplierVal} onChange={(e) => setField("supplier", e.target.value)} />
                )}
              </div>
            ) : f.method === "region" ? (
              // 地址类字段：省 / 市 / 区县三级级联（数据源为全国行政区划），可附详细地址
              <RegionCascader value={vals[f.key] ?? ""} onChange={(v) => setField(f.key, v)} withDetail={f.withDetail} detailPlaceholder={f.placeholder} />
            ) : f.method === "enum" ? (
              <select className="w-full rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm" value={vals[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)}>
                <option value="">请选择…</option>
                {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Input type={f.numeric ? "number" : "text"} className="flex-1" placeholder={f.placeholder ?? (f.method === "search" ? "搜索选择…（无档案可手工填入，留痕）" : "")} value={vals[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)} />
                  {isR3 && f.key === "segment" && (
                    <Button type="button" size="sm" variant="outline" disabled={segCheck === "checking" || !parseCidr(vals.segment ?? "")} onClick={runSegCheck}>
                      {segCheck === "checking" ? "检测中…" : "检测冲突"}
                    </Button>
                  )}
                </div>
                {isR3 && f.key === "segment" && (
                  <>
                    {segmentKindHint(vals.segment ?? "") && (
                      <div className="mt-1 text-[11px] text-[#86909C]">网段形态：{segmentKindHint(vals.segment ?? "")}（按掩码自动推导）</div>
                    )}
                    {segCheck === "ok" && <div className="mt-1 rounded-[2px] border border-[#00B42A] bg-[#E8F8F2] px-2 py-1 text-[11px] text-[#00B42A]">✓ 未与现有网段冲突，可使用</div>}
                    {segCheck === "conflict" && (
                      <div className="mt-1 rounded-[2px] border border-[#F53F3F] bg-[#FFECE8] px-2 py-1 text-[11px] leading-5 text-[#F53F3F]">
                        ⚠ 与现有网段冲突：{segConflicts.map((r) => `${r.segment}（${r.id}）`).join("；")}，建议调整网段
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      {readonlyF.length > 0 && (
        <div className="mt-3 rounded-[2px] bg-[#F7F8FA] p-2.5 text-[11px] text-[#86909C]">
          {readonlyF.map((f) => <span key={f.key} className="mr-3">{f.label}：{initial?.[f.key] ?? f.placeholder}</span>)}
        </div>
      )}
      <div className="mt-4 flex items-center gap-2 border-t border-[#F2F3F5] pt-3">
        <Button size="sm" onClick={handleSave}>{initial ? "保存变更（全程留痕）" : "保存为草稿（编码系统生成）"}</Button>
        {initial && onDisable && (
          <Button size="sm" variant="outline" className="text-[#F53F3F]" onClick={onDisable}>
            {initial.status === "停用" ? "重新启用" : "停用资源"}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onClose}>取消</Button>
      </div>
      <div className="mt-2 text-[11px] text-[#86909C]">原型演示：不写库；正式环境保存走「草稿 → 生效」状态机，关键参数变更全程留痕</div>
    </div>
  );
}

// ---------- R1 资源池卡片 ----------
function PoolCard({ row, onOpen, onEdit }: { row: any; onOpen: () => void; onEdit: () => void }) {
  const pct = Math.round((row.dynamic.usedM / row.capacityM) * 100);
  return (
    <div onClick={onOpen} className="cursor-pointer rounded-[4px] border border-[#E5E6EB] bg-white p-4 transition-colors hover:border-[#94BFFF]">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium leading-5 text-[#1D2129]">{row.name}</div>
        <span className="shrink-0 rounded-[2px] bg-[#E8F3FF] px-1.5 py-0.5 text-[10px] text-[#165DFF]">{row.product}</span>
      </div>
      <div className="mt-1 font-mono text-[11px] text-[#86909C]">{row.id} · {row.carrier} · {row.region}</div>
      <div className="mt-3">
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="text-[#4E5969]">已售 {fmt(row.dynamic.usedM)} M / 容量 {fmt(row.capacityM)} M</span>
          <span className="font-mono font-semibold" style={{ color: utilColor(pct) }}>{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-[2px] bg-[#F2F3F5]">
          <div className="h-full rounded-[2px]" style={{ width: `${Math.min(pct, 100)}%`, background: utilColor(pct) }} />
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-[#86909C]">
          <span>承载订单 {row.dynamic.orders.length} 单{row.sharedWith ? ` · 可共享：${row.sharedWith}` : " · 专属"}</span>
          <span className="font-medium" style={{ color: utilColor(pct) }}>{utilLabel(pct)}</span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[#F2F3F5] pt-2.5">
        <span className="text-xs text-[#4E5969]">月成本 <span className="font-mono font-semibold text-[#1D2129]">{fmt(row.monthlyCost)}</span> 元</span>
        <div className="flex items-center gap-2">
          <span className="flex gap-1">{(row.sharedWith ? row.sharedWith.split("、").slice(0, 2) : [row.product]).map((t: string) => <span key={t} className="rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] text-[#4E5969]">{t}</span>)}</span>
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">编辑</button>
        </div>
      </div>
    </div>
  );
}

// ---------- R2 线路卡片 ----------
function LineCard({ row, onEdit }: { row: any; onEdit: () => void }) {
  // 路由取线路名称中含「↔」的一段（如 客户侧↔漕河泾机房 / 上海↔北京），不再单列 A 端/Z 端字段
  const route = String(row.name ?? "").split("-").find((s: string) => s.includes("↔")) ?? "";
  return (
    <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-[#1D2129]">{row.name}</div>
        {row.shareable === "是" && <span className="shrink-0 rounded-[2px] bg-[#E8F3FF] px-1.5 py-0.5 text-[10px] text-[#165DFF]">可跨产品共用</span>}
      </div>
      {route && (
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[#165DFF] bg-white" />
          <div className="relative flex-1">
            <div className="h-px bg-gradient-to-r from-[#165DFF] to-[#94BFFF]" />
            <div className="absolute inset-x-0 -top-2 text-center font-mono text-[10px] text-[#165DFF]">{fmt(row.bwM)} M</div>
          </div>
          <div className="max-w-[45%] truncate text-[10px] leading-4 text-[#86909C]">{route}</div>
          <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#165DFF]" />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#F2F3F5] pt-2.5 text-[11px] text-[#4E5969]">
        <span>{row.carrier} · {row.contractNo}</span>
        <span>{row.billing === "周期性（月）" ? `月租 ${fmt(row.price)} 元` : `买断 ${fmt(row.price)} 元`}</span>
        {row.shareable === "是" && <span className="rounded-[2px] bg-[#E8F8F2] px-1.5 py-0.5 text-[10px] text-[#00B42A]">可共用</span>}
        {row.dynamic?.usedBy && <span className="rounded-[2px] bg-[#E8F3FF] px-1.5 py-0.5 text-[10px] text-[#165DFF]">{row.dynamic.usedBy}</span>}
        <button onClick={onEdit} className="ml-auto rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">编辑</button>
      </div>
    </div>
  );
}

// ---------- R3 IPAM 网段卡片（紧凑 32×8 热力格） ----------
function IpSegmentCard({ row, onOpen, onEdit }: { row: any; onOpen: () => void; onEdit: () => void }) {
  const usable = row.total - (row.reserved ?? 0);
  const pct = Math.round((row.dynamic.allocated / usable) * 100);
  return (
    <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-3 transition-colors hover:border-[#94BFFF]">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <span className="font-mono text-[13px] font-semibold text-[#1D2129]">{row.segment}</span>
          <span className="ml-2 font-mono text-[10px] text-[#86909C]">{row.id}</span>
          {row.name && <div className="mt-0.5 truncate text-[11px] text-[#4E5969]">{row.name}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {row.ipCat && <span className="rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] text-[#4E5969]" title="IP 地址分类">{row.ipCat}</span>}
          <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${row.source === "自有" ? "bg-[#E8F8F2] text-[#00B42A]" : "bg-[#FFF3E8] text-[#FF7D00]"}`}>{row.source}</span>
        </div>
      </div>
      {/* 32×8 紧凑热力格 */}
      <div onClick={onOpen} className="mt-2 grid cursor-pointer grid-cols-[repeat(32,minmax(0,1fr))] gap-[1px]" title="点击查看分配明细">
        {Array.from({ length: 256 }, (_, i) => (
          <div key={i} className="aspect-square rounded-[1px]" style={{ background: i < row.dynamic.allocated ? utilColor(pct) : "#F2F3F5" }} />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="text-[#4E5969]">已分配 <span className="font-mono font-semibold" style={{ color: utilColor(pct) }}>{row.dynamic.allocated}</span>/{usable}（可用） · 剩余 {usable - row.dynamic.allocated} · <span style={{ color: utilColor(pct) }}>{utilLabel(pct)}</span></span>
        <div className="flex items-center gap-1.5">
          <span className="hidden font-mono text-[10px] text-[#86909C] lg:inline">关联 {asList(row.boundLines).join("、")}</span>
          <button onClick={onOpen} className="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">明细</button>
          <button onClick={onEdit} className="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">编辑</button>
        </div>
      </div>
    </div>
  );
}

// ---------- R4 出入库操作弹窗（入库单 → 结存数量 → 出库单，禁止负库存；设备按采购价直接结转） ----------
function InvOpModal({ mode, row, onClose }: { mode: "in" | "out"; row: any; onClose: () => void }) {
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState<number>(row.costPrice ?? 0);
  const [poNo, setPoNo] = useState("");
  const [refId, setRefId] = useState("");
  const submit = () => {
    if (mode === "in") {
      if (!poNo.trim()) return alert("请填写来源采购单号（入库必须可溯源到 PO）");
      const doc = stockIn(row.id, qty, price, poNo.trim());
      if (!doc) return alert("入库失败：数量须大于 0");
      const d = R4_ROWS.find((r) => r.id === row.id);
      alert(`已生成入库单 ${doc.id}：结存 ${d!.dynamic.stock} 台（档案采购价 ${fmt(d!.costPrice)} 元不变，设备按采购价直接结转）`);
    } else {
      const doc = stockOut(row.id, qty, "销售订单", refId.trim() || "—");
      if (!doc) return alert("出库被拒绝：现存量不足，系统不允许负库存");
      alert(`已生成出库单 ${doc.id}：${qty} 台 × 采购价 ${fmt(doc.costPrice)} 元 = ${fmt(qty * doc.costPrice)} 元，计入「${doc.refId}」成本`);
    }
    onClose();
  };
  return (
    <CenterModal
      title={mode === "in" ? `入库 · ${row.name}` : `出库 · ${row.name}`}
      sub={mode === "in" ? "采购到货验收后入库：只加现存量，档案采购价不变" : "订单领用 / 实施领料：按档案采购价直接结转计入订单成本"}
      width={440}
      onClose={onClose}
    >
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-0.5 text-[#4E5969]">数量（台）<span className="text-[#F53F3F]"> *</span></div>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(Math.floor(Number(e.target.value)))} />
          </div>
          <div>
            <div className="mb-0.5 text-[#4E5969]">{mode === "in" ? "本次采购单价（元，留痕）" : "出库单价（元）"}<span className="text-[#F53F3F]"> *</span></div>
            <Input type="number" value={price} disabled={mode === "out"}
              onChange={(e) => setPrice(Number(e.target.value))}
              title={mode === "out" ? "出库按档案采购价直接结转，不可改" : "本次采购单价，仅单据留痕；设备出库一律按档案采购价结转"} />
          </div>
        </div>
        {mode === "in" ? (
          <div>
            <div className="mb-0.5 text-[#4E5969]">来源采购单号 <span className="text-[#F53F3F]">*</span></div>
            <Input placeholder="如 PO-2026-031" value={poNo} onChange={(e) => setPoNo(e.target.value)} />
            <div className="mt-0.5 text-[10px] text-[#C9CDD4]">当前结存 {row.dynamic.stock} 台；设备一律按档案采购价直接结转，入库不改动档案价（采购价不同的新型号请新建档案）</div>
          </div>
        ) : (
          <div>
            <div className="mb-0.5 text-[#4E5969]">去向（订单 / 核算单号）</div>
            <Input placeholder="如 CE-2026-1008" value={refId} onChange={(e) => setRefId(e.target.value)} />
            <div className="mt-0.5 text-[10px] text-[#C9CDD4]">现存量 {row.dynamic.stock} 台（其中锁定 {row.dynamic.locked} 台）；出库金额 = 数量 × 档案采购价 {fmt(row.costPrice)} 元</div>
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={submit}>{mode === "in" ? "确认入库" : "确认出库"}</Button>
        </div>
      </div>
    </CenterModal>
  );
}

// ---------- R4 设备库存卡 ----------
function DeviceCard({ row, onEdit }: { row: any; onEdit: () => void }) {
  useInventory();
  const avail = row.dynamic.stock - row.dynamic.locked;
  const [op, setOp] = useState<"in" | "out" | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const docs = [
    ...INV_IN_DOCS.filter((d) => d.deviceId === row.id).map((d) => ({ at: d.at, text: `入库 ${d.qty} 台 @ ${fmt(d.price)} 元`, id: d.id, ref: d.poNo })),
    ...INV_OUT_DOCS.filter((d) => d.deviceId === row.id).map((d) => ({ at: d.at, text: `出库 ${d.qty} 台 @ ${fmt(d.costPrice)} 元`, id: d.id, ref: d.refId })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));
  return (
    <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-[#1D2129]">{row.name}</div>
        <span className="rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] text-[#4E5969]">{row.category}</span>
      </div>
      <div className="mt-1 font-mono text-[11px] text-[#86909C]">{row.id} · {row.location}</div>
      <div className="mt-3 grid grid-cols-3 divide-x divide-[#F2F3F5] border-y border-[#F2F3F5] py-3 text-center">
        <div><div className="font-mono text-lg font-semibold text-[#1D2129]">{row.dynamic.stock}</div><div className="text-[11px] text-[#86909C]">现存</div></div>
        <div><div className="font-mono text-lg font-semibold text-[#FF7D00]">{row.dynamic.locked}</div><div className="text-[11px] text-[#86909C]">锁定</div></div>
        <div><div className={`font-mono text-lg font-semibold ${avail <= 2 ? "text-[#F53F3F]" : "text-[#00B42A]"}`}>{avail}</div><div className="text-[11px] text-[#86909C]">可用{avail <= 2 && "（偏低）"}</div></div>
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#4E5969]">
        <span>采购价 <span className="font-mono font-semibold">{fmt(row.costPrice)}</span> 元 · {row.supplier}</span>
        <span className="flex items-center gap-1">
          <button onClick={() => setOp("in")} className="rounded-[2px] border border-[#7BD9A8] px-2 py-0.5 text-[11px] text-[#00B42A] hover:bg-[#E8F8F2]">入库</button>
          <button onClick={() => setOp("out")} className="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#FF7D00] hover:text-[#FF7D00]">出库</button>
          <button onClick={onEdit} className="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">编辑</button>
        </span>
      </div>
      {docs.length > 0 && (
        <div className="mt-2 border-t border-dashed border-[#F2F3F5] pt-2">
          <button className="text-[11px] text-[#86909C] hover:text-[#165DFF]" onClick={() => setDocsOpen((o) => !o)}>
            {docsOpen ? "▲ 收起单据" : `▼ 出入库单据（${docs.length}）`}
          </button>
          {docsOpen && (
            <div className="mt-1.5 space-y-1">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-[2px] bg-[#F7F8FA] px-2 py-1 text-[10px] text-[#4E5969]">
                  <span className="font-mono">{d.id}</span>
                  <span className={d.text.startsWith("入库") ? "text-[#00B42A]" : "text-[#FF7D00]"}>{d.text}</span>
                  <span className="text-[#86909C]">{d.at} · {d.ref}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {op && <InvOpModal mode={op} row={row} onClose={() => setOp(null)} />}
    </div>
  );
}

// ---------- 通用列表视图（卡片/表格切换中的"表格"侧） ----------
function ArchiveTable({ archive, rows, onEdit }: { archive: ArchiveDef; rows: any[]; onEdit: (row: any) => void }) {
  useCatalog();
  const cols = ARCHIVE_FIELDS(archive).filter((f) => !HIDE_IN_LIST.includes(f.key) && !f.dynamic).slice(0, 6);
  const dyn = ARCHIVE_FIELDS(archive).filter((f) => f.dynamic).slice(0, 2);
  const all = [...cols, ...dyn];
  const getter = CELL[archive.key] ?? ((r: any, f: FieldDef) => String(r[f.key] ?? "—"));
  return (
    <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
            {all.map((f) => (
              <th key={f.key} className="whitespace-nowrap px-3 py-2">
                {f.label}
                {f.dynamic && <span className="ml-1 rounded-[2px] bg-[#BEDAFF] px-1 text-[9px] text-[#165DFF]">②层</span>}
              </th>
            ))}
            <th className="px-3 py-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b last:border-0 hover:bg-[#F7F8FA]">
              {all.map((f) => (
                <td key={f.key} className="whitespace-nowrap px-3 py-2">
                  {f.key === "name" || f.key === "segment" ? <span className="font-medium text-[#1D2129]">{getter(r, f)}</span>
                    : f.key === "status" ? <span className={`rounded-[2px] px-1.5 py-0.5 text-[10px] ${r.status === "生效" || r.status === "在库" ? "bg-[#E8F8F2] text-[#00B42A]" : "bg-[#F2F3F5] text-[#4E5969]"}`}>{getter(r, f)}</span>
                    : <span className={f.dynamic ? "text-[#165DFF]" : "text-[#4E5969]"}>{getter(r, f)}</span>}
                </td>
              ))}
              <td className="px-3 py-2 text-right">
                <button onClick={() => onEdit(r)} className="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]">编辑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- 主页面 ----------
export default function Resources() {
  const params = useParams();
  const tab = NAV_NAME[params.key ?? ""] ? params.key! : "r1";
  const [view, setView] = useState<Record<string, "card" | "list">>({});
  const [extra, setExtra] = useState<Record<string, any[]>>({});
  const [rowOv, setRowOv] = useState<Record<string, any>>({});
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [kw, setKw] = useState("");
  const archive = ARCHIVES.find((a) => a.key === tab);
  const baseRows: Record<string, any[]> = { r1: R1_ROWS, r2: R2_ROWS, r3: R3_ROWS, r4: R4_ROWS };
  const curView = view[tab] ?? "list";
  const rows = [...(baseRows[tab] ?? []), ...(extra[tab] ?? [])].map((r) => ({ ...r, ...(rowOv[r.id] ?? {}) }));
  // 条件搜索：匹配档案行任意字段（含业务过程值）
  const kwTrim = kw.trim().toLowerCase();
  const shownRows = kwTrim ? rows.filter((r) => JSON.stringify(r).toLowerCase().includes(kwTrim)) : rows;

  // 顶部健康总览
  const avgUtil = Math.round(R1_ROWS.reduce((s, r) => s + r.dynamic.usedM / r.capacityM, 0) / R1_ROWS.length * 100);
  const ipTotal = R3_ROWS.reduce((s, r) => s + r.total, 0);
  const ipUsed = R3_ROWS.reduce((s, r) => s + r.dynamic.allocated, 0);
  const lowStock = R4_ROWS.filter((r) => r.dynamic.stock - r.dynamic.locked <= 2);
  const overview = [
    { label: "出口线路", value: `${R1_ROWS.length} 条`, sub: `平均商用水位 ${avgUtil}%`, color: utilColor(avgUtil) },
    { label: "IP 地址", value: `${ipUsed} / ${ipTotal}`, sub: `已分配 ${Math.round((ipUsed / ipTotal) * 100)}%`, color: utilColor((ipUsed / ipTotal) * 100) },
    { label: "基础线路", value: `${R2_ROWS.length} 条`, sub: "接入段 / 长途段", color: "#165DFF" },
    { label: "库存预警", value: `${lowStock.length} 项`, sub: lowStock.length ? lowStock.map((r) => r.id).join("、") : "无", color: lowStock.length ? "#F53F3F" : "#00B42A" },
  ];

  // R3 多选字段入库前还原为数组；其余档案原样保存
  const normalizeVals = (vals: Record<string, string>) =>
    tab === "r3"
      ? { ...vals, boundLines: (vals.boundLines ?? "").split("、").filter(Boolean) }
      : vals;
  const saveEdit = (vals: Record<string, string>) => {
    if (editing) setRowOv((o) => ({ ...o, [editing.id]: { ...editing, ...normalizeVals(vals) } }));
    setEditing(null);
  };
  const createRow = (vals: Record<string, string>) => {
    setExtra((e) => ({ ...e, [tab]: [...(e[tab] ?? []), { ...normalizeVals(vals), id: `NEW-${Date.now().toString().slice(-4)}`, status: "草稿", dynamic: { usedM: 0, orders: [], stock: 0, locked: 0, allocated: 0 } }] }));
    setCreating(false);
  };
  const toggleDisable = () => {
    if (editing) setRowOv((o) => ({ ...o, [editing.id]: { ...editing, ...(o[editing.id] ?? {}), status: (o[editing.id]?.status ?? editing.status) === "停用" ? "生效" : "停用" } }));
    setEditing(null);
  };

  return (
    <ArcoShell breadcrumb={`资源中心 / ${NAV_NAME[tab]}`}>
      <main className="p-6">
        {/* 内容区（档案切换已归入全局侧边栏「资源中心」分组） */}
        <div className="space-y-4">
          {/* 数据模型说明：物料主数据（类）→ 实例档案 → 业务过程 → 快照 */}
          <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2 text-[11px] leading-5 text-[#86909C]">
            <span className="mr-1 font-semibold text-[#4E5969]">数据模型：</span>
            资源目录（类，<Link className="text-[#165DFF] hover:underline" to="/materials">资源目录</Link>）→ 本页实例档案（人工维护、变更留痕）→ 业务过程（负载 / 占用 / 锁定，蓝色区块，只读）→ 月末快照（冻结）。占用在核算审批通过时生效，退订归档时释放。
          </div>

          {/* 健康总览条 */}
          <div className="grid grid-cols-4 gap-3">
            {overview.map((o) => (
              <div key={o.label} className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-3">
                <div className="text-[11px] text-[#86909C]">{o.label}</div>
                <div className="mt-0.5 font-mono text-lg font-semibold" style={{ color: o.color }}>{o.value}</div>
                <div className="truncate text-[10px] text-[#86909C]">{o.sub}</div>
              </div>
            ))}
          </div>

          {/* 档案操作条 + 视图切换 */}
          {archive && (
            <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
              <div className="text-sm">
                <span className="font-semibold text-[#1D2129]">{archive.code} · {archive.name}</span>
                <Link className="ml-2 rounded-[2px] bg-[#F7F8FA] px-1.5 py-0.5 text-[10px] text-[#4E5969] hover:text-[#165DFF]"
                  to="/materials" title="这套实例档案归属的资源（类）——资源目录是主，档案是实例维度">
                  归属资源：{MAT_DEF(archive.materialKey)?.name ?? archive.materialKey}
                </Link>
                <span className="ml-3 text-xs text-[#86909C]">{archive.poolHint}</span>
              </div>
              <div className="flex items-center gap-2">
                <Input className="w-52" placeholder="搜索档案（任意字段）" value={kw} onChange={(e) => setKw(e.target.value)} />
                <div className="flex rounded-[2px] border border-[#E5E6EB] p-0.5">
                  {([["card", "卡片"], ["list", "列表"]] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setView((v) => ({ ...v, [tab]: k }))}
                      className={`rounded-[2px] px-2.5 py-1 text-[11px] ${curView === k ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>{label}</button>
                  ))}
                </div>
                <Button size="sm" onClick={() => setCreating(true)}>＋ 新建档案</Button>
              </div>
            </div>
          )}
          {/* ===== 各档案内容（卡片 / 列表 双视图） ===== */}
          {archive && curView === "list" && (
            <ArchiveTable archive={archive} rows={shownRows} onEdit={setEditing} />
          )}

          {tab === "r1" && curView === "card" && (
            <div className="grid gap-3 xl:grid-cols-2">
              {shownRows.map((r) => (
                <PoolCard key={r.id} row={r} onOpen={() => setDetail(r)} onEdit={() => setEditing(r)} />
              ))}
            </div>
          )}

          {tab === "r2" && curView === "card" && (
            <>
              {(["接入段", "长途段"] as const).map((seg) => {
                const list = shownRows.filter((r) => r.seg === seg);
                if (!list.length) return null;
                return (
                  <div key={seg}>
                    <div className="mb-2 text-xs font-semibold text-[#4E5969]">{seg} · {list.length} 条</div>
                    <div className="grid gap-3 xl:grid-cols-2">
                      {list.map((r) => <LineCard key={r.id} row={r} onEdit={() => setEditing(r)} />)}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {tab === "r3" && curView === "card" && (
            <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
              {shownRows.map((r) => (
                <IpSegmentCard key={r.id} row={r} onOpen={() => setDetail(r)} onEdit={() => setEditing(r)} />
              ))}
            </div>
          )}

          {tab === "r4" && curView === "card" && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {shownRows.map((r) => <DeviceCard key={r.id} row={r} onEdit={() => setEditing(r)} />)}
            </div>
          )}

        </div>
      </main>

      {/* ===== 居中弹窗：新建 / 编辑 ===== */}
      {(creating || editing) && archive && (
        <CenterModal
          title={editing ? `编辑 · ${editing.id}` : `新建 · ${archive.name}`}
          sub={editing ? "修改①层主数据参数，保存后全程留痕；②层业务数据不可在此修改" : "保存为草稿，走「草稿 → 生效」状态机"}
          width={880}
          maxH="78vh"
          onClose={() => { setCreating(false); setEditing(null); }}
        >
          <ArchiveForm
            archive={archive}
            initial={editing}
            onClose={() => { setCreating(false); setEditing(null); }}
            onSave={creating && !editing ? createRow : saveEdit}
            onDisable={editing ? toggleDisable : undefined}
          />
          {editing && <div className="mt-3"><RelatedList archiveKey={tab} /></div>}
        </CenterModal>
      )}

      {/* ===== 居中弹窗：R1 资源池详情 ===== */}
      {detail && tab === "r1" && (
        <CenterModal title={`${detail.id} · 资源详情`} sub="①层主数据 + ②层实时负载（只读）" width={680} onClose={() => setDetail(null)}>
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-xs font-semibold text-[#4E5969]">①层主数据参数</div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                {ARCHIVE_FIELDS(archive!).filter((f) => !f.dynamic).map((f) => (
                  <div key={f.key} className="flex justify-between border-b border-dashed border-[#F2F3F5] py-1">
                    <dt className="text-[#86909C]">{f.label}</dt>
                    <dd className="max-w-[60%] text-right font-medium text-[#1D2129]">{CELL.r1(detail, f)}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <>
                <div className="mb-2 text-xs font-semibold text-[#4E5969]">②层实时负载 · 已承载订单（只读，由审批通过订单生成）</div>
                <div className="rounded-[2px] border border-[#BEDAFF] bg-[#E8F3FF] p-3 text-xs leading-6">
                  {detail.dynamic.orders.map((o: any) => (
                    <div key={o.customer} className="flex justify-between border-b border-[#E8F3FF] py-0.5 last:border-0">
                      <span>{o.customer}</span><span className="font-mono">{o.bw} M · {o.since} 开通</span>
                    </div>
                  ))}
                  <div className="mt-1 flex justify-between font-semibold text-[#0E42D2]">
                    <span>本线已售 {fmt(detail.dynamic.usedM)} M · 本单成本按「{detail.product}出口池」边际计价：池月租合计 ÷（池已售合计 + 本单带宽）× 本单带宽（月结按平均分摊做实际归属）</span>
                    <span className="font-mono">容量 {fmt(detail.capacityM)} M（商用参考）</span>
                  </div>
                </div>
              </>
              <div className="mt-3 text-[11px] leading-5 text-[#86909C]">
                「出口带宽租用费」从本档案选线（按归属产品类型过滤、可多选）；同类型出口合并计收（边际计价）：月租合计 ÷（已售 + 本单带宽）× 本单带宽。选线后，「IP 地址使用费」以所选线路为条件从 IP 地址段档案挑选。
              </div>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => { setEditing(detail); setDetail(null); }}>编辑该资源</Button>
              <RelatedList archiveKey="r1" />
            </div>
          </div>
        </CenterModal>
      )}

      {/* ===== 居中弹窗：R3 IP 网段明细 ===== */}
      {detail && tab === "r3" && (
        <CenterModal title={`${detail.id} · ${detail.segment}`} sub="②层分配明细（只读，由审批通过订单生成）" width={560} onClose={() => setDetail(null)}>
          <div className="space-y-4">
            <div className="rounded-[2px] border border-[#BEDAFF] bg-[#E8F3FF] p-3 text-xs leading-6">
              {detail.dynamic.orders.map((o: any) => (
                <div key={o.customer} className="flex justify-between border-b border-[#E8F3FF] py-0.5 last:border-0">
                  <span>{o.customer}</span><span className="font-mono">{o.n} 个</span>
                </div>
              ))}
            </div>
            <div className="text-xs leading-5 text-[#4E5969]">
              <div>网段名称：{detail.name ?? "—"}</div>
              <div className="mt-1">地址总数 <span className="font-mono font-semibold">{detail.total}</span> · 保留（网关/广播）<span className="font-mono font-semibold">{detail.reserved ?? 0}</span> · 可用 <span className="font-mono font-semibold">{detail.total - (detail.reserved ?? 0)}</span></div>
              <div className="mt-1">已分配 <span className="font-mono font-semibold text-[#165DFF]">{detail.dynamic.allocated}</span> · 剩余可用 <span className="font-mono font-semibold">{detail.total - (detail.reserved ?? 0) - detail.dynamic.allocated}</span></div>
              <div className="mt-1">关联出口线路：{asList(detail.boundLines).join("、")}（已关联只增不删，变更留痕）</div>
              <div className="mt-1">归属产品类型：{detail.product || "—（未关联）"} · IP 分类：{detail.ipCat ?? "—"}</div>
              <div className="mt-1">单价 {fmt(detail.unitPrice)} 元/个·月 · 来源 {detail.source}</div>
              {detail.remark && <div className="mt-1 rounded-[2px] bg-[#F7F8FA] px-2 py-1 text-[#86909C]">备注：{detail.remark}</div>}
            </div>
            <Button size="sm" variant="outline" onClick={() => { setEditing(detail); setDetail(null); }}>编辑该网段</Button>
            <RelatedList archiveKey="r3" />
          </div>
        </CenterModal>
      )}
    </ArcoShell>
  );
}
