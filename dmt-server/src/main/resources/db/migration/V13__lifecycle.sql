-- 客户生命周期：订阅变更 / 退订与资源回收（P05/P06）
-- 订阅不单独建表：由「已生效合同行」推导（SUB-{contractId}-{lineId}），退订生效记录覆盖状态

CREATE TABLE lc_change (
  id                BIGINT AUTO_INCREMENT PRIMARY KEY,
  ch_no             VARCHAR(32)  NOT NULL,
  contract_id       BIGINT       NOT NULL,
  line_id           BIGINT       NOT NULL,
  customer          VARCHAR(64)  NULL,
  contract_no       VARCHAR(32)  NULL,
  type              VARCHAR(16)  NOT NULL COMMENT '套餐变更/带宽升级/带宽降级/增加IP/减少IP/地址迁移',
  from_val          VARCHAR(128) NULL COMMENT '变更前',
  to_val            VARCHAR(128) NULL COMMENT '变更后',
  monthly_fee_after DECIMAL(12,2) NULL COMMENT '生效后月租',
  effective         VARCHAR(7)   NULL COMMENT '生效账期 YYYY-MM',
  reason            VARCHAR(255) NULL,
  status            VARCHAR(16)  NOT NULL DEFAULT '审批中' COMMENT '审批中/已生效/已驳回',
  reject_note       VARCHAR(255) NULL,
  created_by        BIGINT       NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by        BIGINT       NULL,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted           TINYINT      NOT NULL DEFAULT 0,
  version           INT          NOT NULL DEFAULT 0,
  UNIQUE KEY uk_lc_change_no (ch_no)
) COMMENT '订阅变更申请';

CREATE TABLE lc_terminate (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  tm_no            VARCHAR(32)  NOT NULL,
  contract_id      BIGINT       NOT NULL,
  line_id          BIGINT       NOT NULL,
  customer         VARCHAR(64)  NULL,
  contract_no      VARCHAR(32)  NULL,
  reason           VARCHAR(16)  NOT NULL COMMENT '合同到期/客户主动/欠费坏账/其他',
  reason_text      VARCHAR(255) NULL,
  effective_period VARCHAR(7)   NULL COMMENT '退订生效账期：该账期起停止出账',
  penalty          DECIMAL(12,2) NULL COMMENT '违约金申请金额（一事一议，审批确定）',
  penalty_basis    VARCHAR(255) NULL COMMENT '参考试算口径说明',
  status           VARCHAR(16)  NOT NULL DEFAULT '审批中' COMMENT '审批中/退订生效/已驳回',
  reject_note      VARCHAR(255) NULL,
  recover_status   VARCHAR(16)  NULL COMMENT '退订生效后生成回收任务：待执行/已完工',
  recover_note     VARCHAR(255) NULL,
  executed_at      DATETIME     NULL,
  created_by       BIGINT       NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by       BIGINT       NULL,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted          TINYINT      NOT NULL DEFAULT 0,
  version          INT          NOT NULL DEFAULT 0,
  UNIQUE KEY uk_lc_terminate_no (tm_no)
) COMMENT '退订申请与资源回收';

-- 审批流：订阅变更 / 退订申请（业务支撑部一级）
INSERT INTO apr_flow_def (id, name, doc_type, trigger_action, condition_expr, enabled) VALUES
  (7, '订阅变更审批', '订阅变更', '提交', NULL, 1),
  (8, '退订审批',     '退订申请', '提交', NULL, 1);

INSERT INTO apr_flow_node (flow_id, seq, name, approver_type, approver_ref) VALUES
  (7, 1, '业务支撑部审批', 'ROLE', 'OPS'),
  (8, 1, '业务支撑部审批', 'ROLE', 'OPS');
