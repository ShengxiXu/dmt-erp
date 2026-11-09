// 变更测算正式版（2026-11-09）：套餐/带宽变更的增量成本不再按「成本率估算」，改为从产品组成自动推导——
// 产品类型装配的成本条目（资源清单）→ 条目取数来源档案（R1 出口池 / 基础线路 / IP 地址段）→ 按各条目计价方式算月成本。
// 口径：只推导「直接·周期性」条目；一次性条目（CPE/安装调测/物流）与间接费用（成本中心月结分）不进变更测算。
// 推导不出组成时（如存量订阅行识别不出产品类型）回退 A5 策略中心单价兜底，basis 中明示兜底口径。
import { CATS, PTYPES, GET_TYPE } from "@/data/products";
import { getCostItems } from "@/data/costItems";
import { SOURCES } from "@/data/catalog";
import { R1_ROWS } from "@/data/resources";
import { cfgNum } from "@/data/settings";

export interface BomLine { key: string; name: string; monthly: number; note: string }
export interface BomCost { lines: BomLine[]; total: number; resolved: boolean }

const num = (s: string | undefined) => (s ? Number(s) || 0 : 0);

/** 从订阅行文本识别产品类型（如「国内精品网 100M」→ 国内精品网） */
export function ptypeOfLine(line: string): string | null {
  for (const cat of CATS()) for (const pt of PTYPES(cat)) if (line.includes(pt)) return pt;
  return null;
}

/** 产品类型下的运营商数（基础线路按运营商各一条；档案无记录时默认 1） */
function carriersOf(ptype: string): number {
  const rows = SOURCES.lineinternet.rows.filter((r) => r.ptag === ptype);
  const carriers = new Set(rows.map((r) => r.title.slice(0, 2)));
  return carriers.size || 1;
}

/** R1 出口池边际计价：归属该产品类型（含可共享）的出口月租合计 ÷（已售 + 本单带宽）× 本单带宽 */
export function poolMarginal(ptype: string, bwM: number): { cost: number; poolCost: number; soldM: number } | null {
  const rows = R1_ROWS.filter((r) => r.status === "生效" && (r.product === ptype || r.sharedWith.split(/[、,，]/).map((s) => s.trim()).includes(ptype)));
  if (!rows.length) return null;
  const poolCost = rows.reduce((s, r) => s + r.monthlyCost, 0);
  const soldM = rows.reduce((s, r) => s + r.dynamic.usedM, 0);
  return { cost: Math.round((poolCost / (soldM + bwM)) * bwM), poolCost, soldM };
}

/** 基础线路月租参考值：档案均值 × 产品类型运营商数 */
function baseLineCost(ptype: string): { cost: number; note: string } {
  const rows = SOURCES.linebase.rows;
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + num(r.meta), 0) / rows.length) : 1000;
  const carriers = carriersOf(ptype);
  return { cost: avg * carriers, note: `基础线路档案均值 ${avg} 元/条 × ${carriers} 家运营商` };
}

/** IP 单价：IP 地址段档案单价（fallback A5） */
const ipUnit = () => num(SOURCES.ippool.rows[0]?.meta) || cfgNum("cost.ipUnit");

/**
 * 产品组成月成本推导：按产品类型装配条目逐项取数计算
 * @param bwM 带宽（M）
 * @param ipN 绑定 IP 数
 */
export function bomMonthlyCost(ptype: string, bwM: number, ipN: number): BomCost {
  const cat = CATS().find((c) => PTYPES(c).includes(ptype));
  const type = cat ? GET_TYPE(cat, ptype) : undefined;
  if (!type) return { lines: [], total: 0, resolved: false };
  const items = getCostItems();
  const lines: BomLine[] = [];
  for (const key of type.costItems) {
    const it = items.find((x) => x.key === key);
    if (!it || it.settleType === "间接") continue;      // 间接费用月结按收入占比分，不进单变更测算
    if (it.costType === "一次性") continue;             // 一次性条目随交付发生，不进月成本差
    switch (it.demo) {
      case "bwinternet": {
        const p = bwM > 0 ? poolMarginal(ptype, bwM) : null;
        if (p) lines.push({ key, name: it.name, monthly: p.cost, note: `出口池边际计价：池月租 ${p.poolCost.toLocaleString()} ÷（已售 ${p.soldM}M + 本单 ${bwM}M）× ${bwM}M` });
        else if (bwM > 0) lines.push({ key, name: it.name, monthly: Math.round(bwM * cfgNum("cost.exitPerM")), note: `无 ${ptype} 出口池档案，A5 兜底单价 ${cfgNum("cost.exitPerM")} 元/M/月 × ${bwM}M` });
        break;
      }
      case "bwbase": {
        const b = baseLineCost(ptype);
        lines.push({ key, name: it.name, monthly: b.cost, note: b.note });
        break;
      }
      case "ippool": {
        if (ipN > 0) lines.push({ key, name: it.name, monthly: ipN * ipUnit(), note: `${ipN} 个 × IP 档案单价 ${ipUnit()} 元/个·月` });
        break;
      }
      case "cabinet": {
        const cab = SOURCES.cabinet.rows[0];
        if (cab) lines.push({ key, name: it.name, monthly: num(cab.meta), note: `机柜档案 ${cab.title} 整柜月租 ${num(cab.meta)} 元` });
        break;
      }
      default:
        // port / otu / service / bgpplat / material / resale 等：按实际发生或随单选档案，测算不预设
        break;
    }
  }
  return { lines, total: lines.reduce((s, l) => s + l.monthly, 0), resolved: true };
}

export const ipOfLine = (s: string) => { const m = s.match(/IP\s*(\d+)\s*个/); return m ? +m[1] : 0; };
