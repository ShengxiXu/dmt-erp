package com.dmt.erp.security;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.annotation.After;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.springframework.stereotype.Component;

/**
 * 数据范围切面（契约 §3.3）：ALL 不加条件；SELF → ownerColumn = 当前人；
 * DEPT → ownerColumn IN (本部门人员)。片段交给 DataScopeHolder，
 * 由 MyBatis-Plus 数据权限拦截器拼入查询 WHERE。
 */
@Slf4j
@Aspect
@Component
public class DataScopeAspect {

    @Before("@annotation(dataScope)")
    public void before(DataScope dataScope) {
        LoginUser user = SecurityUtils.currentUser().orElse(null);
        if (user == null || user.getDataScope() == LoginUser.DataScope.ALL) {
            return;
        }
        String column = dataScope.ownerColumn();
        String fragment = switch (user.getDataScope()) {
            case DEPT -> column + " IN (SELECT id FROM sys_user WHERE dept_id = " + user.getDeptId() + " AND deleted = 0)";
            default -> column + " = " + user.getUserId();
        };
        log.debug("data scope sql: {} on {}", fragment, dataScope.table());
        DataScopeHolder.set(new DataScopeHolder.Scope(dataScope.table(), fragment));
    }

    @After("@annotation(dataScope)")
    public void after(DataScope dataScope) {
        DataScopeHolder.clear();
    }
}
