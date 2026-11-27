package com.dmt.erp.fin.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("fin_bank_flow")
public class FinBankFlow extends BaseEntity {
    private String flowNo;
    private LocalDateTime arrivedAt;
    private String payer;
    private BigDecimal amount;
    private String method;
    private String referenceNo;
    private String status;
    private BigDecimal claimedAmt;
    private String note;
}
