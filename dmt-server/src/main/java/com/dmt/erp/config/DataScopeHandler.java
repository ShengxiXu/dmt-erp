package com.dmt.erp.config;

import com.baomidou.mybatisplus.extension.plugins.handler.DataPermissionHandler;
import com.dmt.erp.security.DataScopeHolder;
import lombok.extern.slf4j.Slf4j;
import net.sf.jsqlparser.expression.Expression;
import net.sf.jsqlparser.expression.operators.conditional.AndExpression;
import net.sf.jsqlparser.parser.CCJSqlParserUtil;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * 数据权限拦截处理器：按目标表匹配消费 DataScopeAspect 写入的过滤片段。
 * 表名从 mappedStatementId 约定解析（XxxMapper → xxx 物理表），
 * 与注解声明的表一致才拼入 WHERE，避免同方法内联查其它表被误伤。
 */
@Slf4j
@Component
public class DataScopeHandler implements DataPermissionHandler {

    @Override
    public Expression getSqlSegment(Expression where, String mappedStatementId) {
        DataScopeHolder.Scope scope = DataScopeHolder.get();
        if (scope == null || scope.fragment() == null || scope.fragment().isBlank()) {
            return where;
        }
        if (!scope.table().equalsIgnoreCase(resolveTable(mappedStatementId))) {
            return where;
        }
        try {
            Expression scoped = CCJSqlParserUtil.parseCondExpression(scope.fragment());
            return where == null ? scoped : new AndExpression(where, scoped);
        } catch (Exception e) {
            log.error("parse data scope fragment failed: {}", scope.fragment(), e);
            return where;
        }
    }

    /** com.dmt.erp.mdm.mapper.MdmCustomerMapper.selectPage[_mpCount] → mdm_customer */
    static String resolveTable(String mappedStatementId) {
        int dot = mappedStatementId.lastIndexOf('.');
        if (dot < 0) {
            return mappedStatementId;
        }
        String head = mappedStatementId.substring(0, dot);
        int dot2 = head.lastIndexOf('.');
        String mapper = dot2 < 0 ? head : head.substring(dot2 + 1);
        if (mapper.endsWith("Mapper")) {
            mapper = mapper.substring(0, mapper.length() - "Mapper".length());
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < mapper.length(); i++) {
            char c = mapper.charAt(i);
            if (Character.isUpperCase(c) && i > 0) {
                sb.append('_');
            }
            sb.append(Character.toLowerCase(c));
        }
        return sb.toString().toLowerCase(Locale.ROOT);
    }
}
