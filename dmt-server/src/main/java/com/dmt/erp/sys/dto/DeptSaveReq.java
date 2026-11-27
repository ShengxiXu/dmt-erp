package com.dmt.erp.sys.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DeptSaveReq {
    private Long id;
    @NotBlank
    private String name;
    private Long parentId;
}
