-- V6：商机补齐原型字段（来源渠道 / 意向产品 JSON / 备注）
ALTER TABLE mdm_opportunity
  ADD COLUMN source        VARCHAR(32)  NULL COMMENT '来源渠道' AFTER stage,
  ADD COLUMN products_json JSON         NULL COMMENT '意向产品 [{cat,ptype}]' AFTER source,
  ADD COLUMN remark        VARCHAR(512) NULL AFTER products_json;
