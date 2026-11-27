-- 成本条目状态口径统一为原型「生效/停用」（种子原为「启用」，导致生效统计与筛选失真）
UPDATE cost_item SET status = '生效' WHERE status = '启用';
