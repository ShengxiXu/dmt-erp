package com.dmt.erp.prd.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prd_type_material")
public class PrdTypeMaterial extends BaseEntity {
    private Long typeId;
    private String materialKey;
    private Integer qty;
    private String remark;
}
