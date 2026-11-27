package com.dmt.erp.mdm.dto;

import lombok.Data;

@Data
public class OpportunityQuery {
    private long pageNum = 1;
    private long pageSize = 10;
    private String kw;
    private String stage;
    private Long customerId;
}
