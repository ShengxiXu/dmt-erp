package com.dmt.erp.approval.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("apr_flow_node")
public class AprFlowNode extends BaseEntity {
    private Long flowId;
    private Integer seq;
    private String name;
    private String approverType;
    private String approverRef;
}
