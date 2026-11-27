package com.dmt.erp.mdm.vo;

import com.dmt.erp.mdm.entity.MdmContract;
import com.dmt.erp.mdm.entity.MdmContractLine;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;
import java.util.Map;

import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
public class ContractVo extends MdmContract {
    private String customerName;
    private String opportunityName;
    private String entityName;
    private java.math.BigDecimal monthlyFee;
    private String linesSummary;
    private List<MdmContractLine> lines;
    private List<Map<String, Object>> versions;
}
