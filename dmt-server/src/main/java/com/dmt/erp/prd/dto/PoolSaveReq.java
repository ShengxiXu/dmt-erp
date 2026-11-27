package com.dmt.erp.prd.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class PoolSaveReq {
    private Long id;
    @NotBlank(message = "池编码不能为空")
    private String code;
    @NotBlank(message = "池名称不能为空")
    private String name;
    private String product;
    private Integer capacityM;
    private Integer usedM;
    private BigDecimal rentMonth;
    private String status;
    @Valid
    private List<MemberReq> members;

    @Data
    public static class MemberReq {
        private Long exitId;
        private Integer weight;
    }
}
