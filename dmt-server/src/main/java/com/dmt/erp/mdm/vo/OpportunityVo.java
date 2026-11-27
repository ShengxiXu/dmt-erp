package com.dmt.erp.mdm.vo;

import com.dmt.erp.mdm.entity.MdmOpportunity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
public class OpportunityVo extends MdmOpportunity {
    private String customerName;
    private String salesName;
    private List<Map<String, Object>> products;
}
