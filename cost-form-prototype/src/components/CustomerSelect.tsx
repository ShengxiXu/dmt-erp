// 客户选择器：从客户档案搜索选择（特批申请 / 合同起草共用），不允许手动录入新客
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { CUSTOMERS } from "@/data/customers";
import { Input } from "@/components/ui/input";

export default function CustomerSelect({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [kw, setKw] = useState("");
  const [open, setOpen] = useState(false);
  const list = CUSTOMERS.filter((c) => !kw || c.name.includes(kw));
  const current = CUSTOMERS.find((c) => c.name === value);
  const ref = useRef<HTMLDivElement>(null);
  // 弹层 fixed 定位锚定输入框：不随页面滚动漂移
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const place = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  };
  useEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {value ? (
        <div className="flex items-center justify-between rounded-[2px] border border-[#E5E6EB] bg-[#F7F8FA] px-2 py-1.5 text-sm">
          <span><span className="font-medium text-[#1D2129]">{value}</span>{current && <span className="ml-2 text-xs text-[#86909C]">{current.id} · 归属 {current.sales}</span>}</span>
          <button className="text-xs text-[#86909C] hover:text-[#F53F3F]" onClick={() => { onChange(""); setKw(""); }}>✕</button>
        </div>
      ) : (
        <div>
          <Input placeholder="搜索客户档案…（仅可选择，新客户请先到客户档案维护）" value={kw}
            onFocus={() => setOpen(true)} onChange={(e) => { setKw(e.target.value); setOpen(true); }} />
          {open && pos && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="fixed z-20 max-h-52 overflow-y-auto rounded-[4px] border border-[#E5E6EB] bg-white shadow-lg"
                style={{ top: pos.top, left: pos.left, width: pos.width }}>
                {list.map((c) => (
                  <button key={c.id} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#F7F8FA]"
                    onClick={() => { onChange(c.name); setOpen(false); setKw(""); }}>
                    <span><span className="font-medium text-[#1D2129]">{c.name}</span><span className="ml-2 text-xs text-[#86909C]">{c.industry} · {c.status}</span></span>
                    <span className="font-mono text-[10px] text-[#C9CDD4]">{c.id}</span>
                  </button>
                ))}
                {!list.length && <div className="px-3 py-3 text-xs text-[#86909C]">无匹配客户</div>}
                <Link to="/customer" className="block border-t px-3 py-2 text-xs text-[#165DFF] hover:bg-[#F7FAFF]">＋ 到客户档案新建客户 →</Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
