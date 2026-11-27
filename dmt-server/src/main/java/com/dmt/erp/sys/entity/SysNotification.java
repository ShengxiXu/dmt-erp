package com.dmt.erp.sys.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_notification")
public class SysNotification extends BaseEntity {
    private Long userId;
    private String type;
    private String title;
    private String content;
    private Integer isRead;
    private String refType;
    private Long refId;
}
