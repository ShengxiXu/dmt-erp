package com.dmt.erp.prd.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class TypeSaveReq {
    private Long id;
    @NotBlank(message = "产品大类不能为空")
    private String cat;
    @NotBlank(message = "产品名称不能为空")
    private String name;
    private String status;
    private String remark;
    private String sla;
    private String billingCycle;
    private String taxRate;
    private String leadTime;
    private String specFieldsJson;
    private String plansJson;
    private String centersJson;
    private String directOffJson;
    @Valid
    private List<MaterialReq> materials;

    @Data
    public static class MaterialReq {
        private String materialKey;
        private Integer qty;
        private String remark;
    }
}
