-- 变更测算（P05 正式版）：提交时按变更类型自动推导增量成本（审批依据），月结仍以实际账单为准
ALTER TABLE lc_change
  ADD COLUMN cost_delta DECIMAL(12,2) NULL COMMENT '月成本影响（增量成本测算）' AFTER monthly_fee_after,
  ADD COLUMN cost_basis VARCHAR(255)  NULL COMMENT '测算口径说明' AFTER cost_delta;
