package com.dmt.erp.sys.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.dmt.erp.common.PageResult;
import com.dmt.erp.security.LoginUser;
import com.dmt.erp.security.SecurityUtils;
import com.dmt.erp.sys.dto.NotificationReadReq;
import com.dmt.erp.sys.entity.SysNotification;
import com.dmt.erp.sys.mapper.SysNotificationMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SysNotificationService {

    private final SysNotificationMapper notificationMapper;

    public PageResult<SysNotification> page(long pageNum, long pageSize, Integer unread) {
        LoginUser me = SecurityUtils.requireUser();
        Page<SysNotification> page = new Page<>(pageNum, Math.min(pageSize, 100));
        LambdaQueryWrapper<SysNotification> wrapper = new LambdaQueryWrapper<SysNotification>()
                .eq(SysNotification::getUserId, me.getUserId())
                .eq(unread != null && unread == 1, SysNotification::getIsRead, 0)
                .orderByDesc(SysNotification::getId);
        return PageResult.of(notificationMapper.selectPage(page, wrapper));
    }

    public long unreadCount() {
        LoginUser me = SecurityUtils.requireUser();
        return notificationMapper.selectCount(new LambdaQueryWrapper<SysNotification>()
                .eq(SysNotification::getUserId, me.getUserId())
                .eq(SysNotification::getIsRead, 0));
    }

    public void markRead(NotificationReadReq req) {
        LoginUser me = SecurityUtils.requireUser();
        LambdaUpdateWrapper<SysNotification> wrapper = new LambdaUpdateWrapper<SysNotification>()
                .eq(SysNotification::getUserId, me.getUserId())
                .eq(SysNotification::getIsRead, 0)
                .set(SysNotification::getIsRead, 1);
        if (!req.isAll() && req.getIds() != null && !req.getIds().isEmpty()) {
            wrapper.in(SysNotification::getId, req.getIds());
        }
        notificationMapper.update(null, wrapper);
    }
}
