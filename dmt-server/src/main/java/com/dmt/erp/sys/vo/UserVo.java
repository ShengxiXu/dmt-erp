package com.dmt.erp.sys.vo;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

@Data
public class UserVo implements Serializable {
    private Long id;
    private String username;
    private String name;
    private String mobile;
    private Long deptId;
    private String deptName;
    private String status;
    private List<Long> roleIds;
    private List<String> roleNames;
}
