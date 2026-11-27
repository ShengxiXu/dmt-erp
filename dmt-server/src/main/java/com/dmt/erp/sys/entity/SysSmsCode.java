package com.dmt.erp.sys.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_sms_code")
public class SysSmsCode extends BaseEntity {
    private String mobile;
    private String code;
    private String scene;
    private LocalDateTime expireAt;
    private Integer used;
}
