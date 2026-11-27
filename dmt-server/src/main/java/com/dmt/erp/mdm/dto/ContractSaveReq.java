package com.dmt.erp.mdm.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class ContractSaveReq {
    private Long id;
    @NotNull(message = "客户不能为空")
    private Long customerId;
    @NotNull(message = "商机不能为空")
    private Long opportunityId;
    private Long specialId;
    @NotNull(message = "签约主体不能为空")
    private Long entityId;
    private BigDecimal discount;
    private String payCycle;
    private String seal;
    private String terms;
    private String status;
    private String reviseNote;
    private LocalDate startDate;
    private LocalDate endDate;
    private BigDecimal amount;
    @Valid
    private List<ContractLineReq> lines;

    @Data
    public static class ContractLineReq {
        private Long id;
        private String cat;
        private String ptype;
        private String spec;
        private java.util.Map<String, String> specs;
        private BigDecimal price;
        private String specsJson;
    }
}
