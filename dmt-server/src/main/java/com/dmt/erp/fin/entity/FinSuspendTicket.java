package com.dmt.erp.fin.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/** 停机复机工单：停机由欠费行生成；复机仅由足额收讫自动触发 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("fin_suspend_ticket")
public class FinSuspendTicket extends BaseEntity {
    private String ticketNo;
    private String type;
    private Long billId;
    private String billNo;
    private String customer;
    private Long contractId;
    private String debtSummary;
    private String reason;
    private String status;
    private String action;
    private String result;
    private String note;
    private LocalDateTime executedAt;
}
