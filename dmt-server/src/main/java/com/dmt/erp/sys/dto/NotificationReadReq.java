package com.dmt.erp.sys.dto;

import lombok.Data;

import java.util.List;

@Data
public class NotificationReadReq {
    private List<Long> ids;
    private boolean all;
}
