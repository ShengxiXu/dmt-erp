package com.dmt.erp.mdm.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class OpportunitySaveReq {
    private Long id;
    @NotNull(message = "客户不能为空")
    private Long customerId;
    @NotBlank(message = "商机名称不能为空")
    private String name;
    private String stage;
    private String source;
    private String remark;
    private List<ProductReq> products;
    private BigDecimal expectAmount;
    private Integer expectMonths;
    private LocalDate expectedCloseAt;
    @Data
    public static class ProductReq {
        private String cat;
        private String ptype;
    }
}
