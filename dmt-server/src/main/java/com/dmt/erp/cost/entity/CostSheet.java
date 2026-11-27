package com.dmt.erp.cost.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("cost_sheet")
public class CostSheet extends BaseEntity {
    private String code;
    private Long contractId;
    private Long customerId;
    private String status;
    private Integer opsDone;
    private Integer techDone;
    private String curNode;
    private BigDecimal margin;
    private BigDecimal monthlyCost;
    private BigDecimal contractValue;
    private Integer changeVersion;
}
