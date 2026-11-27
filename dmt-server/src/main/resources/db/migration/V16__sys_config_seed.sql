-- 策略中心预置配置（原型 A5 策略中心分组：计费出账/欠费停机/成本测算/违约金/月结）
INSERT INTO sys_config (cfg_key, cfg_value, remark) VALUES
  ('billing.payTiming',     'postpaid', '付款时点：postpaid 后付 / prepaid 预付'),
  ('billing.dueDays',       '10',       '付款期（天）：应收日 = 账期截止日 + N 天'),
  ('billing.diffPct',       '30',       '出账环比审核阈值（%）：超过进人工审核'),
  ('overdue.graceDays',     '3',        '宽限期（天）：逾期 ≤ N 仅提醒不停机'),
  ('overdue.remindDays',    '7',        '提醒频率（天）'),
  ('overdue.suspendDays',   '30',       '停机条件：逾期 > N 天生成停机工单'),
  ('overdue.lateFeeRate',   '0.05',     '滞纳金比例（%/日）'),
  ('overdue.badDebtDays',   '180',      '坏账门槛：逾期 ≥ N 天可发起坏账申请'),
  ('cost.exitPerM',         '40',       '出口带宽成本单价（元/M/月）：带宽升降级增量成本测算'),
  ('cost.ipUnit',           '25',       'IP 地址成本单价（元/个·月）'),
  ('cost.planRatio',        '60',       '套餐变更成本率兜底（%）'),
  ('cost.installFee',       '2000',     '安装调测费（元/次）：地址迁移一次性成本'),
  ('penalty.refRate',       '30',       '违约金参考比例（%）：剩余未履行账期月租合计 × 比例，仅供预填'),
  ('settle.closeDay',       '5',        '月结日：次月 N 日跑上月月结'),
  ('settle.diffYellow',     '5',        '差异预警黄（%）'),
  ('settle.diffRed',        '10',       '差异预警红（%）');
