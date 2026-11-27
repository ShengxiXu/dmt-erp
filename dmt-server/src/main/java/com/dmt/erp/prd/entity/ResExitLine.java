package com.dmt.erp.prd.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("res_exit_line")
public class ResExitLine extends BaseEntity {
    private String code;
    private String name;
    private String carrier;
    private Integer bandwidthM;
    private BigDecimal costMonth;
    private String ipSegment;
    private String status;

    /** ②层派生：已售带宽（资源分配聚合，不落库） */
    @com.baomidou.mybatisplus.annotation.TableField(exist = false)
    private java.math.BigDecimal soldM;
}
