package com.dmt.erp.sys.vo;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.io.Serializable;
import java.util.Map;

@Data
@AllArgsConstructor
public class LoginVo implements Serializable {
    private String accessToken;
    private Map<String, Object> user;
}
