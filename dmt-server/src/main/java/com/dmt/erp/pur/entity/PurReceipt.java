package com.dmt.erp.pur.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("pur_receipt")
public class PurReceipt extends BaseEntity {
    private Long poId;
    private Integer batchNo;
    private Long operator;
    private String itemsJson;
}
