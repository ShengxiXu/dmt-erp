package com.dmt.erp.sys.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SmsLoginReq {
    @NotBlank
    private String mobile;
    @NotBlank
    private String code;
}
