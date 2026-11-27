package com.dmt.erp.sys.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.dmt.erp.common.BaseEntity;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_user")
public class SysUser extends BaseEntity {
    private String username;
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String passwordHash;
    private String name;
    private String mobile;
    private Long deptId;
    private String status;
}
