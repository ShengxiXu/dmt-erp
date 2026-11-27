package com.dmt.erp.sys.vo;

import lombok.Data;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

@Data
public class ProfileVo implements Serializable {
    private Map<String, Object> user;
    private List<String> roles;
    private List<String> perms;
}
