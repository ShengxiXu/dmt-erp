// 「产品的成本是怎么算出来的」一览页（/resources/chain-map，《核算链路设计 v1.0》8.3 的新人版）
// 大白话：卖出 1 件产品，系统按清单一笔一笔算账；配好的打勾，没配好的写明缺什么、点哪去补
import { useState } from "react";
import { Link } from "react-router";
import { useCatalog, getCats } from "@/data/products";
import { useCostItems, getCostItems } from "@/data/costItems";
import { typeProblems } from "@/data/chain";
import ArcoShell from "@/components/ArcoShell";
import { CostStory } from "@/components/Chain";

export default function ChainMap() {
  useCatalog();
  useCostItems();
  const [onlyTodo, setOnlyTodo] = useState(false);
  const items = getCostItems();
  const cats = getCats();

  const rows = cats.flatMap((c) =>
    c.types.map((t) => ({ cat: c.name, type: t, problems: typeProblems(t, items) })),
  );
  const shown = onlyTodo ? rows.filter((r) => r.problems.length) : rows;
  const totalBills = rows.reduce((s, r) => s + r.type.costItems.length, 0);
  const totalProblems = rows.reduce((s, r) => s + r.problems.length, 0);
  const productsWithTodo = rows.filter((r) => r.problems.length).length;

  return (
    <ArcoShell breadcrumb="资源中心 / 成本怎么算">
      <main className="space-y-4 p-6">
        {/* 页头：一句话说清这页是干嘛的 */}
        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-3">
          <div className="text-sm font-semibold text-[#1D2129]">产品的成本是怎么算出来的？</div>
          <div className="mt-1 text-xs leading-5 text-[#86909C]">
            每卖出 1 件产品，系统都会按下面的清单一笔一笔算账：从哪个资源里挑、按什么公式算、算出的钱归到哪本账。
            全部配好的产品打绿色勾勾；没配好的会写明缺什么，点一下就能跳过去补。
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
            <span className="text-[#4E5969]">在卖 <strong className="font-mono">{rows.length}</strong> 个产品</span>
            <span className="text-[#4E5969]">共 <strong className="font-mono">{totalBills}</strong> 笔账</span>
            {totalProblems ? (
              <span className="text-[#F53F3F]">
                <strong className="font-mono">{productsWithTodo}</strong> 个产品有 <strong className="font-mono">{totalProblems}</strong> 件事没配好（开单时算不出来）
              </span>
            ) : (
              <span className="text-[#00B42A]">✓ 全部配好了</span>
            )}
            <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[#4E5969]">
              <input type="checkbox" className="accent-[#165DFF]" checked={onlyTodo} onChange={(e) => setOnlyTodo(e.target.checked)} />
              只看没配好的
            </label>
          </div>
        </div>

        {/* 按产品类别分组的产品说明书 */}
        {cats.map((c) => {
          const list = shown.filter((r) => r.cat === c.name);
          if (!list.length) return null;
          return (
            <div key={c.name}>
              <div className="mb-2 text-xs font-semibold text-[#4E5969]">{c.name} · {list.length} 个产品</div>
              <div className="grid gap-3 xl:grid-cols-2">
                {list.map(({ type, problems }) => (
                  <div key={type.name} className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-3">
                    <div className="mb-2 flex items-center gap-2 border-b border-[#F2F3F5] pb-2">
                      <Link className="text-[13px] font-medium text-[#1D2129] hover:text-[#165DFF]"
                        to={`/product/specs?cat=${encodeURIComponent(c.name)}&type=${encodeURIComponent(type.name)}`}>
                        {type.name}
                      </Link>
                      {type.status === "停用" && <span className="rounded-[2px] bg-[#F2F3F5] px-1 text-[10px] text-[#86909C]">已下架</span>}
                      {problems.length ? (
                        <span className="rounded-[2px] bg-[#FFECE8] px-1.5 py-0.5 text-[10px] text-[#F53F3F]">{problems.length} 件事待办</span>
                      ) : (
                        <span className="text-[10px] text-[#00B42A]">✓ 算账配置齐全</span>
                      )}
                      <span className="ml-auto text-[10px] text-[#C9CDD4]">{type.costItems.length} 笔账</span>
                    </div>
                    <CostStory catName={c.name} typeName={type.name} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {!shown.length && (
          <div className="rounded-[4px] border border-[#E5E6EB] bg-white p-10 text-center text-sm text-[#86909C]">
            {onlyTodo ? "全部配好了，没有待办 ✅" : "暂无产品类型"}
          </div>
        )}
      </main>
    </ArcoShell>
  );
}
