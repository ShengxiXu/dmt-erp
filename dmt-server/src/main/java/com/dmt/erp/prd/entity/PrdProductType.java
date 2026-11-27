package com.dmt.erp.prd.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prd_product_type")
public class PrdProductType extends BaseEntity {
    private String cat;
    private String name;
    private String status;
    private String remark;
    private String sla;
    private String billingCycle;
    private String taxRate;
    private String leadTime;
    private String specFieldsJson;
    private String plansJson;
    private String centersJson;
    private String directOffJson;
    private Integer asmVersion;
    private String asmHistoryJson;
    @com.baomidou.mybatisplus.annotation.TableField(exist = false)
    private java.util.List<java.util.Map<String, Object>> specFields;
    @com.baomidou.mybatisplus.annotation.TableField(exist = false)
    private java.util.List<java.util.Map<String, Object>> plans;
}
