-- =====================================================================
-- DMT-ERP 演示种子数据（起步集；全量演示数据可再从原型快照补充）
-- 说明：口令统一为 admin123 的 BCrypt 哈希，仅供内网演示
-- =====================================================================

-- ---------- 部门 ----------
INSERT INTO sys_dept (id, name, parent_id) VALUES
  (1, '总经办', NULL),
  (2, '业务支撑部', NULL),
  (3, '技术部', NULL),
  (4, '销售部', NULL),
  (5, '财务部', NULL);

-- ---------- 角色 ----------
INSERT INTO sys_role (id, code, name, data_scope) VALUES
  (1, 'ADMIN',   '系统管理员', 'ALL'),
  (2, 'OPS',     '支撑部专员', 'DEPT'),
  (3, 'TECH',    '技术部专员', 'DEPT'),
  (4, 'SALES',   '销售',       'SELF'),
  (5, 'FIN',     '财务专员',   'DEPT'),
  (6, 'MANAGER', '管理层',     'ALL');

-- ---------- 用户（口令均为 admin123） ----------
INSERT INTO sys_user (id, username, password_hash, name, mobile, dept_id) VALUES
  (1, 'admin',   '$2a$10$IU34enOXgTpuaVkVXupBV.5TNPLP3Bgdq0gf7jSrRshPOZX/YOWwm', '系统管理员', '13800000000', 1),
  (2, 'zhangyun','$2a$10$IU34enOXgTpuaVkVXupBV.5TNPLP3Bgdq0gf7jSrRshPOZX/YOWwm', '张云',       '13800000002', 2),
  (3, 'liqiang', '$2a$10$IU34enOXgTpuaVkVXupBV.5TNPLP3Bgdq0gf7jSrRshPOZX/YOWwm', '李强',       '13800000003', 3),
  (4, 'chenming','$2a$10$IU34enOXgTpuaVkVXupBV.5TNPLP3Bgdq0gf7jSrRshPOZX/YOWwm', '陈明',       '13800000004', 4),
  (5, 'wangfang','$2a$10$IU34enOXgTpuaVkVXupBV.5TNPLP3Bgdq0gf7jSrRshPOZX/YOWwm', '王芳',       '13800000005', 4),
  (6, 'zhaolei', '$2a$10$IU34enOXgTpuaVkVXupBV.5TNPLP3Bgdq0gf7jSrRshPOZX/YOWwm', '赵磊',       '13800000006', 5);

INSERT INTO sys_user_role (user_id, role_id) VALUES
  (1, 1), (1, 6),
  (2, 2), (3, 3), (4, 4), (5, 4), (6, 5);

-- ---------- 菜单与按钮权限 ----------
INSERT INTO sys_menu (id, parent_id, name, perm_code, type, path, sort) VALUES
  (1,  NULL, '工作台',       'workbench:view',  'MENU', '/workbench',      1),
  (2,  NULL, '核算单录入',   'sheet:edit',      'MENU', '/home',           2),
  (3,  NULL, '成本台账',     'sheet:list',      'MENU', '/cost',           3),
  (4,  NULL, '审批中心',     'approval:list',   'MENU', '/approval',       4),
  (5,  NULL, '开通工单',     'wo:list',         'MENU', '/delivery',       5),
  (6,  NULL, '合同管理',     'contract:list',   'MENU', '/contract',       6),
  (7,  NULL, '客户档案',     'customer:list',   'MENU', '/customer',       7),
  (8,  NULL, '商机管理',     'opportunity:list','MENU', '/opportunity',    8),
  (9,  NULL, '经营分析',     'analytics:view',  'MENU', '/analytics',      9),
  (10, NULL, '财务中心',     'finance:list',    'MENU', '/finance',        10),
  (11, NULL, '产品定义',     'product:list',    'MENU', '/product',        11),
  (12, NULL, '资源清单',     'resources:list',  'MENU', '/resources',      12),
  (13, NULL, '成本条目库',   'cost-item:list',  'MENU', '/cost-items',     13),
  (14, NULL, '成本中心',     'cost-center:list','MENU', '/cost-centers',   14),
  (15, NULL, '系统管理',     'system:list',     'MENU', '/system',         15);

INSERT INTO sys_role_menu (role_id, menu_id)
SELECT 1, id FROM sys_menu;

-- ---------- 签约主体与印章 ----------
INSERT INTO mdm_entity (id, short_name, full_name, nature, tax_no, bank, account) VALUES
  (1, '地面通信息（上海总部）', '上海地面通信息技术有限公司',           '法人公司', '91310104MA1FR8Q42A', '招商银行上海漕河泾支行',   '1219 0888 5566 001'),
  (2, '地面通网络（子公司）',   '上海地面通网络科技有限公司',           '法人公司', '91310115MA1K3T7X9B', '浦发银行上海张江支行',     '9881 2233 7788 102'),
  (3, '地面通北京（分公司）',   '北京地面通信息技术有限公司上海分公司', '分公司',   '91110108MA01C8Y77C', '中国银行北京中关村支行',   '3456 8899 2211 308');

INSERT INTO mdm_entity_seal (entity_id, name, type) VALUES
  (1, '上海地面通信息技术有限公司公章',       '公章'),
  (1, '上海地面通信息技术有限公司合同专用章', '合同专用章'),
  (1, '上海地面通信息技术有限公司财务专用章', '财务专用章'),
  (1, '上海地面通信息技术有限公司发票专用章', '发票专用章'),
  (2, '上海地面通网络科技有限公司公章',       '公章'),
  (2, '上海地面通网络科技有限公司合同专用章', '合同专用章'),
  (2, '上海地面通网络科技有限公司发票专用章', '发票专用章'),
  (3, '北京地面通信息技术有限公司上海分公司公章',       '公章'),
  (3, '北京地面通信息技术有限公司上海分公司合同专用章', '合同专用章');

-- ---------- 成本中心 ----------
INSERT INTO cost_center (code, name, settle_type, settle_rule) VALUES
  ('CC-EXIT',  '出口带宽成本中心', '直接', '按池月成本 + 成员分摊，随月结归档'),
  ('CC-LINE',  '线路成本中心',     '直接', '按采购合同月租归集'),
  ('CC-EQUIP', '设备成本中心',     '直接', '一次性购置按单归集'),
  ('CC-OPS',   '运维成本中心',     '间接', '按工时费率分摊');

-- ---------- 计价字典（工时费率） ----------
INSERT INTO prd_price_dict (dict_key, role, rate, effect_at, remark) VALUES
  ('engineer_rate', '网络工程师（实施/运维）', 800,  '2026-01-01', '开通实施与安装调测共用'),
  ('engineer_rate', '高级工程师（方案/割接）', 1200, '2026-01-01', '重大割接、疑难方案评审');

-- ---------- 产品类型与组成 ----------
INSERT INTO prd_product_type (id, cat, name, remark) VALUES
  (1, '专线',   'BGP 互联网专线',   '出口池化计价'),
  (2, '专线',   '静态带宽专线',     '直挂出口计价'),
  (3, '组网',   'SD-WAN 组网',      'CPE + 骨干'),
  (4, '增值',   'DDoS 高防',        '增值包');

INSERT INTO prd_type_material (type_id, material_key, qty, remark) VALUES
  (1, 'mat_pool', 1, '出口池（决定池化计价）'),
  (1, 'mat_ip',   1, 'IP 地址'),
  (2, 'mat_exit', 1, '直挂出口线路'),
  (3, 'mat_dev',  2, 'CPE 设备'),
  (4, 'mat_pool', 1, '高防池');

-- ---------- 资源档案 ----------
INSERT INTO res_exit_line (id, code, name, carrier, bandwidth_m, cost_month, ip_segment, status) VALUES
  (1, 'B-001', '电信 BGP 出口（1G）',   '上海电信', 1000, 45000,  '101.92.8.0/21',  '启用'),
  (2, 'B-002', '联通 169 出口（1G）',   '上海联通', 1000, 40000,  '113.240.16.0/20', '启用'),
  (3, 'B-003', '移动 CMNET 出口（800M）','上海移动', 800,  28000,  NULL,              '启用');

INSERT INTO res_exit_pool (id, code, name, product, capacity_m, used_m, rent_month) VALUES
  (1, 'PN-PON', '国内精品网骨干池', 'BGP 互联网专线', 1000, 260, 120000);

INSERT INTO res_pool_exit (pool_id, exit_id, weight) VALUES
  (1, 1, 1), (1, 2, 1);

INSERT INTO res_ip_segment (id, seg, count, exit_id, status) VALUES
  (1, '101.92.8.0/24', 256, 1, '可用'),
  (2, '113.240.16.0/24', 256, 2, '可用');

INSERT INTO res_equipment (id, name, category, cost_price, supplier, stock, locked) VALUES
  (1, '华为 AR6121 CPE', 'CPE', 4300, '华为渠道-上海XX', 20, 0),
  (2, '华三 MSR3600 CPE', 'CPE', 3600, '华三渠道-上海YY', 15, 0);

-- ---------- 成本条目库（起步集） ----------
INSERT INTO cost_item (item_key, name, dept, cost_type, unit, subject, calc_kind, demo_qty) VALUES
  ('cpe_device',      'CPE 设备购置费',   '技术部',   '一次性', '台',   '设备购置',  '按台计价',   1),
  ('exit_bandwidth',  '出口带宽占用费',   '支撑部',   '周期性', 'M',    '带宽成本',  '两步法',     NULL),
  ('ip_fee',          'IP 地址使用费',    '支撑部',   '周期性', '个',   'IP 成本',   '按个计价',   NULL),
  ('install_labor',   '开通实施工时',     '技术部',   '一次性', '人天', '实施费',    '工时费率',   NULL);

-- ---------- 客户与商机（演示） ----------
INSERT INTO mdm_customer (id, name, credit_code, level, industry, source, sales_id, contact, contact_phone) VALUES
  (1, '云启数据科技有限公司',   '91310115MA1K3AB01C', 'A', '互联网',  '老客户介绍', 4, '钱工', '13911110001'),
  (2, '恒信证券股份有限公司',   '91310000MA1FL2202B', 'A', '金融',    '行业展会',   5, '孙经理', '13911110002');

INSERT INTO mdm_opportunity (id, code, customer_id, name, stage, expect_amount, sales_id) VALUES
  (1, 'OPP-2026-0001', 1, '云启数据 BGP 专线 500M',       '跟进中', 120000, 4),
  (2, 'OPP-2026-0002', 2, '恒信证券 SD-WAN 组网（20 点）','已报价', 300000, 5);

-- ---------- 采购合同（演示） ----------
INSERT INTO pur_contract (code, buyer_id, name, supplier, subject, billing, capacity_m, monthly_cost, effect_at) VALUES
  ('CT-2026-018', 1, '电信 BGP 出口采购合同（1G）', '上海电信', '出口带宽', '周期性月租', 1000, 45000, '2025-01-01'),
  ('CU-2026-033', 1, '联通 169 BGP 出口采购合同（1G）', '上海联通', '出口带宽', '周期性月租', 1000, 40000, '2025-01-01');
