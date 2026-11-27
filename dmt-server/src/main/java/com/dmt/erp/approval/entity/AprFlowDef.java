package com.dmt.erp.approval.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("apr_flow_def")
public class AprFlowDef extends BaseEntity {
    private String name;
    private String docType;
    private String triggerAction;
    private String conditionExpr;
    private Integer enabled;
}
