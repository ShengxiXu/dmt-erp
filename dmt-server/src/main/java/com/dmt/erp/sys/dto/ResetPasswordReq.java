package com.dmt.erp.sys.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ResetPasswordReq {
    @NotBlank
    @Size(min = 6, max = 64, message = "密码长度 6-64 位")
    private String password;
}
