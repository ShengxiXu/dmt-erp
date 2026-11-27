package com.dmt.erp.common;

import java.util.function.Supplier;

public final class CodeGen {

    private CodeGen() {
    }

    /** 按前缀续号：取当前最大编码 +1，格式 prefix + 4 位序号 */
    public static String next(Supplier<String> lastCodeSupplier, String prefix) {
        String last = lastCodeSupplier.get();
        int seq = 1;
        if (last != null && last.startsWith(prefix)) {
            try {
                seq = Integer.parseInt(last.substring(prefix.length())) + 1;
            } catch (NumberFormatException ignored) {
            }
        }
        return prefix + String.format("%04d", seq);
    }
}
