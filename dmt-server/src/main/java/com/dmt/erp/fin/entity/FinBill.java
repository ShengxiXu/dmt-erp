package com.dmt.erp.fin.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("fin_bill")
public class FinBill extends BaseEntity {
    private String billNo;
    private Long customerId;
    private Long contractId;
    private String period;
    private BigDecimal amount;
    private BigDecimal receivedAmt;
    private String status;
    private String issueStatus;
    private java.time.LocalDateTime issuedAt;
    private String reviewNote;
    private LocalDate dueDate;
}
