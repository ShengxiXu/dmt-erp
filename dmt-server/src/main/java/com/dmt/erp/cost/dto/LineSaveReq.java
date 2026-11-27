package com.dmt.erp.cost.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class LineSaveReq {

    @NotBlank(message = "部门不能为空")
    private String dept;

    @Valid
    @NotEmpty(message = "条目行不能为空")
    private List<LineReq> lines;

    @Data
    public static class LineReq {
        private Long contractLineId;
        @NotBlank(message = "条目 key 不能为空")
        private String itemKey;
        private BigDecimal qty;
        private String meta;
        private BigDecimal amount;
        private String calcText;
        private String pickSpec;
    }
}
