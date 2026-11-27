package com.dmt.erp.wo.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("res_assignment")
public class ResAssignment extends BaseEntity {
    private Long woId;
    private String kind;
    private Long refId;
    private Integer qty;
    private String status;
}
