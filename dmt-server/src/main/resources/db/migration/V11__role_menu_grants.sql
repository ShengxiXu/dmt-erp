-- M5 收尾：角色菜单授权补全
-- 背景：V2 仅给 ADMIN(role 1) 授了全部菜单，其余角色侧边栏只剩「审批中心」(open)；
-- M5 财务/采购页面按角色验收（FIN 赵磊走财务、OPS 张云走采购），必须补齐授权。
-- 新增菜单：采购执行、特批申请；前端导航用 finance:list / purchase:list / special:list / resources:list 挂接。

INSERT INTO sys_menu (id, parent_id, name, perm_code, type, path, sort) VALUES
  (16, NULL, '采购执行',   'purchase:list', 'MENU', '/purchase', 16),
  (17, NULL, '特批申请',   'special:list',  'MENU', '/special',  17);

INSERT INTO sys_role_menu (role_id, menu_id) VALUES
  -- 业务支撑部 OPS：全业务链路 + 采购执行
  (2, 1), (2, 2), (2, 3), (2, 4), (2, 5), (2, 6), (2, 7), (2, 8), (2, 11), (2, 12), (2, 13), (2, 14), (2, 16), (2, 17),
  -- 技术部 TECH：工单 + 资源 + 产品
  (3, 1), (3, 4), (3, 5), (3, 11), (3, 12),
  -- 销售部 SALES：客户/商机/合同/特批
  (4, 1), (4, 4), (4, 6), (4, 7), (4, 8), (4, 11), (4, 17),
  -- 财务 FIN：财务中心 + 成本台账 + 采购查看
  (5, 1), (5, 2), (5, 3), (5, 4), (5, 10), (5, 14), (5, 16),
  -- 管理层 MANAGER：只读经营视角
  (6, 1), (6, 3), (6, 4), (6, 6), (6, 7), (6, 8), (6, 9), (6, 10), (6, 12), (6, 14);
