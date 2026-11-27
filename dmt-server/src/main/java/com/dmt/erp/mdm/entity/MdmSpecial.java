package com.dmt.erp.mdm.entity;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("mdm_special")
public class MdmSpecial extends BaseEntity {
    private String code;
    private Long opportunityId;
    private Long customerId;
    private BigDecimal discount;
    private BigDecimal expectAmount;
    private String reason;
    private String status;
    @TableField(value = "active_opp_key", insertStrategy = FieldStrategy.NEVER, updateStrategy = FieldStrategy.NEVER)
    private String activeOppKey;
}
