package com.dmt.erp.sys.controller;

import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.R;
import com.dmt.erp.sys.dto.NotificationReadReq;
import com.dmt.erp.sys.entity.SysNotification;
import com.dmt.erp.sys.service.SysNotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class SysNotificationController {

    private final SysNotificationService notificationService;

    @GetMapping
    public R<PageResult<SysNotification>> page(@RequestParam(defaultValue = "1") long pageNum,
                                               @RequestParam(defaultValue = "10") long pageSize,
                                               @RequestParam(required = false) Integer unread) {
        return R.ok(notificationService.page(pageNum, pageSize, unread));
    }

    @GetMapping("/unread-count")
    public R<Map<String, Long>> unreadCount() {
        return R.ok(Map.of("count", notificationService.unreadCount()));
    }

    @PostMapping("/read")
    public R<Void> read(@RequestBody NotificationReadReq req) {
        notificationService.markRead(req);
        return R.ok();
    }
}
