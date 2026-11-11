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
  const out: Record<string, unknown> = {};
  registry.forEach((get, name) => { out[name] = get(); });
  try {
    localStorage.setItem(KEY, JSON.stringify(out));
  } catch {
    // 存储超限或被禁用时静默失败：演示不阻断，只是丢一次快照
  }
}

/** 一键重置：清掉本地快照并整页刷新，回到出厂演示数据 */
export function resetDemoData(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
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

// 自动保存：页面关闭 / 切后台时必存；定时兜底覆盖长时间停留不刷新的场景
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", saveNow);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveNow(); });
  setInterval(saveNow, 5000);
}
