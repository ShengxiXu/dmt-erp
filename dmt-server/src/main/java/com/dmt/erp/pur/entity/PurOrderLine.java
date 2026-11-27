package com.dmt.erp.pur.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("pur_order_line")
public class PurOrderLine extends BaseEntity {
    private Long poId;
    private String lineType;
    private String spec;
    private BigDecimal unitPrice;
    private Integer quantity;
    private Integer receivedQty;
    private Integer acceptedQty;
}
