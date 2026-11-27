package com.dmt.erp.prd.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("res_pool_exit")
public class ResPoolExit extends BaseEntity {
    private Long poolId;
    private Long exitId;
    private Integer weight;
}
