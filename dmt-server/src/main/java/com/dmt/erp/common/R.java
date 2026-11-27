package com.dmt.erp.common;

import lombok.Data;

import java.io.Serializable;

@Data
public class R<T> implements Serializable {

    private int code;
    private String message;
    private T data;

    public static <T> R<T> ok(T data) {
        R<T> r = new R<>();
        r.code = ResultCode.SUCCESS.getCode();
        r.message = "ok";
        r.data = data;
        return r;
    }

    public static R<Void> ok() {
        return ok(null);
    }

    public static <T> R<T> error(ResultCode rc) {
        return error(rc, rc.getMessage());
    }

    public static <T> R<T> error(ResultCode rc, String message) {
        R<T> r = new R<>();
        r.code = rc.getCode();
        r.message = message;
        return r;
    }
}
