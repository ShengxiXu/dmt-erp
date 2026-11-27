package com.dmt.erp.cost.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("cost_sign_snapshot")
public class CostSignSnapshot extends BaseEntity {
    private Long sheetId;
    private String snapshotJson;
    private String lockedAt;
}
