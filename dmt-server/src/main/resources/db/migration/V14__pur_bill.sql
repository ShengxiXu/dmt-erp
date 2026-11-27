-- 供应商账单：采购侧真实支出凭证，成本中心月费用的真实水位来源
-- 关联链路：账单（费用归类=成本条目）→ 核算单按归属引用 → 月结按中心汇总对比核算预估
CREATE TABLE pur_bill (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  bill_no      VARCHAR(32)  NOT NULL,
  supplier     VARCHAR(64)  NOT NULL,
  period       VARCHAR(7)   NOT NULL COMMENT '账期 YYYY-MM',
  cost_item_id BIGINT       NULL COMMENT '费用归类 → 成本条目（决定直接/间接口径）',
  amount       DECIMAL(12,2) NOT NULL,
  po_no        VARCHAR(32)  NULL COMMENT '关联采购单号（一次性类）',
  contract_no  VARCHAR(32)  NULL COMMENT '关联采购合同号（周期性月租类）',
  res_ref      VARCHAR(32)  NULL COMMENT '关联资源档案（可空）',
  status       VARCHAR(16)  NOT NULL DEFAULT '待入账' COMMENT '待入账/已入账/已月结/已作废',
  tag          VARCHAR(8)   NULL COMMENT '核对标签：差异/争议',
  pay_due_date DATE         NULL COMMENT '付款到期日（超期未付提醒锚点）',
  note         VARCHAR(255) NULL,
  created_by   BIGINT       NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by   BIGINT       NULL,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted      TINYINT      NOT NULL DEFAULT 0,
  version      INT          NOT NULL DEFAULT 0,
  UNIQUE KEY uk_pur_bill_no (bill_no)
) COMMENT '供应商账单';

INSERT INTO pur_bill (bill_no, supplier, period, cost_item_id, amount, po_no, contract_no, res_ref, status, pay_due_date, note) VALUES
  ('HY-2026-1013', '上海电信',         '2026-10', 2, 500.00,    'PO-2026-028', NULL,           'B-001',  '已入账', '2026-11-15', NULL),
  ('HY-2026-1014', '上海电信',         '2026-10', 2, 45000.00,  NULL,          'CT-2026-018',  'E-CT-1', '已入账', '2026-11-10', 'BGP 电信出口月租，并入出口池按已售带宽计收'),
  ('HY-2026-1015', '中国电信长途传输', '2026-10', 2, 6800.00,   'PO-2026-029', NULL,           'B-201',  '已入账', '2026-10-28', NULL),
  ('HY-2026-1016', 'APNIC 代管服务商', '2026-10', 3, 12480.00,  NULL,          NULL,           NULL,     '已入账', '2026-11-01', 'C 段地址年费摊月'),
  ('HY-2026-1017', '漕河泾机房物业',   '2026-10', 2, 6400.00,   NULL,          NULL,           NULL,     '已入账', '2026-11-20', '10G 上联端口月租'),
  ('HY-2026-1018', '漕河泾机房物业',   '2026-10', 2, 12800.00,  NULL,          NULL,           NULL,     '待入账', '2026-11-20', '整柜电力月租，待核对');
