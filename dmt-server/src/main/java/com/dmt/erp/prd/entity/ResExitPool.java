package com.dmt.erp.prd.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("res_exit_pool")
public class ResExitPool extends BaseEntity {
    private String code;
    private String name;
    private String product;
    private Integer capacityM;
    private Integer usedM;
    private BigDecimal rentMonth;
    private String status;
}
