package com.dmt.erp.mdm.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("mdm_customer")
public class MdmCustomer extends BaseEntity {
    private String name;
    private String creditCode;
    private String level;
    private String industry;
    private String source;
    private String address;
    private String invoiceTitle;
    private String taxNo;
    private Long salesId;
    private String contact;
    private String contactPhone;
    private String contactTitle;
    private String email;
    private String remark;
    private String status;
}
