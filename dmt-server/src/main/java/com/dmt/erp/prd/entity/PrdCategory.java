package com.dmt.erp.prd.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

/** 产品类别（独立主数据：空类别可存在，类型的 cat 存类别名） */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prd_category")
public class PrdCategory extends BaseEntity {
    private String name;
    private Integer sort;
}
