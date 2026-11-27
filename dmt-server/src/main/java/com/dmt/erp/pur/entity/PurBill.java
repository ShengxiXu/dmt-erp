package com.dmt.erp.pur.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;

/** 供应商账单：采购侧真实支出凭证，费用归类=成本条目 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("pur_bill")
public class PurBill extends BaseEntity {
    private String billNo;
    private String supplier;
    private String period;
    private Long costItemId;
    private BigDecimal amount;
    private String poNo;
    private String contractNo;
    private String resRef;
    private String status;
    private String tag;
    private LocalDate payDueDate;
    private String note;

    /** 派生：被核算行引用次数（cost_sheet_line.source_no = 账单号） */
    @com.baomidou.mybatisplus.annotation.TableField(exist = false)
    private Long refCount;
}
