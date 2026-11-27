-- V7：合同字段补齐（用章方式/特殊条款）+ 产品类型规格字段模板与套餐（订单行规格结构化，不可自由输入）
ALTER TABLE mdm_contract
  ADD COLUMN seal  VARCHAR(16)  NOT NULL DEFAULT 'online' COMMENT '用章方式 online/offline' AFTER pay_cycle,
  ADD COLUMN terms VARCHAR(512) NULL COMMENT '特殊条款（特批单带出时锁定）' AFTER seal;

ALTER TABLE prd_product_type
  ADD COLUMN spec_fields_json JSON NULL COMMENT '规格字段模板 [{key,label,type,options,placeholder,required}]' AFTER remark,
  ADD COLUMN plans_json       JSON NULL COMMENT '套餐 [{id,name,price,values}]' AFTER spec_fields_json;

-- 规格字段模板种子（与演示合同行一致：选项来自产品定义）
UPDATE prd_product_type SET spec_fields_json = '[
  {"key":"bwM","label":"带宽(M)","type":"number","placeholder":"如 500","required":true},
  {"key":"ipCount","label":"IP 个数","type":"number","placeholder":"如 8","required":true},
  {"key":"room","label":"接入机房","type":"text","placeholder":"如 漕河泾机房"},
  {"key":"sla","label":"SLA","type":"select","options":["99.9%","99.95%","99.99%"],"required":true}
]', plans_json = '[{"id":"std","name":"标准版","values":{"bwM":"500","ipCount":"8","sla":"99.9%"},"remark":"演示套餐"}]' WHERE id = 1;

UPDATE prd_product_type SET spec_fields_json = '[
  {"key":"bwM","label":"带宽(M)","type":"number","placeholder":"如 300","required":true},
  {"key":"ipCount","label":"IP 个数","type":"number","placeholder":"如 4","required":true},
  {"key":"room","label":"接入机房","type":"text","placeholder":"如 张江机房"}
]' WHERE id = 2;

UPDATE prd_product_type SET spec_fields_json = '[
  {"key":"sites","label":"点位数","type":"number","placeholder":"如 20","required":true},
  {"key":"cpe","label":"CPE 台数","type":"number","placeholder":"如 20","required":true},
  {"key":"access","label":"接入方式","type":"select","options":["互联网","4G/5G 备份","MPLS"]}
]' WHERE id = 3;

UPDATE prd_product_type SET spec_fields_json = '[
  {"key":"defense","label":"防护能力","type":"select","options":["10G","20G","50G","100G+"],"required":true},
  {"key":"lines","label":"线路数","type":"number","placeholder":"如 1","required":true}
]' WHERE id = 4;
