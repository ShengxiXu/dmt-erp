-- R2 基础线路档案（原型 mat_base）：接入端线路，单客户专用，可跨产品共用不重复采购
CREATE TABLE res_base_line (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(32)  NOT NULL COMMENT '线路编码 B-xxx',
  name        VARCHAR(128) NOT NULL COMMENT '运营商-路由-带宽，见名知意',
  carrier     VARCHAR(16)  NULL COMMENT '电信/联通/移动/三方',
  bw_m        INT          NULL COMMENT '带宽(M)，描述用',
  billing     VARCHAR(16)  NULL DEFAULT '周期性（月）' COMMENT '周期性（月）/一次性买断',
  price       DECIMAL(12,2) NULL COMMENT '整条月租/买断价(元)',
  contract_no VARCHAR(32)  NULL COMMENT '关联采购合同编码（无合同可手工填入留痕）',
  shareable   VARCHAR(4)   NULL DEFAULT '否' COMMENT '可共用标记：跨产品共用本线时共用行计 0',
  effect      DATE         NULL COMMENT '生效日期',
  status      VARCHAR(16)  NOT NULL DEFAULT '生效' COMMENT '草稿/生效/停用',
  created_by  BIGINT       NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by  BIGINT       NULL,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted     TINYINT      NOT NULL DEFAULT 0,
  version     INT          NOT NULL DEFAULT 0,
  UNIQUE KEY uk_base_line_code (code)
) COMMENT 'R2 基础线路档案';

INSERT INTO res_base_line (code, name, carrier, bw_m, billing, price, contract_no, shareable, effect, status) VALUES
  ('B-001', '电信-CN2GIA-客户侧↔漕河泾机房-100M', '电信', 100,   '周期性（月）', 1000.00, 'CT-2026-063', '是', '2026-01-01', '生效'),
  ('B-002', '联通-169-客户侧↔漕河泾机房-200M',    '联通', 200,   '周期性（月）', 1600.00, 'CU-2026-042', '是', '2025-12-01', '生效'),
  ('B-003', '移动-CMNET-客户侧↔漕河泾机房-100M',  '移动', 100,   '周期性（月）', 700.00,  'CM-2026-015', '是', '2026-06-01', '生效'),
  ('B-201', '电信-上海↔北京-OTN波道10G（含两端）', '电信', 10000, '周期性（月）', 6000.00, 'OT-2026-009', '是', '2026-03-01', '生效'),
  ('B-202', '电信-上海↔广州-OTN波道10G（含两端）', '电信', 10000, '周期性（月）', 5200.00, 'OT-2026-015', '是', '2026-05-01', '生效');
