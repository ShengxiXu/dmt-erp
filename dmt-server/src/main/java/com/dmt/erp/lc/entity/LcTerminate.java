package com.dmt.erp.lc.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 退订申请：审批通过 → 退订生效（停止出账）→ 自动生成回收任务（待执行 → 已完工） */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("lc_terminate")
public class LcTerminate extends BaseEntity {
    private String tmNo;
    private Long contractId;
    private Long lineId;
    private String customer;
    private String contractNo;
    private String reason;
    private String reasonText;
    private String effectivePeriod;
    private BigDecimal penalty;
    private String penaltyBasis;
    private String status;
    private String rejectNote;
    private String recoverStatus;
    private String recoverNote;
    private String followStatus;
    private String followNote;
    private LocalDateTime executedAt;
}
