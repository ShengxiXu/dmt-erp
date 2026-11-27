-- 资源清单原型模型落地：
-- ① 成本条目「适用资源」（mat_key）：资源驱动条目的取数来源，产品组成 → 条目自动推导的锚点
-- ② 产品类型：勾选用到的成本中心（间接归集）+ 被剔除的直接条目 + 清单版本与历史（保存自动 +1）
ALTER TABLE cost_item
  ADD COLUMN applies_to VARCHAR(32) NULL COMMENT '适用资源（prd_material.mat_key）' AFTER calc_kind;

ALTER TABLE prd_product_type
  ADD COLUMN centers_json     VARCHAR(512) NULL COMMENT '勾选用到的成本中心 code 数组' AFTER plans_json,
  ADD COLUMN direct_off_json  VARCHAR(512) NULL COMMENT '被剔除的直接成本条目 key 数组' AFTER centers_json,
  ADD COLUMN asm_version      INT NOT NULL DEFAULT 1 COMMENT '清单版本（保存自动 +1）' AFTER direct_off_json,
  ADD COLUMN asm_history_json TEXT NULL COMMENT '版本历史 [{ver,at,by}]' AFTER asm_version;

-- 存量条目补适用资源（与资源目录 mat_key 对应）
UPDATE cost_item SET applies_to = 'mat_dev'  WHERE item_key = 'cpe_device';
UPDATE cost_item SET applies_to = 'mat_exit' WHERE item_key = 'exit_bandwidth';
UPDATE cost_item SET applies_to = 'mat_ip'   WHERE item_key = 'ip_fee';
UPDATE cost_item SET applies_to = 'mat_svc'  WHERE item_key = 'install_labor';
