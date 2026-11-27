package com.dmt.erp.cost.vo;

import com.dmt.erp.cost.entity.CostSheet;
import com.dmt.erp.cost.entity.CostSheetLine;
import com.dmt.erp.mdm.entity.MdmContractLine;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
public class SheetVo extends CostSheet {
    private String contractCode;
    private String customerName;
    private String opportunityName;
    private List<CostSheetLine> opsLines;
    private List<CostSheetLine> techLines;
    private List<MdmContractLine> contractLines;
}
