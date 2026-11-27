-- 把两个裁剪项做实：
-- ① 核算行来源单号（供应商账单「被引用」链路：账单 → 核算单引用 → 合同）
-- ② 工单要求完成时间与负责人（台账临期列与统计卡）
ALTER TABLE cost_sheet_line
  ADD COLUMN source_no VARCHAR(32) NULL COMMENT '来源单号（供应商账单号，按归属引用）' AFTER pick_spec;

ALTER TABLE wo_work_order
  ADD COLUMN deadline DATE        NULL COMMENT '要求完成时间（默认建单 +7 天）' AFTER delivery_snapshot,
  ADD COLUMN owner    VARCHAR(32) NULL COMMENT '负责人' AFTER deadline;

UPDATE wo_work_order SET deadline = DATE_ADD(DATE(created_at), INTERVAL 7 DAY) WHERE deadline IS NULL;
