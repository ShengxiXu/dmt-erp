package com.dmt.erp.fin.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("fin_settle_record")
public class FinSettleRecord extends BaseEntity {
    private String batchNo;
    private String period;
    private String snapshotJson;
}
