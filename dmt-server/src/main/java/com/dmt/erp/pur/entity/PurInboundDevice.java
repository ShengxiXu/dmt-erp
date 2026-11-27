package com.dmt.erp.pur.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("pur_inbound_device")
public class PurInboundDevice extends BaseEntity {
    private Long poId;
    private String assetNo;
    private String sn;
    private String brand;
    private String model;
    private LocalDate warrantyEnd;
}
