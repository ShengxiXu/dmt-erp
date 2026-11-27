package com.dmt.erp.mdm.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("mdm_opportunity")
public class MdmOpportunity extends BaseEntity {
    private String code;
    private Long customerId;
    private String name;
    private String stage;
    private String source;
    private String productsJson;
    private String remark;
    private BigDecimal expectAmount;
    private Integer expectMonths;
    private LocalDate expectedCloseAt;
    private Long salesId;
}
