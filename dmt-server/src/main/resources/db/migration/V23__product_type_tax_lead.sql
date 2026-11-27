-- 产品类型商务属性补全（原型编辑弹窗：税率 / 标准交付周期）
ALTER TABLE prd_product_type
  ADD COLUMN tax_rate  VARCHAR(8)  NULL COMMENT '税率（%）' AFTER billing_cycle,
  ADD COLUMN lead_time VARCHAR(16) NULL COMMENT '标准交付周期（个工作日）' AFTER tax_rate;
