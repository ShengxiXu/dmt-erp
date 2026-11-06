// 居中弹窗：替代右侧抽屉的全局新增/编辑/详情/确认交互
// 用法：<CenterModal title="…" sub="…" onClose={…} width={560}>表单内容</CenterModal>
import type { ReactNode } from "react";

export default function CenterModal({ title, sub, onClose, width = 560, maxH = "70vh", children }: { title: string; sub?: string; onClose: () => void; width?: number; maxH?: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10">
      <div className="fixed inset-0 bg-[#1D2129]/30" onClick={onClose} />
      <div className="relative w-full rounded-[6px] bg-white shadow-2xl" style={{ maxWidth: width, margin: "0 16px" }}>
        <div className="flex items-center justify-between border-b border-[#F2F3F5] px-5 py-3">
          <div>
            <span className="text-sm font-semibold text-[#1D2129]">{title}</span>
            {sub && <div className="mt-0.5 text-[11px] text-[#86909C]">{sub}</div>}
          </div>
          <button className="rounded-[2px] px-1.5 py-0.5 text-[#86909C] hover:bg-[#F2F3F5]" onClick={onClose}>✕</button>
        </div>
        <div className="overflow-y-auto p-5" style={{ maxHeight: maxH }}>{children}</div>
      </div>
    </div>
  );
}
