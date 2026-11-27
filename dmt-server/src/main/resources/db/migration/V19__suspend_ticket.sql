-- 停机复机工单（P04-7/8）：欠费行生成停机工单 → 网络侧执行 → 订阅欠停；
-- 复机仅由足额收讫自动触发（生成复机工单），不接受人工手工复机
CREATE TABLE fin_suspend_ticket (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  ticket_no    VARCHAR(32)  NOT NULL,
  type         VARCHAR(8)   NOT NULL COMMENT '停机/复机',
  bill_id      BIGINT       NULL,
  bill_no      VARCHAR(32)  NULL,
  customer     VARCHAR(64)  NULL,
  contract_id  BIGINT       NULL,
  debt_summary VARCHAR(128) NULL COMMENT '欠费摘要',
  reason       VARCHAR(255) NULL,
  status       VARCHAR(8)   NOT NULL DEFAULT '待执行' COMMENT '待执行/已执行',
  action       VARCHAR(32)  NULL COMMENT '执行动作：断网/端口 shutdown/整机下架/恢复网络…',
  result       VARCHAR(8)   NULL COMMENT '成功/部分成功/失败',
  note         VARCHAR(255) NULL,
  executed_at  DATETIME     NULL,
  created_by   BIGINT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by   BIGINT NULL,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted      TINYINT NOT NULL DEFAULT 0,
  version      INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_suspend_ticket_no (ticket_no)
) COMMENT '停机复机工单';
