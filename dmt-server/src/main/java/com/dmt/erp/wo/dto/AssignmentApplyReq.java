package com.dmt.erp.wo.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class AssignmentApplyReq {

    @Valid
    private List<Item> items;

    @Data
    public static class Item {
        @NotBlank(message = "资源类型不能为空")
        private String kind;
        @NotNull(message = "关联资源不能为空")
        private Long refId;
        @NotNull(message = "数量不能为空")
        private Integer qty;
    }
}
