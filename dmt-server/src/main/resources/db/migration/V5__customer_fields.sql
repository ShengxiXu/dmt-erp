-- V5：客户主数据补齐原型字段（办公地址三级联动 / 开票信息 / 联系人职务 / 邮箱 / 备注）
ALTER TABLE mdm_customer
  ADD COLUMN address       VARCHAR(255) NULL COMMENT '办公地址（省市区+详细）' AFTER source,
  ADD COLUMN invoice_title VARCHAR(128) NULL COMMENT '开票抬头（默认同客户名称）' AFTER address,
  ADD COLUMN tax_no        VARCHAR(64)  NULL COMMENT '开票税号' AFTER invoice_title,
  ADD COLUMN contact_title VARCHAR(64)  NULL COMMENT '联系人职务' AFTER contact_phone,
  ADD COLUMN email         VARCHAR(128) NULL AFTER contact_title,
  ADD COLUMN remark        VARCHAR(512) NULL AFTER email;
