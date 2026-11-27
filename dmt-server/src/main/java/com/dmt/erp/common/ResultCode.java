package com.dmt.erp.common;

import lombok.Getter;

@Getter
public enum ResultCode {

    SUCCESS(0, "ok"),
    PARAM_INVALID(1001, "参数校验失败"),
    UNAUTHENTICATED(2001, "未认证或登录已过期"),
    FORBIDDEN(2002, "无权限"),
    STATE_CONFLICT(3001, "状态冲突"),
    BIZ_RULE_VIOLATION(3002, "业务规则拦截"),
    INSUFFICIENT_STOCK(3003, "库存/余量不足"),
    SYSTEM_ERROR(5000, "系统异常");

    private final int code;
    private final String message;

    ResultCode(int code, String message) {
        this.code = code;
        this.message = message;
    }
}
