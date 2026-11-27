package com.dmt.erp.pur.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("pur_req")
public class PurReq extends BaseEntity {
    private String reqNo;
    private String source;
    private String matKey;
    private String spec;
    private BigDecimal qty;
    private String unit;
    private String room;
    private LocalDate expectDate;
    private String note;
    private String status;
    private Long linkedWoId;
    private Long poId;
    private Long contractId;
}
