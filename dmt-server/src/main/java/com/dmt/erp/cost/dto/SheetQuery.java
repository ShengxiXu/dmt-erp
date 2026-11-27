package com.dmt.erp.cost.dto;

import lombok.Data;

@Data
public class SheetQuery {
    private long pageNum = 1;
    private long pageSize = 10;
    private String kw;
    private String status;
    /** 1 = 只看待发起审批（两部门都已提交） */
    private Integer pending;
}
