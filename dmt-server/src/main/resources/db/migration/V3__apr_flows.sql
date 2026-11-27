-- V3：审批引擎种子流程（含条件分支演示：低毛利核算单走三级，标准走两级）
INSERT INTO apr_flow_def (id, name, doc_type, trigger_action, condition_expr, enabled) VALUES
  (1, '核算单审批（低毛利三级）', '成本核算单', '提交', 'margin < 45', 1),
  (2, '核算单审批（标准两级）',   '成本核算单', '提交', NULL,          1),
  (3, '特批申请三级审批',         '特批申请单', '提交', NULL,          1),
  (4, '合同申请审批',             '销售合同',   '提交', NULL,          1);

INSERT INTO apr_flow_node (flow_id, seq, name, approver_type, approver_ref) VALUES
  (1, 1, '财务复核',       'ROLE', 'FIN'),
  (1, 2, '管理层审批',     'ROLE', 'MANAGER'),
  (1, 3, '总经理终审',     'USER', '1'),
  (2, 1, '财务复核',       'ROLE', 'FIN'),
  (2, 2, '管理层审批',     'ROLE', 'MANAGER'),
  (3, 1, '业务支撑部初审', 'ROLE', 'OPS'),
  (3, 2, '财务复核',       'ROLE', 'FIN'),
  (3, 3, '管理层审批',     'ROLE', 'MANAGER'),
  (4, 1, '业务支撑部复核', 'ROLE', 'OPS');
