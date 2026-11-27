package com.dmt.erp.approval.vo;

import com.dmt.erp.approval.entity.AprInstance;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
public class InstanceVo extends AprInstance {
    private String flowName;
    private String docSummary;
    private String submitter;
    private List<NodeVo> nodes;

    @Data
    public static class NodeVo {
        private Integer seq;
        private String name;
        private String approverLabel;
        private String result;
        private String comment;
        private String actedAt;
        private String actor;
        private boolean current;
    }
}
