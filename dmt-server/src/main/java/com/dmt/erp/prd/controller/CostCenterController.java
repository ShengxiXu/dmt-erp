package com.dmt.erp.prd.controller;

import com.dmt.erp.common.R;
import com.dmt.erp.prd.entity.CostCenter;
import com.dmt.erp.prd.service.CostCenterService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/cost-centers")
@RequiredArgsConstructor
public class CostCenterController {

    private final CostCenterService costCenterService;

    @GetMapping
    public R<List<CostCenter>> list() {
        return R.ok(costCenterService.list());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','OPS','TECH')")
    public R<Long> create(@RequestBody CostCenter center) {
        return R.ok(costCenterService.create(center));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OPS','TECH')")
    public R<Void> update(@PathVariable Long id, @RequestBody CostCenter center) {
        center.setId(id);
        costCenterService.update(center);
        return R.ok();
    }
}
