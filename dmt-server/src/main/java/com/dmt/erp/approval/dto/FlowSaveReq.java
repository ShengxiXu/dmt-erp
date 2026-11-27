package com.dmt.erp.approval.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class FlowSaveReq {
    private Long id;
    @NotBlank(message = "流程名称不能为空")
    private String name;
    @NotBlank(message = "单据类型不能为空")
    private String docType;
    @NotBlank(message = "触发动作不能为空")
    private String triggerAction;
    private String conditionExpr;
    private Integer enabled;
    @Valid
    private List<NodeReq> nodes;

    @Data
    public static class NodeReq {
        private Integer seq;
        @NotBlank(message = "节点名称不能为空")
        private String name;
        @NotBlank(message = "审批人类型不能为空")
        private String approverType;
        private String approverRef;
    }
}
