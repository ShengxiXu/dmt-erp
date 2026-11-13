// 合同到期徽标：通用提醒组件（合同列表 / 客户档案 / 客户 360° 视图共用）
// 口径：已生效合同距到期 ≤90 天显示徽标；逾期（<0 天）红色「已逾期」；≤30 天红色；其余橙色
export default function ExpiryBadge({ days, showDays = true }: { days: number; showDays?: boolean }) {
  if (days > 90) return null;
  if (days < 0) return (
    <span className="ml-1.5 whitespace-nowrap rounded-[2px] bg-[#FFECE8] px-1 py-0.5 text-[10px] font-medium text-[#F53F3F]">
      已逾期 {-days} 天
    </span>
  );
  return (
    <span className={`ml-1.5 whitespace-nowrap rounded-[2px] px-1 py-0.5 text-[10px] ${days <= 30 ? "bg-[#FFECE8] font-medium text-[#F53F3F]" : "bg-[#FFF3E8] text-[#FF7D00]"}`}>
      {showDays ? `剩 ${days} 天` : "临期"}
    </span>
  );
}
