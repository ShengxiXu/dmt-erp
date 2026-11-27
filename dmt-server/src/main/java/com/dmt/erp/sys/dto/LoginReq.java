package com.dmt.erp.sys.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginReq {
    @NotBlank
    private String username;
    @NotBlank
    private String password;
}
