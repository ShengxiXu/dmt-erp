package com.dmt.erp.pur.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("pur_contract")
public class PurContract extends BaseEntity {
    private String code;
    private Long buyerId;
    private String name;
    private String supplier;
    private String subject;
    private String billing;
    private Integer capacityM;
    private BigDecimal monthlyCost;
    private Integer bwM;
    private BigDecimal linePrice;
    private BigDecimal unitPrice;
    private LocalDate effectAt;
    private LocalDate endAt;
    private String status;
    private String attachments;
    private String remark;
}
