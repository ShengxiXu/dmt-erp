-- 成本条目对齐原型：条目类别（数从哪来）、取数档案、填报要求、备注
ALTER TABLE cost_item
  ADD COLUMN category       VARCHAR(8)   NULL COMMENT '条目类别：资源驱动/手工录入（数从哪来）' AFTER name,
  ADD COLUMN source_archive VARCHAR(16)  NULL COMMENT '取数档案：r1/r2/r3/r4/resale（手工录入为空）' AFTER category,
  ADD COLUMN required_flag  VARCHAR(8)   NULL DEFAULT '按装配' COMMENT '填报要求：按装配=默认填报（可删可补回）/否=按需选配' AFTER subject,
  ADD COLUMN remark         VARCHAR(500) NULL COMMENT '备注（口径说明、例外处理）' AFTER required_flag;

-- 存量条目回填（与原型 SOURCE_TO_MAT 一致：r1→mat_exit r2→mat_base r3→mat_ip r4→mat_dev resale→mat_resale）
UPDATE cost_item SET category = '资源驱动', source_archive = 'r4' WHERE item_key = 'cpe_device';
UPDATE cost_item SET category = '资源驱动', source_archive = 'r1' WHERE item_key = 'exit_bandwidth';
UPDATE cost_item SET category = '资源驱动', source_archive = 'r3' WHERE item_key = 'ip_fee';
UPDATE cost_item SET category = '手工录入' WHERE item_key = 'install_labor';
UPDATE cost_item SET category = '手工录入' WHERE category IS NULL;
UPDATE cost_item SET required_flag = '按装配' WHERE required_flag IS NULL;
