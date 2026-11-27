package com.dmt.erp.security;

import io.jsonwebtoken.Claims;
import lombok.Getter;

import java.util.Optional;

@Getter
public class LoginUser {

    public enum DataScope { ALL, DEPT, SELF }

    private final Long userId;
    private final String username;
    private final Long deptId;
    private final DataScope dataScope;

    public LoginUser(Long userId, String username, Claims claims) {
        this.userId = userId;
        this.username = username;
        this.deptId = toLong(claims.get("deptId"));
        this.dataScope = parseScope(claims.get("dataScope"));
    }

    private static Long toLong(Object v) {
        return v == null ? null : Long.valueOf(String.valueOf(v));
    }

    private static DataScope parseScope(Object v) {
        return Optional.ofNullable(v).map(String::valueOf).map(String::toUpperCase)
                .map(DataScope::valueOf).orElse(DataScope.SELF);
    }
}
