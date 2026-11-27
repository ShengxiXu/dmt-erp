-- 资源目录（物料库）：资源的通用定义（类），产品 BOM 引用；属性模板驱动资源中心档案表单
CREATE TABLE prd_material (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  mat_key       VARCHAR(32)  NOT NULL,
  name          VARCHAR(64)  NOT NULL,
  form          VARCHAR(16)  NOT NULL DEFAULT '服务化资源' COMMENT '实物/服务化资源/人工服务',
  group_name    VARCHAR(32)  NULL COMMENT '线路资源/IP资源/设备与备件/机房设施/平台与外购服务/交付服务',
  status        VARCHAR(8)   NOT NULL DEFAULT '启用',
  remark        VARCHAR(255) NULL,
  attrs_json    TEXT         NULL COMMENT '属性模板（类定义字段，档案页表单按此渲染）',
  purchase_kind VARCHAR(16)  NULL COMMENT '带宽扩容/采购入库',
  purchase_unit VARCHAR(8)   NULL,
  created_by    BIGINT       NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by    BIGINT       NULL,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted       TINYINT      NOT NULL DEFAULT 0,
  version       INT          NOT NULL DEFAULT 0,
  UNIQUE KEY uk_material_key (mat_key)
) COMMENT '资源目录（物料库）';

INSERT INTO prd_material (mat_key, name, form, group_name, remark, purchase_kind, purchase_unit, attrs_json) VALUES
('mat_exit', '出口线路', '服务化资源', '线路资源', '向运营商采购的出口，可多家客户共享；BGP 调度平台、SLA 冗余池也算在这', '带宽扩容', 'M',
 '[{"key":"code","label":"资源编码","method":"readonly","placeholder":"系统生成"},{"key":"name","label":"线路名称","method":"text","placeholder":"运营商-地域-带宽"},{"key":"carrier","label":"运营商","method":"enum","options":["电信","联通","移动","境外运营商","三方"]},{"key":"capacityM","label":"带宽容量(M)","method":"text","numeric":true},{"key":"monthlyCost","label":"月租(元)","method":"text","numeric":true},{"key":"effect","label":"生效日期","method":"text"},{"key":"status","label":"状态","method":"readonly"},{"key":"usedM","label":"已售带宽(M)","method":"calc","dynamic":true}]'),
('mat_pool', '出口池', '服务化资源', '线路资源', '多出口自组的资源实体（如 BGP 资源池）：客户向池采购带宽；实例档案见资源中心 R0', '带宽扩容', 'M',
 '[{"key":"code","label":"池编码","method":"readonly"},{"key":"name","label":"池名称","method":"text"},{"key":"exitIds","label":"成员出口","method":"search","source":"R1 出口线路档案（多选）"},{"key":"capacityM","label":"池容量(M)","method":"calc"},{"key":"monthlyCost","label":"池月成本(元)","method":"calc"},{"key":"status","label":"状态","method":"readonly"}]'),
('mat_base', '基础线路', '服务化资源', '线路资源', '接入端线路：单客户专用，可跨产品共用不重复采购', '采购入库', '条',
 '[{"key":"code","label":"线路编码","method":"readonly"},{"key":"name","label":"线路名称","method":"text"},{"key":"carrier","label":"运营商","method":"enum","options":["电信","联通","移动","三方"]},{"key":"bwM","label":"带宽(M)","method":"text","numeric":true},{"key":"billing","label":"计费方式","method":"enum","options":["周期性（月）","一次性买断"]},{"key":"price","label":"整条月租/买断价(元)","method":"text","numeric":true},{"key":"contractNo","label":"采购合同","method":"search"},{"key":"shareable","label":"可共用标记","method":"enum","options":["是","否"]}]'),
('mat_ip', 'IP 地址段', '服务化资源', 'IP 资源', '随出口线路绑定的 IP 段', '采购入库', '段',
 '[{"key":"seg","label":"地址段 CIDR","method":"text","placeholder":"如 58.40.0.0/24"},{"key":"count","label":"地址总数","method":"calc"},{"key":"exitId","label":"关联出口线路","method":"search"},{"key":"status","label":"状态","method":"readonly"}]'),
('mat_dev', '网络设备与备件', '实物', '设备与备件', 'CPE / 交换机等待库存设备，含板卡光模块', '采购入库', '台',
 '[{"key":"name","label":"设备名称/型号","method":"text"},{"key":"category","label":"设备类别","method":"enum","options":["CPE","光模块","板卡","服务器配件（网卡/HBA）"]},{"key":"costPrice","label":"采购价(元)","method":"text","numeric":true},{"key":"supplier","label":"供应商","method":"search"},{"key":"stock","label":"现存量","method":"calc","dynamic":true},{"key":"locked","label":"锁定量","method":"calc","dynamic":true}]'),
('mat_rack', '机柜与电力', '服务化资源', '机房设施', 'IDC 托管的机柜、电力', '采购入库', '柜', NULL),
('mat_port', '网内端口资源', '服务化资源', '线路资源', '核心网上联端口 / OTN OTU 端口', '采购入库', '个', NULL),
('mat_plat', '平台服务', '服务化资源', '平台与外购服务', 'BGP 调度、监控运维等平台订阅服务', '采购入库', '套', NULL),
('mat_cloud', '云资源', '服务化资源', '平台与外购服务', '云主机 / 节点、云节点设备折旧与软件许可', '采购入库', '节点', NULL),
('mat_svc', '安装调测服务', '人工服务', '交付服务', '交付实施人工投入；布线 / 物流 / 差旅等交付杂项也归这里', NULL, NULL, NULL),
('mat_3rdsvc', '第三方服务订阅', '服务化资源', '平台与外购服务', 'DDoS 清洗、WAF 等外购服务', '采购入库', '套', NULL),
('mat_resale', '转售采购资源', '服务化资源', NULL, '转售业务：运营商线路 / 裸光纤 / 设备批发采购', '采购入库', '条', NULL);
