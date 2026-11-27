package com.dmt.erp.fin.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

/** 坏账申请：管理层审批通过 → 账单置坏账 → 关联合同在网订阅自动发起退订 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("fin_bad_debt")
public class FinBadDebt extends BaseEntity {
    private String bdNo;
    private Long billId;
    private String billNo;
    private String customer;
    private BigDecimal amount;
    private String reason;
    private String handling;
    private String status;
    private String rejectNote;
}
