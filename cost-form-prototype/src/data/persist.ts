// 演示数据本地持久化 —— 业务人员真实操作体验的关键支撑
// 所有可变台账在变更后自动快照到 localStorage：刷新 / 重开浏览器 / 隔天再来，数据都在，流程可跨页面流转。
// 提供「重置演示数据」一键回到出厂状态。正式环境替换为后端 API 后，本层整体下线（数据模块只改 persistable 一处）。
const KEY = "dmt-erp-demo-v1";

type Getter = () => unknown;
const registry = new Map<string, Getter>();

let cache: Record<string, unknown> | null = null;
function ensureLoaded(): Record<string, unknown> {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
  } catch {
    cache = {};
  }
  return cache;
}

/**
 * 台账持久化初始化：优先读回本地快照，没有再跑出厂初始值。
 * 用法：export const Xxx = persistable("xxx", () => [ ...出厂数据 ]);
 * 注意：业务代码必须原地修改（push / Object.assign / 字段赋值），禁止重新赋值导出的绑定（const 也赋不了）。
 */
export function persistable<T>(name: string, init: () => T): T {
  const blob = ensureLoaded();
  const val = name in blob ? (blob[name] as T) : init();
  registry.set(name, () => val);
  return val;
}

/** 立即把全部台账快照写入 localStorage（自动保存兜底之外的手动触发） */
export function saveNow(): void {
  // 跨标签页防覆盖：别的页面写过更新的快照时，先采纳新数据再落盘，
  // 否则本页定时快照会把内存里的旧数据整体写回，冲掉其他页面刚录入的数据
  const cur = readBlob();
  if (cur && typeof cur.__v === "number" && cur.__v > lastKnownV) {
    lastKnownV = cur.__v;
    adoptInPlace(cur);
    window.dispatchEvent(new CustomEvent("dmt-erp-external-sync"));
  }
  const out: Record<string, unknown> = {};
  registry.forEach((get, name) => { out[name] = get(); });
  out.__v = Date.now();
  lastKnownV = out.__v as number;
  try {
    localStorage.setItem(KEY, JSON.stringify(out));
  } catch {
    // 存储超限或被禁用时静默失败：演示不阻断，只是丢一次快照
  }
}

/** 一键重置：清掉本地快照并整页刷新，回到出厂演示数据 */
export function resetDemoData(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  // 登录态与短信验证码随重置一并清除，回到「未登录」出厂状态
  try { localStorage.removeItem("dmt-erp-session"); } catch { /* ignore */ }
  try { localStorage.removeItem("dmt-erp-sms-codes"); } catch { /* ignore */ }
  location.reload();
}

/** 是否存在本地快照（供 UI 展示「数据已本地保存」状态） */
export function hasPersistedData(): boolean {
  return Object.keys(ensureLoaded()).length > 0;
}

/** 指定台账是否来自本地快照（区分「出厂初始值」与「用户已持久化的数据」，供版本迁移判断） */
export function hasSnapshot(name: string): boolean {
  return name in ensureLoaded();
}

// 跨标签页同步：
// 多标签页同时打开时，localStorage 是唯一数据源，但各页内存独立——A 页录入特批折扣 →
// B 页 5 秒定时快照把内存旧数据整体写回 → A 页再进来数据"丢了"。
// 方案：快照带单调版本号（__v）；其他页面写入时本页经 storage 事件立即原地采纳新数据
//（数组清空重填 / 对象清键重赋，导出引用不变，业务代码全部原地修改），
// 再通知应用根组件整树重挂载，全站页面重新读取最新台账。
let lastKnownV = 0;

function readBlob(): (Record<string, unknown> & { __v?: number }) | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as Record<string, unknown> & { __v?: number }; } catch { return null; }
}

/** 用远端快照原地替换本页全部台账 */
function adoptInPlace(remote: Record<string, unknown>): void {
  registry.forEach((get, name) => {
    if (!(name in remote)) return;
    const local = get() as unknown;
    const inc = remote[name];
    if (Array.isArray(local) && Array.isArray(inc)) {
      local.length = 0;
      local.push(...inc);
    } else if (local && inc && typeof local === "object" && typeof inc === "object") {
      const l = local as Record<string, unknown>;
      Object.keys(l).forEach((k) => { delete l[k]; });
      Object.assign(l, inc);
    }
    // 原始类型（string/number）无法原地替换，跳过（当前台账均为数组/对象）
  });
  cache = { ...remote };
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      const remote = JSON.parse(e.newValue) as Record<string, unknown> & { __v?: number };
      if (typeof remote.__v !== "number" || remote.__v <= lastKnownV) return;
      lastKnownV = remote.__v;
      adoptInPlace(remote);
      window.dispatchEvent(new CustomEvent("dmt-erp-external-sync"));
    } catch { /* 解析失败忽略 */ }
  });
  // 自动保存：页面关闭 / 切后台时必存；定时兜底覆盖长时间停留不刷新
  window.addEventListener("beforeunload", saveNow);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveNow(); });
  setInterval(saveNow, 5000);
}
