package com.dmt.erp.analytics.controller;

import com.dmt.erp.analytics.service.WorkbenchService;
import com.dmt.erp.common.R;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/workbench")
@RequiredArgsConstructor
public class WorkbenchController {

    private final WorkbenchService workbenchService;

    @GetMapping("/overview")
    public R<Map<String, Object>> overview() {
        return R.ok(workbenchService.overview());
    }
}
