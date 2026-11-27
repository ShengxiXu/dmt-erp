-- 资源类「实例档案入口」：该类资源对应资源中心哪个档案页（R0-R4），替代前端硬编码映射
ALTER TABLE prd_material
  ADD COLUMN archive_key VARCHAR(8) NULL COMMENT '实例档案入口：R0/R1/R2/R3/R4，空=无档案' AFTER group_name;

UPDATE prd_material SET archive_key = 'R0' WHERE mat_key = 'mat_pool';
UPDATE prd_material SET archive_key = 'R1' WHERE mat_key = 'mat_exit';
UPDATE prd_material SET archive_key = 'R2' WHERE mat_key = 'mat_base';
UPDATE prd_material SET archive_key = 'R3' WHERE mat_key = 'mat_ip';
UPDATE prd_material SET archive_key = 'R4' WHERE mat_key = 'mat_dev';
