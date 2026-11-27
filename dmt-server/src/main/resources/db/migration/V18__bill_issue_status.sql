-- 出账审核状态机（P03-4 定版）：正常账单自动发出，例外（手工单/环比超阈）进人工审核
-- issue_status：已生成/审核中/已发出/已驳回；已发出才进应收（认领/账龄统计口径）
ALTER TABLE fin_bill
  ADD COLUMN issue_status VARCHAR(16) NOT NULL DEFAULT '已发出' COMMENT '出账状态：已生成/审核中/已发出/已驳回' AFTER status,
  ADD COLUMN issued_at    DATETIME    NULL COMMENT '发出时间' AFTER issue_status,
  ADD COLUMN review_note  VARCHAR(255) NULL COMMENT '审核意见（驳回原因）' AFTER issued_at;

-- 存量账单视为已发出
UPDATE fin_bill SET issued_at = created_at WHERE issued_at IS NULL;
