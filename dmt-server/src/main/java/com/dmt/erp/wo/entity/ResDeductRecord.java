package com.dmt.erp.wo.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("res_deduct_record")
public class ResDeductRecord extends BaseEntity {
    private Long assignmentId;
    private Long refId;
    private Integer beforeQty;
    private Integer afterQty;
    private Long actedBy;
    private LocalDateTime actedAt;
}
