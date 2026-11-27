package com.dmt.erp.approval.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("apr_instance")
public class AprInstance extends BaseEntity {
    private Long flowId;
    private String docType;
    private Long docId;
    private String status;
    private Integer curSeq;
}
