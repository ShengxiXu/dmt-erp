package com.dmt.erp.fin.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("fin_invoice_app")
public class FinInvoiceApp extends BaseEntity {
    private String appNo;
    private Long entityId;
    private Long customerId;
    private BigDecimal amount;
    private String title;
    private String taxNo;
    private String status;
}
