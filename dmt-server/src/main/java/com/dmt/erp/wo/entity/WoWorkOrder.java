package com.dmt.erp.wo.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("wo_work_order")
public class WoWorkOrder extends BaseEntity {
    private String code;
    private Long sheetId;
    private Long contractId;
    private String status;
    private Long linkedPurchaseReq;
    private String deliverySnapshot;
    private java.time.LocalDate deadline;
    private String owner;
}
