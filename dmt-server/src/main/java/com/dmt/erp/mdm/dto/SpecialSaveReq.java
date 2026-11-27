package com.dmt.erp.mdm.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class SpecialSaveReq {
    private Long id;
    @NotNull(message = "必须挂商机")
    private Long opportunityId;
    @NotNull(message = "客户不能为空")
    private Long customerId;
    @NotNull(message = "折扣率不能为空")
    private BigDecimal discount;
    private BigDecimal expectAmount;
    private String reason;
}
