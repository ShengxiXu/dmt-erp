package com.dmt.erp.security;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 数据范围声明（契约 §3.3 自定义数据范围切面）：加在 Service 查询方法上，
 * 由 DataScopeAspect 按当前登录人的 ALL/DEPT/SELF 生成过滤 SQL 片段，
 * 经 MyBatis-Plus 数据权限拦截器拼入 WHERE。
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface DataScope {

    /** 归属人列名（如 sales_id），DEPT 范围时拼 IN(同部门人员)，SELF 时拼等于当前人 */
    String ownerColumn();

    /** 目标物理表名：只有该表的查询拼接过滤片段（同方法内对其它表的联查不受影响） */
    String table();
}
