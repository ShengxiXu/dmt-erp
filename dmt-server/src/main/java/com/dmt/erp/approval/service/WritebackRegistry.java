package com.dmt.erp.approval.service;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiConsumer;
import java.util.function.Function;

/**
 * 写回钩子注册表（契约 §4.3 注册式）：业务模块在构造时注册
 * 单据通过/驳回后的写回动作与重新提交时的表单取数器；
 * 审批引擎只依赖本注册表，不反向依赖业务模块，避免循环依赖。
 */
@Component
public class WritebackRegistry {

    /** docType → (docId, pass) -> void */
    private final Map<String, BiConsumer<Long, Boolean>> hooks = new ConcurrentHashMap<>();
    /** docType → 重新提交时按单据取表单数据（分支条件重算） */
    private final Map<String, Function<Long, Map<String, Object>>> formProviders = new ConcurrentHashMap<>();
    /** docType → 实例列表展示用的单据摘要 */
    private final Map<String, Function<Long, String>> docSummaries = new ConcurrentHashMap<>();

    public void register(String docType, BiConsumer<Long, Boolean> hook,
                         Function<Long, Map<String, Object>> formProvider,
                         Function<Long, String> docSummary) {
        hooks.put(docType, hook);
        if (formProvider != null) {
            formProviders.put(docType, formProvider);
        }
        if (docSummary != null) {
            docSummaries.put(docType, docSummary);
        }
    }

    public BiConsumer<Long, Boolean> hook(String docType) {
        return hooks.get(docType);
    }

    public Function<Long, Map<String, Object>> formProvider(String docType) {
        return formProviders.get(docType);
    }

    public String summary(String docType, Long docId) {
        Function<Long, String> f = docSummaries.get(docType);
        return f == null ? String.valueOf(docId) : f.apply(docId);
    }
}
