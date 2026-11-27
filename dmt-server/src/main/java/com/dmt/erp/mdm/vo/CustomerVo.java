package com.dmt.erp.mdm.vo;

import com.dmt.erp.mdm.entity.MdmCustomer;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class CustomerVo extends MdmCustomer {
    private String salesName;
}
