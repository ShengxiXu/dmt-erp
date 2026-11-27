package com.dmt.erp.mdm.vo;

import com.dmt.erp.mdm.entity.MdmSpecial;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class SpecialVo extends MdmSpecial {
    private String opportunityName;
    private String customerName;
}
