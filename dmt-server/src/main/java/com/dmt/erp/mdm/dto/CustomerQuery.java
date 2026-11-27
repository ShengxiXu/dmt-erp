package com.dmt.erp.mdm.dto;

import lombok.Data;

@Data
public class CustomerQuery {
    private long pageNum = 1;
    private long pageSize = 10;
    private String kw;
    private String level;
    private String status;
}
