-- 到期拆机·商机确认（P06 → 商机联动）：回收完工后退订单进入「待确认」，销售确认有后续（录商机）或无后续（登记原因留痕）
ALTER TABLE lc_terminate
  ADD COLUMN follow_status VARCHAR(16)  NULL COMMENT '后续商机确认：待确认/有后续/无后续' AFTER recover_note,
  ADD COLUMN follow_note   VARCHAR(255) NULL COMMENT '无后续原因 / 后续商机备注' AFTER follow_status;

UPDATE lc_terminate SET follow_status = '待确认' WHERE recover_status = '已完工';
