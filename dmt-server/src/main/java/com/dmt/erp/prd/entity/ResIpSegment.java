package com.dmt.erp.prd.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("res_ip_segment")
public class ResIpSegment extends BaseEntity {
    private String seg;
    private Integer count;
    private Long exitId;
    private String status;
}
