package com.dmt.erp.prd.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prd_price_dict")
public class PrdPriceDict extends BaseEntity {
    private String dictKey;
    private String role;
    private BigDecimal rate;
    private LocalDate effectAt;
    private String status;
    private String remark;
}
