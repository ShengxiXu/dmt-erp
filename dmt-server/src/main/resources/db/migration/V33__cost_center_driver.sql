-- 成本中心对齐原型：分法预设 key、算式、状态（停用在用校验）
ALTER TABLE cost_center
  ADD COLUMN driver_key VARCHAR(16)  NULL COMMENT '分法预设 key：bw/eq/node/cap（空=自定义）' AFTER settle_rule,
  ADD COLUMN formula    VARCHAR(255) NULL COMMENT '分法算式（中心当月费用 怎么乘除 本单的什么）' AFTER driver_key,
  ADD COLUMN status     VARCHAR(8)   NOT NULL DEFAULT '启用' COMMENT '启用/停用（停用后新核算单不再分配，历史不受影响）' AFTER formula;

-- 存量回填：CC-EXIT 按带宽占比分（预设 bw）；CC-OPS 按工时占比（自定义）；线路/设备为归集型（自定义）
UPDATE cost_center SET driver_key = 'bw',
  formula = '出口带宽成本中心当月费用 × 本单带宽 ÷ 当月总售出带宽'
WHERE code = 'CC-EXIT';
UPDATE cost_center SET
  formula = '线路成本中心当月费用按采购合同月租归集，随月结归档'
WHERE code = 'CC-LINE';
UPDATE cost_center SET
  formula = '设备成本中心一次性购置按单归集，随单结转'
WHERE code = 'CC-EQUIP';
UPDATE cost_center SET
  formula = '运维成本中心当月费用 × 本单工时 ÷ 当月总工时'
WHERE code = 'CC-OPS';
