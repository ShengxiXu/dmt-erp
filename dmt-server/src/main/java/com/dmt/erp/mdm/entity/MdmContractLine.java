package com.dmt.erp.mdm.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("mdm_contract_line")
public class MdmContractLine extends BaseEntity {
    private Long contractId;
    private String cat;
    private String ptype;
    private String spec;
    private BigDecimal price;
    private String specsJson;
}
