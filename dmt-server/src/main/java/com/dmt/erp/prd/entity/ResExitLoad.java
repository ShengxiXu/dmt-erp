package com.dmt.erp.prd.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("res_exit_load")
public class ResExitLoad extends BaseEntity {
    private Long exitId;
    private LocalDateTime measuredAt;
    private Integer usedM;
    private Long measuredBy;
}
