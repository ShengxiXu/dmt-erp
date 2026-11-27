package com.dmt.erp.fin.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("fin_payment")
public class FinPayment extends BaseEntity {
    private String payNo;
    private Long billId;
    private BigDecimal amount;
    private String method;
    private LocalDateTime paidAt;
    private String source;
    private Long flowId;
}
