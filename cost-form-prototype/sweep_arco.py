# -*- coding: utf-8 -*-
"""旧 Tailwind 令牌 → Arco 设计令牌 清扫（Workbench/ArcoShell 已完成，跳过）"""
import re, io, os

ROOT = os.path.dirname(os.path.abspath(__file__))
FILES = [
    "src/pages/Home.tsx", "src/pages/CostList.tsx", "src/pages/Approval.tsx",
    "src/pages/DeliveryList.tsx", "src/pages/DeliveryDetail.tsx",
    "src/pages/Resources.tsx", "src/components/SearchSelect.tsx",
]

# (正则, 替换) —— 长的、含斜杠的类先替换
RULES = [
    (r"hover:bg-blue-50/50", "hover:bg-[#F7F8FA]"),
    (r"bg-blue-50/60", "bg-[#E8F3FF]"),
    (r"bg-blue-50/50", "bg-[#E8F3FF]"),
    (r"bg-blue-50/40", "bg-[#E8F3FF]"),
    (r"bg-amber-50/60", "bg-[#FFF7E8]"),
    (r"bg-amber-50/50", "bg-[#FFF7E8]"),
    (r"bg-green-50/50", "bg-[#E8F8F2]"),
    (r"bg-red-50/50", "bg-[#FFECE8]"),
    (r"hover:bg-gray-50/60", "hover:bg-[#F7F8FA]"),
    (r"bg-sky-100 text-sky-700", "bg-[#E8F3FF] text-[#165DFF]"),
    (r"bg-indigo-100 text-indigo-700", "bg-[#E8F3FF] text-[#165DFF]"),
    (r"bg-indigo-50 text-indigo-600", "bg-[#E8F3FF] text-[#165DFF]"),
    (r"bg-purple-100 text-purple-700", "bg-[#E8F3FF] text-[#165DFF]"),
    (r"bg-amber-100 text-amber-700", "bg-[#FFF3E8] text-[#FF7D00]"),
    (r"bg-green-100 text-green-700", "bg-[#E8F8F2] text-[#00B42A]"),
    (r"bg-green-50 text-green-700", "bg-[#E8F8F2] text-[#00B42A]"),
    (r"bg-green-50 text-green-600", "bg-[#E8F8F2] text-[#00B42A]"),
    (r"bg-red-100 text-red-600", "bg-[#FFECE8] text-[#F53F3F]"),
    (r"bg-red-50 text-red-600", "bg-[#FFECE8] text-[#F53F3F]"),
    (r"bg-emerald-100 text-emerald-700", "bg-[#E8F8F2] text-[#00B42A]"),
    (r"bg-cyan-50 text-cyan-600", "bg-[#E8FFFB] text-[#0FC6C2]"),
    (r"bg-orange-100 text-orange-700", "bg-[#FFF3E8] text-[#FF7D00]"),
    (r"bg-orange-50 text-orange-600", "bg-[#FFF7E8] text-[#FF7D00]"),
    (r"bg-blue-100 text-blue-700", "bg-[#BEDAFF] text-[#165DFF]"),
    (r"bg-blue-100 text-blue-600", "bg-[#BEDAFF] text-[#165DFF]"),
    (r"hover:bg-blue-600", "hover:bg-[#0E42D2]"),
    (r"hover:bg-green-100", "hover:bg-[#A9E8CD]"),
    (r"hover:bg-gray-100", "hover:bg-[#F2F3F5]"),
    (r"hover:bg-blue-50", "hover:bg-[#F7F8FA]"),
    (r"hover:text-red-500", "hover:text-[#F53F3F]"),
    (r"hover:text-blue-600", "hover:text-[#165DFF]"),
    (r"focus:border-blue-500", "focus:border-[#165DFF]"),
    (r"bg-slate-100", "bg-[#F7F8FA]"),
    (r"bg-slate-50", "bg-[#F7F8FA]"),
    (r"bg-gray-50", "bg-[#F7F8FA]"),
    (r"bg-gray-100", "bg-[#F2F3F5]"),
    (r"bg-gray-200", "bg-[#E5E6EB]"),
    (r"bg-blue-600", "bg-[#165DFF]"),
    (r"bg-blue-500", "bg-[#165DFF]"),
    (r"bg-blue-50", "bg-[#E8F3FF]"),
    (r"bg-blue-100", "bg-[#BEDAFF]"),
    (r"bg-green-500", "bg-[#00B42A]"),
    (r"bg-green-400", "bg-[#00B42A]"),
    (r"bg-green-300", "bg-[#00B42A]"),
    (r"bg-green-50", "bg-[#E8F8F2]"),
    (r"bg-red-50", "bg-[#FFECE8]"),
    (r"bg-amber-50", "bg-[#FFF7E8]"),
    (r"bg-indigo-400", "bg-[#4080FF]"),
    (r"bg-orange-400", "bg-[#FF7D00]"),
    (r"text-blue-800", "text-[#0E42D2]"),
    (r"text-blue-700", "text-[#165DFF]"),
    (r"text-blue-600", "text-[#165DFF]"),
    (r"text-blue-500", "text-[#165DFF]"),
    (r"text-indigo-600", "text-[#165DFF]"),
    (r"text-purple-500", "text-[#165DFF]"),
    (r"text-purple-700", "text-[#165DFF]"),
    (r"text-emerald-700", "text-[#00B42A]"),
    (r"text-green-700", "text-[#00B42A]"),
    (r"text-green-600", "text-[#00B42A]"),
    (r"text-red-700", "text-[#F53F3F]"),
    (r"text-red-600", "text-[#F53F3F]"),
    (r"text-red-500", "text-[#F53F3F]"),
    (r"text-amber-800", "text-[#D25F00]"),
    (r"text-amber-700", "text-[#FF7D00]"),
    (r"text-amber-600", "text-[#FF7D00]"),
    (r"text-gray-900", "text-[#1D2129]"),
    (r"text-gray-800", "text-[#1D2129]"),
    (r"text-gray-700", "text-[#4E5969]"),
    (r"text-gray-600", "text-[#4E5969]"),
    (r"text-gray-500", "text-[#4E5969]"),
    (r"text-gray-400", "text-[#86909C]"),
    (r"text-gray-300", "text-[#C9CDD4]"),
    (r"border-blue-300", "border-[#94BFFF]"),
    (r"border-blue-200", "border-[#BEDAFF]"),
    (r"border-blue-500", "border-[#165DFF]"),
    (r"border-green-300", "border-[#7BD9A8]"),
    (r"border-red-300", "border-[#FBACA3]"),
    (r"border-red-200", "border-[#FBACA3]"),
    (r"border-amber-300", "border-[#FFCF8B]"),
    (r"border-amber-200", "border-[#FFCF8B]"),
    (r"border-orange-300", "border-[#FFCF8B]"),
    (r"border-gray-300", "border-[#E5E6EB]"),
    (r"border-gray-200", "border-[#E5E6EB]"),
    (r"border-gray-100", "border-[#F2F3F5]"),
    (r"divide-gray-300", "divide-[#E5E6EB]"),
    (r"shadow-sm", ""),
    (r"rounded-md", "rounded-[2px]"),
    (r"rounded-lg", "rounded-[4px]"),
    (r"\brounded\b", "rounded-[2px]"),
]

for rel in FILES:
    p = os.path.join(ROOT, rel)
    s = io.open(p, encoding="utf-8").read()
    n0 = len(s)
    for pat, rep in RULES:
        s = re.sub(pat, rep, s)
    # 清理影子替换留下的多余空格
    s = re.sub(r" {2,}(?=[\"'])", "", s)
    s = re.sub(r"\s+>", ">", s)
    s = re.sub(r"className=\"\s*", 'className="', s)
    io.open(p, "w", encoding="utf-8").write(s)
    print(f"{rel}: {n0} -> {len(s)} bytes")
print("done")
