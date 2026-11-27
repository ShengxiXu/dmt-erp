package com.dmt.erp.mdm.vo;

import com.dmt.erp.mdm.entity.MdmEntity;
import com.dmt.erp.mdm.entity.MdmEntitySeal;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
public class EntityVo extends MdmEntity {
    private List<MdmEntitySeal> seals;
}
