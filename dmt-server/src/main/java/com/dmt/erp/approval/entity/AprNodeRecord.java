package com.dmt.erp.approval.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("apr_node_record")
public class AprNodeRecord extends BaseEntity {
    private Long instanceId;
    private Integer seq;
    private Long approverId;
    private String result;
    private String comment;
    private LocalDateTime actedAt;
}
