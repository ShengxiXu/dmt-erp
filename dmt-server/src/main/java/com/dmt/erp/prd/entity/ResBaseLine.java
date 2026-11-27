package com.dmt.erp.prd.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;

/** R2 基础线路档案：接入端线路，可跨产品共用不重复采购 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("res_base_line")
public class ResBaseLine extends BaseEntity {
    private String code;
    private String name;
    private String carrier;
    private Integer bwM;
    private String billing;
    private BigDecimal price;
    private String contractNo;
    private String shareable;
    private LocalDate effect;
    private String status;
}
