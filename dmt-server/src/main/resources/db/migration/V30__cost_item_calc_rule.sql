-- 成本条目计算规则结构化：计算方式（系统实现的枚举）+ 结构化参数 JSON
-- formula / calc_kind 改为保存时由服务端按 方式+参数 派生，不再手工填写
ALTER TABLE cost_item
  ADD COLUMN calc_method VARCHAR(16)  NULL COMMENT '计算方式：QTY_PRICE/POOL_SHARE/BGP_UTIL/MANDAY/PER_OBJECT/RESALE/FIXED/MANUAL' AFTER calc_kind,
  ADD COLUMN calc_params TEXT         NULL COMMENT '计算参数 JSON（单价来源/池编码/费率岗位/目标利用率/固定金额等）' AFTER calc_method;

-- 存量种子条目结构化（算式文案与服务端 formulaText 生成口径保持一致）
UPDATE cost_item SET calc_method = 'QTY_PRICE',
  calc_params = '{"priceSource":"equipment"}',
  calc_kind = '按量计价',
  formula = '数量 × 设备档案采购价'
WHERE item_key = 'cpe_device';

UPDATE cost_item SET calc_method = 'POOL_SHARE',
  calc_params = '{}',
  calc_kind = '池化分摊',
  formula = '本单带宽 ÷（池已售 ＋ 本单带宽）× 池月成本（核算时选池）'
WHERE item_key = 'exit_bandwidth';

UPDATE cost_item SET calc_method = 'QTY_PRICE',
  calc_params = '{"priceSource":"param","unitPrice":39}',
  calc_kind = '按量计价',
  formula = '数量 × 单价 39 元/个'
WHERE item_key = 'ip_fee';

UPDATE cost_item SET calc_method = 'MANDAY',
  calc_params = '{"rateRole":"网络工程师（实施/运维）"}',
  calc_kind = '工时计价',
  formula = '人天 × 费率（网络工程师（实施/运维），计价标准）'
WHERE item_key = 'install_labor';
