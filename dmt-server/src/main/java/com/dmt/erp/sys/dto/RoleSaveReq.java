package com.dmt.erp.sys.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class RoleSaveReq {
    private Long id;
    @NotBlank
    private String code;
    @NotBlank
    private String name;
    @NotBlank
    private String dataScope;
    private List<Long> menuIds;
}
