package com.dmt.erp.wo.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("wo_task")
public class WoTask extends BaseEntity {
    private Long woId;
    private String name;
    private Integer sort;
    private Integer done;
}
