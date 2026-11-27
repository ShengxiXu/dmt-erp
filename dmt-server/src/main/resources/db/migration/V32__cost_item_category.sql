-- 成本条目 ↔ 产品类别绑定：受控增补范围（设计说明 §6.5：增补仅限与本行产品类别有绑定关系的条目）
CREATE TABLE cost_item_category (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  item_key    VARCHAR(32) NOT NULL COMMENT '成本条目 key',
  cat         VARCHAR(32) NOT NULL COMMENT '可增补产品类别（prd_category.name）',
  created_by  BIGINT      NULL,
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by  BIGINT      NULL,
  updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted     TINYINT     NOT NULL DEFAULT 0,
  version     INT         NOT NULL DEFAULT 0,
  UNIQUE KEY uk_item_cat (item_key, cat)
) COMMENT '成本条目 ↔ 产品类别绑定（受控增补）';

-- 种子绑定：装维人工全类别可增补；设备限专线/组网；IP 限专线/增值；出口带宽限专线
INSERT INTO cost_item_category (item_key, cat) VALUES
  ('exit_bandwidth', '专线'),
  ('ip_fee', '专线'), ('ip_fee', '增值'),
  ('cpe_device', '专线'), ('cpe_device', '组网'),
  ('install_labor', '专线'), ('install_labor', '组网'), ('install_labor', '增值');
