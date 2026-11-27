package com.dmt.erp.approval.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("apr_writeback")
public class AprWriteback extends BaseEntity {
    private Long instanceId;
    private String hook;
    private String payload;
    private String result;
}
