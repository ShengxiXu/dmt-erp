package com.dmt.erp.lc.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

/** 订阅变更申请：审批通过即生效（订阅行/月租更新，生效账期起按新价出账） */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("lc_change")
public class LcChange extends BaseEntity {
    private String chNo;
    private Long contractId;
    private Long lineId;
    private String customer;
    private String contractNo;
    private String type;
    private String fromVal;
    private String toVal;
    private BigDecimal monthlyFeeAfter;
    private BigDecimal costDelta;
    private String costBasis;
    private String effective;
    private String reason;
    private String status;
    private String rejectNote;
}
