package com.dmt.erp.sys.controller;

import com.dmt.erp.common.R;
import com.dmt.erp.sys.entity.SysConfig;
import com.dmt.erp.sys.service.SysConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/configs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class SysConfigController {

    private final SysConfigService configService;

    @GetMapping
    public R<List<SysConfig>> list() {
        return R.ok(configService.list());
    }

    @PutMapping
    public R<Void> upsert(@RequestParam String key,
                          @RequestParam(required = false) String value,
                          @RequestParam(required = false) String remark) {
        configService.upsert(key, value, remark);
        return R.ok();
    }
}
