package com.dmt.erp.prd.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("res_equipment")
public class ResEquipment extends BaseEntity {
    private String name;
    private String category;
    private BigDecimal costPrice;
    private String supplier;
    private Integer stock;
    private Integer locked;
}
