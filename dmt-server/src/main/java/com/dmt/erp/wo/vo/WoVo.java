package com.dmt.erp.wo.vo;

import com.dmt.erp.wo.entity.ResAssignment;
import com.dmt.erp.wo.entity.ResDeductRecord;
import com.dmt.erp.wo.entity.WoTask;
import com.dmt.erp.wo.entity.WoWorkOrder;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
public class WoVo extends WoWorkOrder {
    private String sheetCode;
    private String contractCode;
    private String customerName;
    private List<WoTask> tasks;
    private List<AssignmentVo> assignments;
    private List<ResDeductRecord> deductRecords;

    @Data
    public static class AssignmentVo extends ResAssignment {
        private String refName;
    }
}
