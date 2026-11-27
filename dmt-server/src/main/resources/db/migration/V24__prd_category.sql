-- 产品类别独立主数据（此前类别是 prd_product_type.cat 的聚合视图，空类别无法落库、删除类别无服务端语义）
CREATE TABLE prd_category (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(64) NOT NULL,
  sort        INT NOT NULL DEFAULT 0,
  created_by  BIGINT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by  BIGINT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted     TINYINT NOT NULL DEFAULT 0,
  version     INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_prd_category_name (name)
) COMMENT '产品类别';

-- 存量类别去重迁入
INSERT INTO prd_category (name, sort)
SELECT DISTINCT cat, 0 FROM prd_product_type WHERE cat IS NOT NULL AND cat <> '';
