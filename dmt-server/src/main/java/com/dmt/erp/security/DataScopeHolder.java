package com.dmt.erp.security;

public final class DataScopeHolder {

    private static final ThreadLocal<Scope> CURRENT = new ThreadLocal<>();

    public record Scope(String table, String fragment) {
    }

    private DataScopeHolder() {
    }

    public static void set(Scope scope) {
        CURRENT.set(scope);
    }

    public static Scope get() {
        return CURRENT.get();
    }

    public static void clear() {
        CURRENT.remove();
    }
}
