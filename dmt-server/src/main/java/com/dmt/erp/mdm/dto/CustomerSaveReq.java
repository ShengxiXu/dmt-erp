package com.dmt.erp.mdm.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CustomerSaveReq {
    private Long id;
    @NotBlank(message = "客户名称不能为空")
    private String name;
    private String creditCode;
    private String level;
    private String industry;
    private String source;
    private String address;
    private String invoiceTitle;
    private String taxNo;
    private String contact;
    private String contactPhone;
    private String contactTitle;
    private String email;
    private String remark;
    private String status;
}
