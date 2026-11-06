// 资源侧「被引用列表」（Related List）：本档案被哪些成本条目取数、这些条目被哪些产品类型装配
// 默认折叠，点击标题展开（《核算链路设计 v1.0》8.2）
import { useState } from "react";
import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { useCatalog, getCats } from "@/data/products";
import { useCostItems, getCostItems } from "@/data/costItems";
import { archiveReferences } from "@/data/chain";
import { CC_NAME } from "@/data/costCenters";

export default function RelatedList({ archiveKey }: { archiveKey: string }) {
  useCatalog();
  useCostItems();
  const [open, setOpen] = useState(false);
  const refs = archiveReferences(archiveKey, getCostItems(), getCats());
  return (
    <div className="rounded-[2px] border border-[#E5E6EB]">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs font-semibold text-[#4E5969] hover:bg-[#F7F8FA]">
        <ChevronRight size={13} className={`text-[#C9CDD4] transition-transform ${open ? "rotate-90" : ""}`} />
        被引用
        <span className="font-normal text-[#86909C]">哪些账从本档案取数</span>
        <span className="ml-auto rounded-[2px] bg-[#F2F3F5] px-1.5 text-[10px] text-[#4E5969]">{refs.length} 笔</span>
      </button>
      {open && (refs.length === 0 ? (
        <div className="border-t border-[#F2F3F5] px-3 py-2.5 text-[11px] text-[#C9CDD4]">暂无成本条目从本档案取数</div>
      ) : (
        <ul className="divide-y divide-[#F7F8FA] border-t border-[#F2F3F5]">
          {refs.map(({ item, products }) => (
            <li key={item.key} className="px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <Link to="/cost-items" className="font-medium text-[#165DFF] hover:underline">{item.name}</Link>
                <span className="text-[#C9CDD4]">{item.settleType === "间接" ? "金额由成本中心统一算" : `按「${item.formula ?? "未设公式"}」`}</span>
                <span className="text-[#C9CDD4]">→ {item.settleType === "间接" ? `归集到 ${CC_NAME(item.costCenter) || "未选成本中心"}` : "随单直接成本"}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {products.length === 0 && <span className="text-[10px] text-[#FF7D00]">尚无产品类型装配（条目未投入使用）</span>}
                {products.map((p) => (
                  <Link key={p.type} to={`/product/specs?cat=${encodeURIComponent(p.cat)}&type=${encodeURIComponent(p.type)}`}
                    className="rounded-[2px] bg-[#F2F3F5] px-1.5 py-0.5 text-[10px] text-[#4E5969] hover:bg-[#E8F3FF] hover:text-[#165DFF]">
                    {p.cat} / {p.type}
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
