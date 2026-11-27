-- V10：采购单审批流 + 财务演示数据（回款认领/账单主路径立即可用）
INSERT INTO apr_flow_def (id, name, doc_type, trigger_action, condition_expr, enabled) VALUES
  (6, '采购单审批', '采购单', '提交', NULL, 1);

INSERT INTO apr_flow_node (flow_id, seq, name, approver_type, approver_ref) VALUES
  (6, 1, '业务支撑部审批', 'ROLE', 'OPS');

-- 财务演示数据：一笔未收讫账单 + 三笔未认领银行流水
INSERT INTO fin_bill (bill_no, customer_id, contract_id, period, amount, received_amt, status, due_date) VALUES
  ('INV-2026-1201', 1, 3, '2026-11', 42400.00, 0.00, '未收讫', '2026-12-10'),
  ('INV-2026-1202', 1, 5, '2026-11', 96000.00, 0.00, '未收讫', '2026-12-15');

INSERT INTO fin_bank_flow (flow_no, arrived_at, payer, amount, method, reference_no, status, claimed_amt, note) VALUES
  ('BF-2026-1001', '2026-11-25 10:18', '云启数据科技有限公司', 42400, '银行转账', 'BK202611250031', '未认领', 0, '附言：11 月账期'),
  ('BF-2026-1002', '2026-11-25 14:52', '云启数据科技有限公司', 50000, '银行转账', 'BK202611250087', '未认领', 0, NULL),
  ('BF-2026-1003', '2026-11-26 09:05', '恒信证券股份有限公司', 30400, '银行转账', 'BK202611260012', '未认领', 0, NULL);
