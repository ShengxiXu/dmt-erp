-- 成本条目原型模型补全：算账去向（直接/间接）、算式、间接归集中心
ALTER TABLE cost_item
  ADD COLUMN settle_type  VARCHAR(8)   NULL DEFAULT '直接' COMMENT '算账去向：直接/间接（间接无自己的算式，金额出处=成本中心分法）' AFTER applies_to,
  ADD COLUMN formula      VARCHAR(255) NULL COMMENT '算式（变量与数字的 token 序列，如 带宽 × 40）' AFTER settle_type,
  ADD COLUMN cost_center  VARCHAR(32)  NULL COMMENT '间接费用归集成本中心 code' AFTER formula;

UPDATE cost_item SET settle_type = '直接' WHERE settle_type IS NULL;
