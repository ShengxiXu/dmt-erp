package com.dmt.erp.fin.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("fin_pay_request")
public class FinPayRequest extends BaseEntity {
    private String reqNo;
    private String payee;
    private BigDecimal amount;
    private String reason;
    private String status;
}
