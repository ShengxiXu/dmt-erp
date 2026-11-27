-- V4：资源分配审批流（M4 交付域接线）
INSERT INTO apr_flow_def (id, name, doc_type, trigger_action, condition_expr, enabled) VALUES
  (5, '资源分配审批', '资源分配', '申请', NULL, 1);

INSERT INTO apr_flow_node (flow_id, seq, name, approver_type, approver_ref) VALUES
  (5, 1, '技术部审批', 'ROLE', 'TECH');
