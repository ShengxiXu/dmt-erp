package com.dmt.erp.mdm.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("mdm_entity_seal")
public class MdmEntitySeal extends BaseEntity {
    private Long entityId;
    private String name;
    private String type;
    private String sealNo;
}
