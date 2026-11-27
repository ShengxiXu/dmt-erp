package com.dmt.erp.sys.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class UserSaveReq {
    private Long id;
    @NotBlank
    private String username;
    private String name;
    private String mobile;
    private Long deptId;
    private String status;
    private List<Long> roleIds;
    private String initialPassword;
}
