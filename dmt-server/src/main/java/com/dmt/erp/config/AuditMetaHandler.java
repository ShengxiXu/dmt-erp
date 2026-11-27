package com.dmt.erp.config;

import com.baomidou.mybatisplus.core.handlers.MetaObjectHandler;
import com.dmt.erp.security.LoginUser;
import com.dmt.erp.security.SecurityUtils;
import org.apache.ibatis.reflection.MetaObject;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.function.Supplier;

@Component
public class AuditMetaHandler implements MetaObjectHandler {

    @Override
    public void insertFill(MetaObject metaObject) {
        Long uid = currentUserId();
        this.strictInsertFill(metaObject, "createdBy", Long.class, uid);
        this.strictInsertFill(metaObject, "createdAt", LocalDateTime.class, LocalDateTime.now());
        this.strictInsertFill(metaObject, "updatedBy", Long.class, uid);
        this.strictInsertFill(metaObject, "updatedAt", LocalDateTime.class, LocalDateTime.now());
    }

    @Override
    public void updateFill(MetaObject metaObject) {
        this.strictUpdateFill(metaObject, "updatedBy", Long.class, currentUserId());
        this.strictUpdateFill(metaObject, "updatedAt", LocalDateTime.class, LocalDateTime.now());
    }

    private Long currentUserId() {
        Supplier<Long> supplier = () -> SecurityUtils.currentUser().map(LoginUser::getUserId).orElse(null);
        try {
            return supplier.get();
        } catch (Exception e) {
            return null;
        }
    }
}
