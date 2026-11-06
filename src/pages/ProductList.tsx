// 产品定义 · 第 1 级：产品类别（/product）
// 三级下钻：产品类别（本页）→ 产品类型（/product/types?cat=）→ 规格字段（/product/specs?cat=&type=）
// 每页只维护一个概念；新增/编辑一律走居中弹窗（CenterModal）
import { useState } from "react";
import { useNavigate } from "react-router";
import { useCatalog, getCats, addCat, removeCat } from "@/data/products";
import ArcoShell from "@/components/ArcoShell";
import CenterModal from "@/components/CenterModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ProductList() {
  useCatalog();
  const navigate = useNavigate();
  const cats = getCats();
  const [kw, setKw] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const shown = cats.filter((c) => !kw || c.name.includes(kw));

  const submit = () => {
    const n = name.trim();
    if (!n) return alert("请填写类别名称");
    if (addCat(n)) {
      setCreating(false);
      setName("");
      navigate(`/product/types?cat=${encodeURIComponent(n)}`);
    } else alert("类别已存在");
  };

  return (
    <ArcoShell breadcrumb="产品定义 / 产品类别">
      <main className="space-y-4 p-6">
        <div className="flex items-center justify-between rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#1D2129]">产品类别</span>
            <Input className="w-56" placeholder="搜索类别" value={kw} onChange={(e) => setKw(e.target.value)} />
          </div>
          <Button size="sm" onClick={() => { setName(""); setCreating(true); }}>＋ 新增类别</Button>
        </div>

        <div className="overflow-x-auto rounded-[4px] border border-[#E5E6EB] bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-[#F7F8FA] text-left text-[#4E5969]">
                <th className="px-3 py-2">产品类别</th><th className="px-3 py-2">产品类型数</th>
                <th className="px-3 py-2">产品类型</th><th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.name} className="cursor-pointer border-b last:border-0 hover:bg-[#F7F8FA]"
                  onClick={() => navigate(`/product/types?cat=${encodeURIComponent(c.name)}`)}>
                  <td className="px-3 py-2.5 font-medium text-[#1D2129]">{c.name}</td>
                  <td className="px-3 py-2.5 font-mono text-[#4E5969]">{c.types.length}</td>
                  <td className="max-w-[380px] truncate px-3 py-2.5 text-[#86909C]">{c.types.map((t) => t.name).join("、") || "—"}</td>
                  <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button className="mr-2 rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#4E5969] hover:border-[#165DFF] hover:text-[#165DFF]"
                      onClick={() => navigate(`/product/types?cat=${encodeURIComponent(c.name)}`)}>查看类型</button>
                    {cats.length > 1 && (
                      <button className="rounded-[2px] border border-[#E5E6EB] px-2 py-0.5 text-[11px] text-[#F53F3F] hover:border-[#F53F3F]"
                        onClick={() => {
                          if (window.confirm(`删除类别「${c.name}」及其全部产品类型与规格字段？已有合同不受影响（存的是文本快照）。`)) removeCat(c.name);
                        }}>删除</button>
                    )}
                  </td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={4} className="px-3 py-10 text-center text-[#86909C]">暂无匹配类别</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="rounded-[4px] border border-[#E5E6EB] bg-white px-4 py-2.5 text-[11px] leading-5 text-[#86909C]">
          产品定义分三级维护：产品类别 → 产品类型 → 规格字段。点击类别行进入该产品类型的列表；规格字段挂在产品类型上，合同订单行按「类别 + 类型」实时读取对应模板，规格摘要只由结构化选项拼接、不允许自由输入。
        </div>
      </main>

      {creating && (
        <CenterModal title="新增产品类别" onClose={() => setCreating(false)} width={420}>
          <div className="space-y-3">
            <div>
              <div className="mb-0.5 text-xs text-[#4E5969]">类别名称 <span className="text-[#F53F3F]">*</span></div>
              <Input autoFocus placeholder="如：ISP 互联网接入" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
            </div>
            <div className="flex justify-end gap-2 border-t border-[#F2F3F5] pt-3">
              <Button variant="outline" size="sm" onClick={() => setCreating(false)}>取消</Button>
              <Button size="sm" onClick={submit}>创建并添加类型</Button>
            </div>
          </div>
        </CenterModal>
      )}
    </ArcoShell>
  );
}
