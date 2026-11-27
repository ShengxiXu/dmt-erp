package com.dmt.erp.prd.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("cost_item")
public class CostItem extends BaseEntity {
    private String itemKey;
    private String name;
    private String category;
    private String sourceArchive;
    private String dept;
    private String costType;
    private String unit;
    private String subject;
    private String requiredFlag;
    private String remark;
    private String calcKind;
    private String calcMethod;
    private String calcParams;
    private String appliesTo;
    private String settleType;
    private String formula;
    private String costCenter;
    private BigDecimal demoQty;
    private String status;

    /** 派生：被装配数（产品组成引用本条目「适用资源」的类型数） */
    @com.baomidou.mybatisplus.annotation.TableField(exist = false)
    private Long refCount;

    /** 可增补产品类别（cost_item_category 绑定，受控增补范围） */
    @com.baomidou.mybatisplus.annotation.TableField(exist = false)
    private java.util.List<String> cats;
}
