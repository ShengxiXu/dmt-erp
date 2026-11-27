-- 坏账申请（P04-9 / P10 审批）：通过 → 账单置「坏账」→ 关联合同在网订阅自动发起退订（原因=欠费坏账）
CREATE TABLE fin_bad_debt (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  bd_no       VARCHAR(32)  NOT NULL,
  bill_id     BIGINT       NOT NULL,
  bill_no     VARCHAR(32)  NULL,
  customer    VARCHAR(64)  NULL,
  amount      DECIMAL(12,2) NOT NULL,
  reason      VARCHAR(255) NOT NULL COMMENT '坏账原因',
  handling    VARCHAR(16)  NOT NULL DEFAULT '核销坏账' COMMENT '核销坏账/继续挂账观察',
  status      VARCHAR(16)  NOT NULL DEFAULT '审批中' COMMENT '审批中/已通过/已驳回',
  reject_note VARCHAR(255) NULL,
  created_by  BIGINT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by  BIGINT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted     TINYINT NOT NULL DEFAULT 0,
  version     INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_bad_debt_no (bd_no)
) COMMENT '坏账申请';

INSERT INTO apr_flow_def (id, name, doc_type, trigger_action, condition_expr, enabled) VALUES
  (9, '坏账审批', '坏账申请', '提交', NULL, 1);
INSERT INTO apr_flow_node (flow_id, seq, name, approver_type, approver_ref) VALUES
  (9, 1, '管理层审批', 'ROLE', 'MANAGER');
