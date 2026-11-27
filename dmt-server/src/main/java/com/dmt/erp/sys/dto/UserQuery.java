package com.dmt.erp.sys.dto;

import lombok.Data;

@Data
public class UserQuery {
    private long pageNum = 1;
    private long pageSize = 10;
    private String kw;
    private Long deptId;
}
