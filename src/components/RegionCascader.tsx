// 省/市/区县三级级联选择（含可选的详细地址输入）
// 存值为可读的拼接字符串（如「上海市浦东新区博云路 2 号」「浙江省杭州市西湖区文三路 100 号」），
// 直辖市自动省略重复的市级段；编辑时按名称前缀回解析，解析不了的残留文本归入详细地址。
import { Input } from "./ui/input";
import { REGIONS } from "../data/regions";

export interface RegionParts {
  prov: string;
  city: string;
  dist: string;
  detail: string;
}

/** 去掉行政区划后缀得到的短名（如 内蒙古自治区→内蒙古、苏州市→苏州），用于宽松匹配历史录入 */
function shorts(name: string): string[] {
  const s = name.replace(/(特别行政区|壮族自治区|回族自治区|维吾尔自治区|自治区|自治州|省|市|地区|盟|州)$/, "");
  return s !== name ? [name, s] : [name];
}

/** 在列表中找出 rest 的前缀匹配（优先长名），命中返回 [匹配到的完整名, 剩余文本] */
function matchPrefix(rest: string, names: string[]): [string, string] | null {
  const sorted = [...names].sort((a, b) => b.length - a.length);
  for (const n of sorted) {
    for (const s of shorts(n)) {
      if (s && rest.startsWith(s)) return [n, rest.slice(s.length)];
    }
  }
  return null;
}

/** 直辖市：只有一个与省同名的市 */
function isMunicipality(prov: string): boolean {
  const node = REGIONS.find((p) => p[0] === prov);
  return !!node && node[1].length === 1 && node[1][0][0] === prov;
}

/** 拼接存值：直辖市跳过市级段 */
export function joinRegion(r: RegionParts): string {
  const citySeg = r.city && r.city !== r.prov ? r.city : "";
  return `${r.prov}${citySeg}${r.dist}${r.detail ?? ""}`.trim();
}

export function parseRegion(value: string): RegionParts {
  let rest = (value ?? "").trim();
  let prov = "", city = "", dist = "";
  const pm = matchPrefix(rest, REGIONS.map((p) => p[0]));
  if (pm) {
    [prov, rest] = pm;
    const cities = REGIONS.find((p) => p[0] === prov)?.[1] ?? [];
    if (isMunicipality(prov)) {
      city = cities[0][0]; // 直辖市不消耗文本，区级直接跟在省名后
    } else {
      const cm = matchPrefix(rest, cities.map((c) => c[0]));
      if (cm) {
        [city, rest] = cm;
        const dm = matchPrefix(rest, cities.find((c) => c[0] === city)?.[1] ?? []);
        if (dm) [dist, rest] = dm;
      }
    }
    if (city && !dist) {
      const dm = matchPrefix(rest, cities.find((c) => c[0] === city)?.[1] ?? []);
      if (dm) [dist, rest] = dm;
    }
  }
  return { prov, city, dist, detail: rest };
}

const SEL = "rounded-[2px] border border-[#E5E6EB] bg-white px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50";

export function RegionCascader({ value, onChange, withDetail, detailPlaceholder, disabled }: {
  value: string;
  onChange: (v: string) => void;
  /** true = 额外显示详细地址输入（路名门牌 / 机房楼宇等） */
  withDetail?: boolean;
  detailPlaceholder?: string;
  disabled?: boolean;
}) {
  const r = parseRegion(value);
  const cities = REGIONS.find((p) => p[0] === r.prov)?.[1] ?? [];
  const districts = cities.find((c) => c[0] === r.city)?.[1] ?? [];
  const set = (patch: Partial<RegionParts>) => onChange(joinRegion({ ...r, ...patch }));
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <select className={`${SEL} w-32 shrink-0`} value={r.prov} disabled={disabled}
          onChange={(e) => set({ prov: e.target.value, city: "", dist: "" })}>
          <option value="">省份</option>
          {REGIONS.map((p) => <option key={p[0]} value={p[0]}>{p[0]}</option>)}
        </select>
        <select className={`${SEL} flex-1`} value={r.city} disabled={disabled || !r.prov}
          onChange={(e) => set({ city: e.target.value, dist: "" })}>
          <option value="">城市</option>
          {cities.map((c) => <option key={c[0]} value={c[0]}>{c[0]}</option>)}
        </select>
        <select className={`${SEL} flex-1`} value={r.dist} disabled={disabled || !r.city}
          onChange={(e) => set({ dist: e.target.value })}>
          <option value="">区/县</option>
          {districts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      {withDetail && (
        <Input placeholder={detailPlaceholder ?? "详细地址（路名、门牌号、楼层房间等）"} value={r.detail} disabled={disabled}
          onChange={(e) => set({ detail: e.target.value })} />
      )}
    </div>
  );
}
