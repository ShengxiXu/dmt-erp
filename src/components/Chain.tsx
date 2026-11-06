// 核算链路 · 大白话渲染组件（新人视角：卖出 1 单产品，系统怎么把成本一笔一笔算出来）
// 原则：不出现「装配 / 取数 / 归属 / 四要素」等内部术语；读例子能懂，查清单能用
import { useState } from "react";
import { Link } from "react-router";
import { ARCHIVE_NAME, itemArchiveKey, itemProblems, typeProblems, billExample } from "@/data/chain";
import { CC_NAME, CC_DEF, DRIVER_SENTENCE } from "@/data/costCenters";
import { GET_TYPE } from "@/data/products";
import { getCostItems, type CostItem } from "@/data/costItems";

const DEPT_NAME = (d: CostItem["dept"]) => (d === "ops" ? "业务支撑部" : "技术部");

/** 一笔账算出的钱记到哪：直接成本随单实时计入订单；间接费用先归集成本中心、月末按所选分法分配 */
const SETTLE = (item: CostItem): string =>
  item.settleType === "间接"
    ? (item.costCenter ? `归集到成本中心「${CC_NAME(item.costCenter)}」，月末按所选分法分配` : "还没选归集的成本中心")
    : "随单直接计入订单成本";

/** 一笔账：三行大白话（从哪来 / 怎么算 / 记到哪），配不齐时列出待办并给修复入口 */
export function CostLine({ item }: { item: CostItem }) {
  const archKey = itemArchiveKey(item);
  const problems = itemProblems(item);
  const broken = problems.length > 0;
  return (
    <div className={`rounded-[4px] border px-3 py-2.5 ${broken ? "border-[#FFCF8B] bg-[#FFFDF5]" : "border-[#E5E6EB] bg-white"}`}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[#1D2129]">{item.name}</span>
        <span className="text-[10px] text-[#C9CDD4]">{DEPT_NAME(item.dept)}填</span>
        {broken ? (
          <span className="ml-auto rounded-[2px] bg-[#FFECE8] px-1.5 py-0.5 text-[10px] text-[#F53F3F]">{problems.length} 件事待办</span>
        ) : (
          <span className="ml-auto text-[10px] text-[#00B42A]">✓ 配好了</span>
        )}
      </div>
      <div className="mt-1.5 space-y-0.5 text-[11px] leading-5 text-[#4E5969]">
        <div>
          · 从哪来：{archKey
            ? <>开通时从 <Link className="text-[#165DFF] hover:underline" to={`/resources/${archKey}`}>「{ARCHIVE_NAME(archKey)}」</Link> 里挑一条</>
            : `开通时由${DEPT_NAME(item.dept)}手工填报`}
        </div>
        <div>· 怎么算：{item.settleType === "间接"
          ? (item.costCenter && CC_DEF(item.costCenter)
            ? <>由成本中心「{CC_NAME(item.costCenter)}」统一算：{DRIVER_SENTENCE(CC_DEF(item.costCenter)!)}</>
            : <span className="text-[#F53F3F]">还没选归集的成本中心</span>)
          : item.formula ? <span className="font-mono text-[#1D2129]">{item.formula}</span> : <span className="text-[#F53F3F]">还没设置算法</span>}</div>
        <div>· 记到哪：{item.settleType === "间接" && !item.costCenter
          ? <span className="text-[#F53F3F]">{SETTLE(item)}</span>
          : SETTLE(item)}</div>
      </div>
      {broken && (
        <div className="mt-1.5 border-t border-dashed border-[#FFCF8B] pt-1.5">
          <ul className="space-y-0.5 text-[11px] leading-4 text-[#FF7D00]">
            {problems.map((p, i) => <li key={i}>⚠ {p}</li>)}
          </ul>
          <Link to="/cost-items" className="mt-1 inline-block text-[11px] text-[#165DFF] hover:underline">
            去成本条目库处理这笔账 →
          </Link>
        </div>
      )}
    </div>
  );
}

/** 一个产品的完整算账说明（卡片式，供「成本怎么算」总览页使用）：卖出 1 单要算哪些账 + 待办清单 */
export function CostStory({ catName, typeName }: { catName: string; typeName: string }) {
  const type = GET_TYPE(catName, typeName);
  const items = getCostItems();
  if (!type) return null;
  const problems = typeProblems(type, items);
  return (
    <div>
      <div className="mb-2 text-xs leading-5 text-[#4E5969]">
        卖出 1 单 <strong className="text-[#1D2129]">{typeName}</strong>，系统要算{" "}
        <strong className="text-[#1D2129]">{type.costItems.length}</strong> 笔账：
        {!type.costItems.length && <span className="text-[#FF7D00]">（还没配，开单时系统不知道该算什么）</span>}
      </div>
      <div className="space-y-2">
        {type.costItems.map((key) => {
          const it = items.find((i) => i.key === key);
          if (!it) return (
            <div key={key} className="rounded-[4px] border border-[#F53F3F] bg-[#FFECE8] px-3 py-2 text-[11px] text-[#F53F3F]">
              ⚠ 有一笔账（{key}）已被删除，请把它从产品里移除
            </div>
          );
          return <CostLine key={key} item={it} />;
        })}
      </div>
      {problems.length > 0 && (
        <div className="mt-2 rounded-[2px] border border-[#FFCF8B] bg-[#FFF7E8] px-2.5 py-1.5 text-[11px] leading-4 text-[#FF7D00]">
          {problems.map((p, i) => <div key={i}>⚠ {p.node}：{p.text}</div>)}
          <Link to={`/product/types?cat=${encodeURIComponent(catName)}`}
            className="mt-1 inline-block text-[#165DFF] hover:underline">去配置这个产品的账 →</Link>
        </div>
      )}
    </div>
  );
}

/** 产品算账向导：「举例说明」（用真实档案数据走一单，默认页签）+「算账清单」（四列对照表） */
export function CostGuide({ catName, typeName }: { catName: string; typeName: string }) {
  const [tab, setTab] = useState<"example" | "list">("example");
  const type = GET_TYPE(catName, typeName);
  const items = getCostItems();
  if (!type) return null;
  const bills = type.costItems.map((key) => ({ key, item: items.find((i) => i.key === key) }));
  const problemsOf = (item: CostItem | undefined) => (item ? itemProblems(item) : ["这笔账已被删除，请从产品里移除它"]);

  return (
    <div className="text-xs">
      {/* 页签 */}
      <div className="mb-3 flex w-fit rounded-[2px] border border-[#E5E6EB] p-0.5">
        {([["example", "举例说明"], ["list", "算账清单"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-[2px] px-3 py-1 text-xs ${tab === k ? "bg-[#165DFF] text-white" : "text-[#4E5969] hover:bg-[#F2F3F5]"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "example" ? (
        <>
          <div className="mb-2.5 leading-5 text-[#86909C]">
            以真实档案里的数据举例：卖出 1 单 <strong className="text-[#1D2129]">{typeName}</strong>，系统会这样一笔一笔算账——
          </div>
          <ol className="space-y-3">
            {bills.map(({ key, item }, i) => {
              const problems = problemsOf(item);
              const broken = problems.length > 0;
              const archKey = item ? itemArchiveKey(item) : undefined;
              const example = item ? billExample(item) : undefined;
              return (
                <li key={key} className="flex gap-2.5">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${broken ? "bg-[#FFECE8] text-[#F53F3F]" : "bg-[#E8F8F2] text-[#00B42A]"}`}>{i + 1}</span>
                  <div className="min-w-0">
                    <div className="font-medium text-[#1D2129]">
                      {item ? item.name : key}
                      {item && <span className="ml-1.5 text-[10px] font-normal text-[#C9CDD4]">{DEPT_NAME(item.dept)}填</span>}
                    </div>
                    <div className="mt-0.5 leading-5 text-[#4E5969]">
                      {example ? (
                        <>{example}；<span className="font-medium text-[#1D2129]">{SETTLE(item!)}</span></>
                      ) : item ? (
                        item.settleType === "间接" ? (
                          <>费用先归集到成本中心，月末由中心统一算（不用人工填报）；<span className="font-medium text-[#1D2129]">{SETTLE(item)}</span></>
                        ) : (
                          <>开通时由{DEPT_NAME(item.dept)}手工填报（按「{item.formula ?? "未设算法"}」）；<span className="font-medium text-[#1D2129]">{SETTLE(item)}</span></>
                        )
                      ) : (
                        <span className="text-[#F53F3F]">这笔账已被删除</span>
                      )}
                      {archKey && <span className="text-[#C9CDD4]">（<Link className="text-[#165DFF] hover:underline" to={`/resources/${archKey}`}>{ARCHIVE_NAME(archKey)}</Link>）</span>}
                    </div>
                    {broken && (
                      <div className="mt-0.5 space-y-0.5 text-[11px] leading-4 text-[#FF7D00]">
                        {problems.map((p, j) => <div key={j}>⚠ {p}</div>)}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
            {!bills.length && <li className="text-[#FF7D00]">⚠ 还没告诉系统这个产品要算哪些账，开单时系统不知道该算什么</li>}
          </ol>
        </>
      ) : (
        /* 算账清单：四列对照表 */
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
              <th className="px-2 py-1.5 font-medium">成本项</th>
              <th className="px-2 py-1.5 font-medium">从哪来</th>
              <th className="px-2 py-1.5 font-medium">怎么算</th>
              <th className="px-2 py-1.5 font-medium">记到哪</th>
              <th className="px-2 py-1.5 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            {bills.map(({ key, item }) => {
              const problems = problemsOf(item);
              const broken = problems.length > 0;
              const archKey = item ? itemArchiveKey(item) : undefined;
              return (
                <tr key={key} className="border-b last:border-0">
                  <td className="px-2 py-2 font-medium text-[#1D2129]">
                    {item ? item.name : key}
                    <div className="text-[10px] font-normal text-[#C9CDD4]">{item ? DEPT_NAME(item.dept) : "—"}</div>
                  </td>
                  <td className="max-w-[180px] px-2 py-2 text-[#4E5969]">
                    {archKey ? <Link className="text-[#165DFF] hover:underline" to={`/resources/${archKey}`}>「{ARCHIVE_NAME(archKey)}」挑</Link>
                      : item ? (item.category === "手工录入" ? "手工填报" : "字典/台账带出") : "—"}
                  </td>
                  <td className="max-w-[200px] px-2 py-2 font-mono text-[#4E5969]">{item?.settleType === "间接" ? "中心统一算（月末分配）" : item?.formula ?? <span className="text-[#F53F3F]">未设算法</span>}</td>
                  <td className="max-w-[170px] px-2 py-2 text-[#4E5969]">{item ? SETTLE(item) : "—"}</td>
                  <td className="px-2 py-2" title={problems.join("\n")}>
                    {broken
                      ? <span className="cursor-help rounded-[2px] bg-[#FFECE8] px-1.5 py-0.5 text-[10px] text-[#F53F3F]">⚠ {problems.length} 待办</span>
                      : <span className="text-[10px] text-[#00B42A]">✓ 配好了</span>}
                  </td>
                </tr>
              );
            })}
            {!bills.length && <tr><td colSpan={5} className="px-2 py-6 text-center text-[#86909C]">尚未配置要算哪些账</td></tr>}
          </tbody>
        </table>
      )}
      {/* 待办汇总 + 修复入口 */}
      {(() => {
        const ps = typeProblems(type, items);
        if (!ps.length) return null;
        return (
          <div className="mt-3 rounded-[2px] border border-[#FFCF8B] bg-[#FFF7E8] px-2.5 py-1.5 text-[11px] leading-4 text-[#FF7D00]">
            {ps.map((p, i) => <div key={i}>⚠ {p.node}：{p.text}</div>)}
            <Link to={`/product/types?cat=${encodeURIComponent(catName)}`} className="mt-1 inline-block text-[#165DFF] hover:underline">去配置这个产品的账 →</Link>
          </div>
        );
      })()}
    </div>
  );
}
