package com.dmt.erp.fin.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("fin_claim_alloc")
public class FinClaimAlloc extends BaseEntity {
    private String allocNo;
    private Long flowId;
    private Long billId;
    private Long customerId;
    private BigDecimal amount;
    private String payNo;
    private LocalDateTime claimedAt;
}
