package com.dmt.erp.cost.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("cost_sheet_line")
public class CostSheetLine extends BaseEntity {
    private Long sheetId;
    private Long contractLineId;
    private String itemKey;
    private String dept;
    private BigDecimal qty;
    private String meta;
    private BigDecimal amount;
    private String calcText;
    private String pickSpec;
    private String sourceNo;
}
