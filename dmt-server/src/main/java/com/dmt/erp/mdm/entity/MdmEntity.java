package com.dmt.erp.mdm.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("mdm_entity")
public class MdmEntity extends BaseEntity {
    private String shortName;
    private String fullName;
    private String nature;
    private String taxNo;
    private String bank;
    private String account;
    private String status;
}
