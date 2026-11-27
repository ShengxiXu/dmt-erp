-- =====================================================================
-- DMT-ERP 全量初始结构（契约 v0.2 §5 一次设计到位）
-- 说明：
--   1. P1 域（FIN/PUR）表结构随本版落地，业务功能开发排期后置，不再改历史迁移；
--   2. 所有业务表带审计四字段 + 逻辑删 deleted + 乐观锁 version；
--   3. 金额 DECIMAL(12,2)，带宽 INT(Mbps)，IP 个数 INT，比率 DECIMAL(5,2)；
--   4. 快照表（cost_sign_snapshot / fin_settle_record）语义只增不改，由应用层保证；
--   5. 在途唯一（商机在途合同/特批唯一）用生成列 active_opp_key + 唯一索引实现。
-- =====================================================================

SET NAMES utf8mb4;

-- =====================================================================
-- SYS 系统域
-- =====================================================================
CREATE TABLE sys_dept (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(64)  NOT NULL COMMENT '部门名称',
  parent_id    BIGINT       NULL COMMENT '上级部门',
  created_by   BIGINT       NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by   BIGINT       NULL,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted      TINYINT      NOT NULL DEFAULT 0,
  version      INT          NOT NULL DEFAULT 0
) ENGINE = InnoDB COMMENT ='部门';

CREATE TABLE sys_user (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(64)  NOT NULL COMMENT '登录名',
  password_hash VARCHAR(100) NOT NULL COMMENT 'BCrypt 哈希',
  name          VARCHAR(64)  NOT NULL COMMENT '姓名',
  mobile        VARCHAR(20)  NULL,
  dept_id       BIGINT       NULL COMMENT '所属部门',
  status        VARCHAR(16)  NOT NULL DEFAULT '启用' COMMENT '启用/停用',
  created_by    BIGINT       NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by    BIGINT       NULL,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted       TINYINT      NOT NULL DEFAULT 0,
  version       INT          NOT NULL DEFAULT 0,
  UNIQUE KEY uk_sys_user_username (username)
) ENGINE = InnoDB COMMENT ='用户';

CREATE TABLE sys_role (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(64) NOT NULL COMMENT '角色编码',
  name        VARCHAR(64) NOT NULL COMMENT '角色名称',
  data_scope  VARCHAR(8)  NOT NULL DEFAULT 'SELF' COMMENT '数据范围：ALL/DEPT/SELF',
  created_by  BIGINT      NULL,
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by  BIGINT      NULL,
  updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted     TINYINT     NOT NULL DEFAULT 0,
  version     INT         NOT NULL DEFAULT 0,
  UNIQUE KEY uk_sys_role_code (code)
) ENGINE = InnoDB COMMENT ='角色';

CREATE TABLE sys_user_role (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT NOT NULL,
  role_id    BIGINT NOT NULL,
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted    TINYINT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_sys_user_role (user_id, role_id)
) ENGINE = InnoDB COMMENT ='用户-角色';

CREATE TABLE sys_menu (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  parent_id  BIGINT      NULL,
  name       VARCHAR(64) NOT NULL COMMENT '菜单/按钮名称',
  perm_code  VARCHAR(64) NULL COMMENT '权限点编码',
  type       VARCHAR(8)  NOT NULL DEFAULT 'MENU' COMMENT 'MENU/BUTTON',
  path       VARCHAR(128) NULL,
  sort       INT         NOT NULL DEFAULT 0,
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted    TINYINT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0
) ENGINE = InnoDB COMMENT ='菜单与按钮权限';

CREATE TABLE sys_role_menu (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  role_id    BIGINT NOT NULL,
  menu_id    BIGINT NOT NULL,
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted    TINYINT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_sys_role_menu (role_id, menu_id)
) ENGINE = InnoDB COMMENT ='角色-权限';

CREATE TABLE sys_sms_code (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  mobile     VARCHAR(20) NOT NULL,
  code       VARCHAR(6)  NOT NULL,
  scene      VARCHAR(16) NOT NULL DEFAULT 'LOGIN' COMMENT '用途（LOGIN）',
  expire_at  DATETIME    NOT NULL COMMENT '过期时间（10 分钟）',
  used       TINYINT     NOT NULL DEFAULT 0 COMMENT '单次作废',
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted    TINYINT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0,
  KEY idx_sms_code_mobile (mobile, scene, created_at)
) ENGINE = InnoDB COMMENT ='短信验证码（第一期表存储，定时清理）';

CREATE TABLE sys_notification (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT       NOT NULL COMMENT '接收人',
  type       VARCHAR(32)  NULL,
  title      VARCHAR(128) NOT NULL,
  content    VARCHAR(1024) NULL,
  is_read    TINYINT      NOT NULL DEFAULT 0,
  ref_type   VARCHAR(32)  NULL,
  ref_id     BIGINT       NULL,
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted    TINYINT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0,
  KEY idx_notification_user (user_id, is_read)
) ENGINE = InnoDB COMMENT ='站内通知';

CREATE TABLE sys_config (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  cfg_key    VARCHAR(64)  NOT NULL,
  cfg_value  VARCHAR(512) NULL,
  remark     VARCHAR(256) NULL,
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted    TINYINT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_sys_config_key (cfg_key)
) ENGINE = InnoDB COMMENT ='参数设置';

-- 幂等键（契约 §3.4：提交类动作 24 小时内去重）
CREATE TABLE sys_idem_key (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  idem_key      VARCHAR(64) NOT NULL COMMENT '前端幂等键 UUID',
  user_id       BIGINT      NULL,
  endpoint      VARCHAR(128) NOT NULL,
  response_json JSON        NULL COMMENT '首次执行结果，重试直接返回',
  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_idem_key (idem_key, endpoint)
) ENGINE = InnoDB COMMENT ='幂等键';

-- =====================================================================
-- MDM 主数据域
-- =====================================================================
CREATE TABLE mdm_entity (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  short_name VARCHAR(64)  NOT NULL COMMENT '显示简称',
  full_name  VARCHAR(128) NOT NULL COMMENT '合同/开票抬头全称',
  nature     VARCHAR(16)  NOT NULL DEFAULT '法人公司' COMMENT '法人公司/分公司',
  tax_no     VARCHAR(64)  NULL COMMENT '统一社会信用代码（销方税号）',
  bank       VARCHAR(128) NULL COMMENT '收款开户行',
  account    VARCHAR(64)  NULL COMMENT '收款账号',
  status     VARCHAR(16)  NOT NULL DEFAULT '启用' COMMENT '启用/停用',
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted    TINYINT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0
) ENGINE = InnoDB COMMENT ='签约主体';

CREATE TABLE mdm_entity_seal (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  entity_id  BIGINT      NOT NULL,
  name       VARCHAR(128) NOT NULL,
  type       VARCHAR(16) NOT NULL COMMENT '公章/合同专用章/财务专用章/发票专用章',
  seal_no    VARCHAR(64) NULL COMMENT '实物章编号/电子章印模标识',
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted    TINYINT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0,
  KEY idx_entity_seal (entity_id)
) ENGINE = InnoDB COMMENT ='在册印章';

CREATE TABLE mdm_customer (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(128) NOT NULL,
  credit_code   VARCHAR(64)  NULL COMMENT '统一社会信用代码',
  level         VARCHAR(16)  NULL,
  industry      VARCHAR(64)  NULL,
  source        VARCHAR(64)  NULL,
  sales_id      BIGINT       NULL COMMENT '归属销售 → sys_user',
  contact       VARCHAR(64)  NULL,
  contact_phone VARCHAR(20)  NULL,
  status        VARCHAR(16)  NOT NULL DEFAULT '正常',
  created_by    BIGINT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by    BIGINT NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted       TINYINT NOT NULL DEFAULT 0,
  version       INT NOT NULL DEFAULT 0,
  KEY idx_customer_sales (sales_id)
) ENGINE = InnoDB COMMENT ='客户';

CREATE TABLE mdm_opportunity (
  id                BIGINT AUTO_INCREMENT PRIMARY KEY,
  code              VARCHAR(32)    NOT NULL,
  customer_id       BIGINT         NOT NULL,
  name              VARCHAR(128)   NOT NULL,
  stage             VARCHAR(16)    NOT NULL DEFAULT '跟进中' COMMENT '跟进中/已报价/赢单/输单',
  expect_amount     DECIMAL(12, 2) NULL,
  expect_months     INT            NULL,
  expected_close_at DATE           NULL,
  sales_id          BIGINT         NULL COMMENT '归属销售 → sys_user',
  created_by        BIGINT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by        BIGINT NULL,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted           TINYINT NOT NULL DEFAULT 0,
  version           INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_opp_code (code),
  KEY idx_opp_customer (customer_id),
  KEY idx_opp_sales (sales_id)
) ENGINE = InnoDB COMMENT ='商机';

CREATE TABLE mdm_special (
  id                BIGINT AUTO_INCREMENT PRIMARY KEY,
  code              VARCHAR(32)    NOT NULL,
  opportunity_id    BIGINT         NOT NULL COMMENT '必须挂商机',
  customer_id       BIGINT         NOT NULL,
  discount          DECIMAL(5, 2)  NOT NULL COMMENT '申请折扣率',
  expect_amount     DECIMAL(12, 2) NULL,
  reason            VARCHAR(512)   NULL,
  status            VARCHAR(16)    NOT NULL DEFAULT '审批中' COMMENT '审批中/已通过/已驳回',
  active_opp_key    VARCHAR(64) GENERATED ALWAYS AS (
    CASE WHEN status = '审批中' THEN CAST(opportunity_id AS CHAR) ELSE NULL END
  ) STORED COMMENT '在途生成列：审批中 = opportunity_id，否则 NULL',
  created_by        BIGINT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by        BIGINT NULL,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted           TINYINT NOT NULL DEFAULT 0,
  version           INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_special_code (code),
  UNIQUE KEY uk_special_active_opp (active_opp_key),
  KEY idx_special_customer (customer_id)
) ENGINE = InnoDB COMMENT ='特批申请单';

CREATE TABLE mdm_contract (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  code           VARCHAR(32)    NOT NULL,
  customer_id    BIGINT         NOT NULL,
  opportunity_id BIGINT         NOT NULL,
  special_id     BIGINT         NULL COMMENT '关联特批（折扣>0 时必须）',
  entity_id      BIGINT         NOT NULL COMMENT '签约主体 → mdm_entity',
  discount       DECIMAL(5, 2)  NOT NULL DEFAULT 0,
  pay_cycle      VARCHAR(16)    NULL COMMENT '账期',
  start_date     DATE           NULL,
  end_date       DATE           NULL,
  amount         DECIMAL(12, 2) NULL,
  status         VARCHAR(16)    NOT NULL DEFAULT '审批中' COMMENT '审批中/待出合同/待用章/签署中/已生效/已驳回/已终止/待修订',
  step           INT            NOT NULL DEFAULT 0 COMMENT '阶段序号',
  active_opp_key VARCHAR(64) GENERATED ALWAYS AS (
    CASE WHEN status IN ('审批中', '待出合同', '待用章', '签署中', '待修订')
         THEN CAST(opportunity_id AS CHAR) ELSE NULL END
  ) STORED COMMENT '在途生成列',
  created_by     BIGINT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by     BIGINT NULL,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted        TINYINT NOT NULL DEFAULT 0,
  version        INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_contract_code (code),
  UNIQUE KEY uk_contract_active_opp (active_opp_key),
  KEY idx_contract_customer (customer_id),
  KEY idx_contract_entity (entity_id)
) ENGINE = InnoDB COMMENT ='销售合同（系统内录入已签合同）';

CREATE TABLE mdm_contract_line (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  contract_id BIGINT         NOT NULL,
  cat         VARCHAR(32)    NOT NULL COMMENT '产品大类',
  ptype       VARCHAR(64)    NULL COMMENT '产品类型',
  spec        VARCHAR(256)   NULL COMMENT '规格描述',
  price       DECIMAL(12, 2) NULL,
  specs_json  JSON           NULL COMMENT '带宽/IP 需求/基础线路数量等弹性字段',
  created_by  BIGINT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by  BIGINT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted     TINYINT NOT NULL DEFAULT 0,
  version     INT NOT NULL DEFAULT 0,
  KEY idx_contract_line (contract_id)
) ENGINE = InnoDB COMMENT ='订单行';

-- =====================================================================
-- PRD 产品资源域
-- =====================================================================
CREATE TABLE prd_product_type (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  cat        VARCHAR(32) NOT NULL COMMENT '产品大类',
  name       VARCHAR(64) NOT NULL,
  status     VARCHAR(16) NOT NULL DEFAULT '启用',
  remark     VARCHAR(256) NULL,
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted    TINYINT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0
) ENGINE = InnoDB COMMENT ='产品类型';

CREATE TABLE prd_type_material (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  type_id      BIGINT      NOT NULL COMMENT '产品类型',
  material_key VARCHAR(64) NOT NULL COMMENT '含 mat_pool 出口池（决定是否池化计价）',
  qty          INT         NULL,
  remark       VARCHAR(256) NULL,
  created_by   BIGINT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by   BIGINT NULL,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted      TINYINT NOT NULL DEFAULT 0,
  version      INT NOT NULL DEFAULT 0,
  KEY idx_type_material (type_id)
) ENGINE = InnoDB COMMENT ='产品组成';

CREATE TABLE res_exit_pool (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(32)  NOT NULL,
  name        VARCHAR(64)  NOT NULL,
  product     VARCHAR(64)  NULL COMMENT '归属产品类型',
  capacity_m  INT          NOT NULL DEFAULT 0 COMMENT '池容量 Mbps',
  used_m      INT          NOT NULL DEFAULT 0 COMMENT '已占用 Mbps',
  rent_month  DECIMAL(12, 2) NULL COMMENT '池月成本',
  status      VARCHAR(16)  NOT NULL DEFAULT '启用',
  created_by  BIGINT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by  BIGINT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted     TINYINT NOT NULL DEFAULT 0,
  version     INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_pool_code (code)
) ENGINE = InnoDB COMMENT ='出口池（R0）';

CREATE TABLE res_pool_exit (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  pool_id    BIGINT NOT NULL,
  exit_id    BIGINT NOT NULL,
  weight     INT    NOT NULL DEFAULT 1 COMMENT '分摊权重',
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted    TINYINT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_pool_exit (pool_id, exit_id)
) ENGINE = InnoDB COMMENT ='池成员出口与分摊权重';

CREATE TABLE res_exit_line (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(32)  NOT NULL,
  name        VARCHAR(64)  NOT NULL,
  carrier     VARCHAR(64)  NULL,
  bandwidth_m INT          NOT NULL DEFAULT 0,
  cost_month  DECIMAL(12, 2) NULL,
  ip_segment  VARCHAR(64)  NULL,
  status      VARCHAR(16)  NOT NULL DEFAULT '启用',
  created_by  BIGINT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by  BIGINT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted     TINYINT NOT NULL DEFAULT 0,
  version     INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_exit_code (code)
) ENGINE = InnoDB COMMENT ='出口线路（R1）';

CREATE TABLE res_exit_load (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  exit_id     BIGINT    NOT NULL,
  measured_at DATETIME  NOT NULL COMMENT '实测时间',
  used_m      INT       NOT NULL COMMENT '实测占用 Mbps',
  measured_by BIGINT    NULL,
  created_by  BIGINT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by  BIGINT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted     TINYINT NOT NULL DEFAULT 0,
  version     INT NOT NULL DEFAULT 0,
  KEY idx_exit_load (exit_id, measured_at)
) ENGINE = InnoDB COMMENT ='负载人工实测记录（只增）';

CREATE TABLE res_ip_segment (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  seg        VARCHAR(43) NOT NULL COMMENT 'CIDR',
  count      INT         NOT NULL DEFAULT 0,
  exit_id    BIGINT      NULL,
  status     VARCHAR(16) NOT NULL DEFAULT '可用' COMMENT '可用/已分配/停用',
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted    TINYINT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_ip_seg (seg)
) ENGINE = InnoDB COMMENT ='IP 段';

CREATE TABLE res_equipment (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(64)   NOT NULL,
  category   VARCHAR(32)   NULL,
  cost_price DECIMAL(12, 2) NULL,
  supplier   VARCHAR(64)   NULL,
  stock      INT           NOT NULL DEFAULT 0,
  locked     INT           NOT NULL DEFAULT 0 COMMENT '锁定库存',
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted    TINYINT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0
) ENGINE = InnoDB COMMENT ='设备库存（R4）';

CREATE TABLE cost_item (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  item_key    VARCHAR(64)  NOT NULL,
  name        VARCHAR(128) NOT NULL,
  dept        VARCHAR(32)  NULL COMMENT '支撑部/技术部…',
  cost_type   VARCHAR(16)  NOT NULL COMMENT '一次性/周期性',
  unit        VARCHAR(16)  NULL,
  subject     VARCHAR(64)  NULL COMMENT '会计科目',
  calc_kind   VARCHAR(32)  NULL COMMENT '试算方式',
  demo_qty    DECIMAL(10, 2) NULL COMMENT 'demo 默认数量',
  status      VARCHAR(16)  NOT NULL DEFAULT '启用',
  created_by  BIGINT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by  BIGINT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted     TINYINT NOT NULL DEFAULT 0,
  version     INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_cost_item_key (item_key)
) ENGINE = InnoDB COMMENT ='成本条目库';

CREATE TABLE cost_center (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(32)  NOT NULL,
  name        VARCHAR(64)  NOT NULL,
  settle_type VARCHAR(16)  NOT NULL DEFAULT '直接' COMMENT '直接/间接',
  settle_rule VARCHAR(256) NULL COMMENT '月结规则',
  created_by  BIGINT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by  BIGINT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted     TINYINT NOT NULL DEFAULT 0,
  version     INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_cost_center_code (code)
) ENGINE = InnoDB COMMENT ='成本中心';

CREATE TABLE prd_price_dict (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  dict_key   VARCHAR(64)   NOT NULL COMMENT 'engineer_rate 等',
  role       VARCHAR(64)   NULL COMMENT '岗位/级别',
  rate       DECIMAL(10, 2) NULL COMMENT '元/人天',
  effect_at  DATE          NULL,
  status     VARCHAR(16)   NOT NULL DEFAULT '启用',
  remark     VARCHAR(256)  NULL,
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted    TINYINT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0,
  KEY idx_price_dict_key (dict_key, status)
) ENGINE = InnoDB COMMENT ='计价字典（跨资源共用计价规则）';

-- =====================================================================
-- COST 核算域
-- =====================================================================
CREATE TABLE cost_sheet (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  code           VARCHAR(32)    NOT NULL,
  contract_id    BIGINT         NOT NULL,
  customer_id    BIGINT         NOT NULL,
  status         VARCHAR(16)    NOT NULL DEFAULT '待填写' COMMENT '待填写/待对方提交/审批中/已通过/已驳回/变更中',
  ops_done       TINYINT        NOT NULL DEFAULT 0 COMMENT '支撑部已提交',
  tech_done      TINYINT        NOT NULL DEFAULT 0 COMMENT '技术部已提交',
  cur_node       VARCHAR(64)    NULL,
  margin         DECIMAL(5, 2)  NULL COMMENT '毛利率',
  monthly_cost   DECIMAL(12, 2) NULL,
  contract_value DECIMAL(12, 2) NULL,
  change_version INT            NOT NULL DEFAULT 0 COMMENT '变更版本',
  created_by     BIGINT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by     BIGINT NULL,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted        TINYINT NOT NULL DEFAULT 0,
  version        INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_sheet_code (code),
  KEY idx_sheet_contract (contract_id)
) ENGINE = InnoDB COMMENT ='核算单';

CREATE TABLE cost_sheet_line (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  sheet_id        BIGINT         NOT NULL,
  contract_line_id BIGINT        NULL,
  item_key        VARCHAR(64)    NOT NULL,
  dept            VARCHAR(32)    NULL,
  qty             DECIMAL(10, 2) NULL,
  meta            JSON           NULL,
  amount          DECIMAL(12, 2) NULL,
  calc_text       VARCHAR(512)   NULL COMMENT '演算说明',
  pick_spec       VARCHAR(256)   NULL COMMENT '选用资源留痕',
  created_by      BIGINT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by      BIGINT NULL,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted         TINYINT NOT NULL DEFAULT 0,
  version         INT NOT NULL DEFAULT 0,
  KEY idx_sheet_line (sheet_id)
) ENGINE = InnoDB COMMENT ='核算条目行';

CREATE TABLE cost_sign_snapshot (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  sheet_id      BIGINT   NOT NULL,
  snapshot_json JSON     NOT NULL COMMENT '池水位/选用资源/条目金额',
  locked_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    BIGINT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by    BIGINT NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted       TINYINT NOT NULL DEFAULT 0,
  version       INT NOT NULL DEFAULT 0,
  KEY idx_sign_snapshot_sheet (sheet_id)
) ENGINE = InnoDB COMMENT ='签单快照（只增不改）';

-- =====================================================================
-- APR 审批域
-- =====================================================================
CREATE TABLE apr_flow_def (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(64)  NOT NULL,
  doc_type       VARCHAR(32)  NOT NULL COMMENT '单据类型',
  trigger_action VARCHAR(32)  NOT NULL COMMENT '触发动作',
  condition_expr VARCHAR(256) NULL COMMENT '条件分支表达式',
  enabled        TINYINT      NOT NULL DEFAULT 1,
  created_by     BIGINT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by     BIGINT NULL,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted        TINYINT NOT NULL DEFAULT 0,
  version        INT NOT NULL DEFAULT 0
) ENGINE = InnoDB COMMENT ='审批流定义';

CREATE TABLE apr_flow_node (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  flow_id       BIGINT      NOT NULL,
  seq           INT         NOT NULL,
  name          VARCHAR(64) NOT NULL,
  approver_type VARCHAR(16) NOT NULL COMMENT 'USER/ROLE/DEPT_LEADER',
  approver_ref  VARCHAR(64) NULL,
  created_by    BIGINT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by    BIGINT NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted       TINYINT NOT NULL DEFAULT 0,
  version       INT NOT NULL DEFAULT 0,
  KEY idx_flow_node (flow_id, seq)
) ENGINE = InnoDB COMMENT ='审批流节点';

CREATE TABLE apr_instance (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  flow_id     BIGINT      NOT NULL,
  doc_type    VARCHAR(32) NOT NULL,
  doc_id      BIGINT      NOT NULL,
  status      VARCHAR(16) NOT NULL DEFAULT '审批中' COMMENT '审批中/已通过/已驳回',
  cur_seq     INT         NOT NULL DEFAULT 1,
  created_by  BIGINT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by  BIGINT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted     TINYINT NOT NULL DEFAULT 0,
  version     INT NOT NULL DEFAULT 0,
  KEY idx_instance_doc (doc_type, doc_id)
) ENGINE = InnoDB COMMENT ='审批实例';

CREATE TABLE apr_node_record (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  instance_id BIGINT      NOT NULL,
  seq         INT         NOT NULL,
  approver_id BIGINT      NULL,
  result      VARCHAR(16) NOT NULL COMMENT '通过/驳回',
  comment     VARCHAR(512) NULL,
  acted_at    DATETIME    NULL,
  created_by  BIGINT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by  BIGINT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted     TINYINT NOT NULL DEFAULT 0,
  version     INT NOT NULL DEFAULT 0,
  KEY idx_node_record (instance_id, seq)
) ENGINE = InnoDB COMMENT ='审批节点记录';

CREATE TABLE apr_writeback (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  instance_id BIGINT      NOT NULL,
  hook        VARCHAR(64) NOT NULL,
  payload     JSON        NULL,
  result      VARCHAR(16) NULL,
  created_by  BIGINT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by  BIGINT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted     TINYINT NOT NULL DEFAULT 0,
  version     INT NOT NULL DEFAULT 0,
  KEY idx_writeback_instance (instance_id)
) ENGINE = InnoDB COMMENT ='写回日志（审计）';

-- =====================================================================
-- WO 交付域
-- =====================================================================
CREATE TABLE wo_work_order (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  code                VARCHAR(32)  NOT NULL,
  sheet_id            BIGINT       NOT NULL,
  contract_id         BIGINT       NOT NULL,
  status              VARCHAR(32)  NOT NULL DEFAULT '已生成' COMMENT '已生成/资源可用性检查/资源分配申请/资源分配审批/资源绑定与扣减/开通实施/开通确认/激活计费',
  linked_purchase_req BIGINT       NULL COMMENT '联动采购需求单 → pur_req',
  delivery_snapshot   JSON         NULL COMMENT '开通确认锁数（交付快照）',
  created_by          BIGINT NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by          BIGINT NULL,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted             TINYINT NOT NULL DEFAULT 0,
  version             INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_wo_code (code),
  KEY idx_wo_contract (contract_id)
) ENGINE = InnoDB COMMENT ='开通工单';

CREATE TABLE wo_task (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  wo_id      BIGINT      NOT NULL,
  name       VARCHAR(64) NOT NULL,
  sort       INT         NOT NULL DEFAULT 0,
  done       TINYINT     NOT NULL DEFAULT 0,
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted    TINYINT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0,
  KEY idx_wo_task (wo_id)
) ENGINE = InnoDB COMMENT ='工单任务';

CREATE TABLE res_assignment (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  wo_id      BIGINT      NOT NULL,
  kind       VARCHAR(16) NOT NULL COMMENT '出口带宽/IP/CPE/基础线路',
  ref_id     BIGINT      NULL COMMENT '关联资源档案',
  qty        INT         NULL,
  status     VARCHAR(16) NOT NULL DEFAULT '申请' COMMENT '申请/审批/绑定',
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted    TINYINT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0,
  KEY idx_assignment_wo (wo_id)
) ENGINE = InnoDB COMMENT ='资源分配';

CREATE TABLE res_deduct_record (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  assignment_id BIGINT   NOT NULL,
  ref_id        BIGINT   NULL,
  before_qty    INT      NULL,
  after_qty     INT      NULL,
  acted_by      BIGINT   NULL,
  acted_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    BIGINT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by    BIGINT NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted       TINYINT NOT NULL DEFAULT 0,
  version       INT NOT NULL DEFAULT 0,
  KEY idx_deduct_assignment (assignment_id)
) ENGINE = InnoDB COMMENT ='绑定扣减流水（只增）';

-- =====================================================================
-- FIN 财务域（P1，表结构随本版落地）
-- =====================================================================
CREATE TABLE fin_bill (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  bill_no      VARCHAR(32)  NOT NULL,
  customer_id  BIGINT       NOT NULL,
  contract_id  BIGINT       NULL,
  period       VARCHAR(16)  NULL COMMENT '账期 yyyy-MM',
  amount       DECIMAL(12, 2) NOT NULL DEFAULT 0,
  received_amt DECIMAL(12, 2) NOT NULL DEFAULT 0,
  status       VARCHAR(16)  NOT NULL DEFAULT '未收讫' COMMENT '未收讫/部分收讫/已收讫',
  due_date     DATE         NULL,
  created_by   BIGINT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by   BIGINT NULL,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted      TINYINT NOT NULL DEFAULT 0,
  version      INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_bill_no (bill_no),
  KEY idx_bill_customer (customer_id)
) ENGINE = InnoDB COMMENT ='账单';

CREATE TABLE fin_payment (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  pay_no     VARCHAR(32)  NOT NULL,
  bill_id    BIGINT       NOT NULL,
  amount     DECIMAL(12, 2) NOT NULL,
  method     VARCHAR(16)  NULL,
  paid_at    DATETIME     NULL,
  source     VARCHAR(16)  NOT NULL DEFAULT '按账单登记' COMMENT '按账单登记/认领生成',
  flow_id    BIGINT       NULL COMMENT '认领来源流水 → fin_bank_flow',
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted    TINYINT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_pay_no (pay_no),
  KEY idx_payment_bill (bill_id)
) ENGINE = InnoDB COMMENT ='收款登记';

CREATE TABLE fin_bank_flow (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  flow_no      VARCHAR(32)  NOT NULL,
  arrived_at   DATETIME     NOT NULL,
  payer        VARCHAR(128) NOT NULL COMMENT '付款方户名',
  amount       DECIMAL(12, 2) NOT NULL,
  method       VARCHAR(16)  NULL COMMENT '银行转账/承兑汇票/现金/其他',
  reference_no VARCHAR(64)  NULL COMMENT '银行流水号',
  status       VARCHAR(16)  NOT NULL DEFAULT '未认领' COMMENT '未认领/部分认领/已核销/已红冲',
  claimed_amt  DECIMAL(12, 2) NOT NULL DEFAULT 0,
  note         VARCHAR(512) NULL,
  created_by   BIGINT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by   BIGINT NULL,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted      TINYINT NOT NULL DEFAULT 0,
  version      INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_flow_no (flow_no),
  KEY idx_flow_payer (payer)
) ENGINE = InnoDB COMMENT ='银行流水池（红冲留痕不物理删）';

CREATE TABLE fin_claim_alloc (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  alloc_no   VARCHAR(32)  NOT NULL,
  flow_id    BIGINT       NOT NULL,
  bill_id    BIGINT       NOT NULL,
  customer_id BIGINT      NOT NULL,
  amount     DECIMAL(12, 2) NOT NULL,
  pay_no     VARCHAR(32)  NULL COMMENT '生成的收款登记单号',
  claimed_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted    TINYINT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_alloc_no (alloc_no),
  KEY idx_claim_flow (flow_id),
  KEY idx_claim_bill (bill_id)
) ENGINE = InnoDB COMMENT ='认领分配';

CREATE TABLE fin_settle_record (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  batch_no      VARCHAR(32) NOT NULL COMMENT '月结批次',
  period        VARCHAR(16) NOT NULL,
  snapshot_json JSON        NOT NULL COMMENT '按签单快照归档，不重算',
  created_by    BIGINT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by    BIGINT NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted       TINYINT NOT NULL DEFAULT 0,
  version       INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_settle_batch (batch_no)
) ENGINE = InnoDB COMMENT ='月结记录（快照归档）';

CREATE TABLE fin_invoice_app (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  app_no     VARCHAR(32)  NOT NULL,
  entity_id  BIGINT       NULL COMMENT '销方主体 → mdm_entity',
  customer_id BIGINT      NOT NULL,
  amount     DECIMAL(12, 2) NOT NULL,
  title      VARCHAR(128) NULL COMMENT '开票抬头',
  tax_no     VARCHAR(64)  NULL,
  status     VARCHAR(16)  NOT NULL DEFAULT '待开票' COMMENT '待开票/已开票/已作废',
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted    TINYINT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_invoice_app_no (app_no)
) ENGINE = InnoDB COMMENT ='开票申请';

CREATE TABLE fin_pay_request (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  req_no     VARCHAR(32)  NOT NULL,
  payee      VARCHAR(128) NOT NULL,
  amount     DECIMAL(12, 2) NOT NULL,
  reason     VARCHAR(512) NULL,
  status     VARCHAR(16)  NOT NULL DEFAULT '待审批' COMMENT '待审批/已审批/已付款',
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted    TINYINT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_pay_req_no (req_no)
) ENGINE = InnoDB COMMENT ='付款申请';

CREATE TABLE fin_overdue (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT       NOT NULL,
  bill_id     BIGINT       NOT NULL,
  amount      DECIMAL(12, 2) NOT NULL,
  overdue_days INT         NOT NULL DEFAULT 0,
  status      VARCHAR(16)  NOT NULL DEFAULT '逾期中' COMMENT '逾期中/已回款',
  created_by  BIGINT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by  BIGINT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted     TINYINT NOT NULL DEFAULT 0,
  version     INT NOT NULL DEFAULT 0,
  KEY idx_overdue_customer (customer_id)
) ENGINE = InnoDB COMMENT ='逾期台账';

-- =====================================================================
-- PUR 采购域（P1，表结构随本版落地）
-- =====================================================================
CREATE TABLE pur_contract (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(32)  NOT NULL,
  buyer_id    BIGINT       NULL COMMENT '采购主体 → mdm_entity（缺省总部）',
  name        VARCHAR(128) NOT NULL,
  supplier    VARCHAR(128) NOT NULL,
  subject     VARCHAR(64)  NULL COMMENT '出口带宽/基础线路/OTN 波道/设备框架…',
  billing     VARCHAR(16)  NOT NULL DEFAULT '按单计价' COMMENT '周期性月租/按单计价',
  capacity_m  INT          NULL COMMENT '容量类容量 Mbps',
  monthly_cost DECIMAL(12, 2) NULL COMMENT '容量类月租',
  bw_m        INT          NULL COMMENT '整线类带宽',
  line_price  DECIMAL(12, 2) NULL COMMENT '整线月租',
  unit_price  DECIMAL(12, 2) NULL COMMENT '按单类单价',
  effect_at   DATE         NULL,
  end_at      DATE         NULL,
  status      VARCHAR(16)  NOT NULL DEFAULT '履行中' COMMENT '履行中/已到期/已终止',
  attachments VARCHAR(512) NULL COMMENT '扫描件相对路径（存储方案见契约 §9）',
  remark      VARCHAR(512) NULL,
  created_by  BIGINT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by  BIGINT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted     TINYINT NOT NULL DEFAULT 0,
  version     INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_pur_contract_code (code)
) ENGINE = InnoDB COMMENT ='采购合同（采购侧价格事实唯一出处）';

CREATE TABLE pur_req (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  req_no      VARCHAR(32)  NOT NULL,
  source      VARCHAR(16)  NOT NULL DEFAULT '手工提报' COMMENT '手工提报/资源不足联动/业务规划',
  mat_key     VARCHAR(64)  NULL COMMENT '资源目录物料 key',
  spec        VARCHAR(256) NOT NULL,
  qty         DECIMAL(10, 2) NULL,
  unit        VARCHAR(16)  NULL,
  room        VARCHAR(64)  NULL COMMENT '目标机房',
  expect_date DATE         NULL,
  note        VARCHAR(512) NULL,
  status      VARCHAR(16)  NOT NULL DEFAULT '待处理' COMMENT '待处理/已转采购单/已转合同变更/已关闭',
  linked_wo_id BIGINT      NULL COMMENT '挂起工单 → wo_work_order',
  po_id       BIGINT       NULL COMMENT '转采购单回填',
  contract_id BIGINT       NULL COMMENT '带宽类转补充协议回填',
  created_by  BIGINT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by  BIGINT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted     TINYINT NOT NULL DEFAULT 0,
  version     INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_pur_req_no (req_no),
  KEY idx_pur_req_wo (linked_wo_id)
) ENGINE = InnoDB COMMENT ='采购需求单';

CREATE TABLE pur_order (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  po_no          VARCHAR(32)  NOT NULL,
  supplier       VARCHAR(128) NOT NULL,
  tax_rate       DECIMAL(5, 2) NULL,
  payment_terms  VARCHAR(128) NULL COMMENT '账期条款',
  status         VARCHAR(16)  NOT NULL DEFAULT '草稿' COMMENT '草稿/待审批/已下单/部分到货/验收完成',
  reject_reason  VARCHAR(512) NULL COMMENT '最近驳回原因（留痕）',
  contract_id    BIGINT       NULL COMMENT '框架合同 → pur_contract',
  created_by     BIGINT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by     BIGINT NULL,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted        TINYINT NOT NULL DEFAULT 0,
  version        INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_pur_order_no (po_no)
) ENGINE = InnoDB COMMENT ='采购单';

CREATE TABLE pur_order_req (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  po_id      BIGINT NOT NULL,
  req_id     BIGINT NOT NULL,
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted    TINYINT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_pur_order_req (po_id, req_id)
) ENGINE = InnoDB COMMENT ='采购单-需求单引用';

CREATE TABLE pur_order_line (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  po_id        BIGINT          NOT NULL,
  line_type    VARCHAR(16)     NOT NULL COMMENT '带宽容量/IP 段/设备/其他资源',
  spec         VARCHAR(128)    NOT NULL,
  unit_price   DECIMAL(12, 2)  NOT NULL,
  quantity     INT             NOT NULL,
  received_qty INT             NOT NULL DEFAULT 0 COMMENT '累计到货',
  accepted_qty INT             NOT NULL DEFAULT 0 COMMENT '累计验收合格',
  created_by   BIGINT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by   BIGINT NULL,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted      TINYINT NOT NULL DEFAULT 0,
  version      INT NOT NULL DEFAULT 0,
  KEY idx_pur_order_line (po_id)
) ENGINE = InnoDB COMMENT ='采购明细';

CREATE TABLE pur_receipt (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  po_id      BIGINT      NOT NULL,
  batch_no   INT         NOT NULL,
  operator   BIGINT      NULL,
  items_json JSON        NOT NULL COMMENT '[{lineId, arrived, result, rejectReason}]',
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by BIGINT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted    TINYINT NOT NULL DEFAULT 0,
  version    INT NOT NULL DEFAULT 0,
  KEY idx_pur_receipt_po (po_id)
) ENGINE = InnoDB COMMENT ='到货验收批次';

CREATE TABLE pur_inbound_device (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  po_id        BIGINT      NOT NULL,
  asset_no     VARCHAR(64) NOT NULL COMMENT '固定资产编号',
  sn           VARCHAR(64) NULL,
  brand        VARCHAR(64) NULL,
  model        VARCHAR(64) NULL,
  warranty_end DATE        NULL,
  created_by   BIGINT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by   BIGINT NULL,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted      TINYINT NOT NULL DEFAULT 0,
  version      INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_inbound_asset (asset_no),
  KEY idx_inbound_po (po_id)
) ENGINE = InnoDB COMMENT ='入库设备（写 R4 库存并溯源采购单）';
