-- 产品类型商务属性（原型 ProductTypes：SLA / 计费周期为类型级商务属性）
ALTER TABLE prd_product_type
  ADD COLUMN sla           VARCHAR(16) NULL COMMENT '默认 SLA 等级' AFTER remark,
  ADD COLUMN billing_cycle VARCHAR(16) NULL COMMENT '计费周期：月付/季付/年付/一次性' AFTER sla;
