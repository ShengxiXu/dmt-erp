package com.dmt.erp.analytics.controller;

import com.dmt.erp.analytics.service.AnalyticsService;
import com.dmt.erp.common.R;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/overview")
    public R<Map<String, Object>> overview() {
        return R.ok(analyticsService.overview());
    }
}
