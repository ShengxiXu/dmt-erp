package com.dmt.erp.approval.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ActReq {
    @NotNull
    private Boolean approve;
    private String comment;
}
