package com.dmt.erp.mdm.entity;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("mdm_contract")
public class MdmContract extends BaseEntity {
    private String code;
    private Long customerId;
    private Long opportunityId;
    private Long specialId;
    private Long entityId;
    private BigDecimal discount;
    private String payCycle;
    private String seal;
    private String terms;
    private String versionsJson;
    private LocalDate startDate;
    private LocalDate endDate;
    private BigDecimal amount;
    private String status;
    private Integer step;
    @TableField(value = "active_opp_key", insertStrategy = FieldStrategy.NEVER, updateStrategy = FieldStrategy.NEVER)
    private String activeOppKey;
}
