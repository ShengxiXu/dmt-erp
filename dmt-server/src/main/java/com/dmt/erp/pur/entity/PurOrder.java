package com.dmt.erp.pur.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("pur_order")
public class PurOrder extends BaseEntity {
    private String poNo;
    private String supplier;
    private BigDecimal taxRate;
    private String paymentTerms;
    private String status;
    private String rejectReason;
    private Long contractId;
}
