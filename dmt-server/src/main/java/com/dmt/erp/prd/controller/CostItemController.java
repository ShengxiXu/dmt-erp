package com.dmt.erp.prd.controller;

import com.dmt.erp.common.R;
import com.dmt.erp.prd.dto.TrialReq;
import com.dmt.erp.prd.entity.CostItem;
import com.dmt.erp.prd.service.CostItemService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/cost-items")
@RequiredArgsConstructor
public class CostItemController {

    private final CostItemService costItemService;

    @GetMapping
    public R<List<CostItem>> list(@RequestParam(required = false) String dept,
                                  @RequestParam(required = false) String costType,
                                  @RequestParam(required = false) String status,
                                  @RequestParam(required = false) String kw) {
        return R.ok(costItemService.list(dept, costType, status, kw));
    }

    @PostMapping("/trial")
    public R<Map<String, Object>> trial(@RequestBody TrialReq req) {
        return R.ok(costItemService.trial(req));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','OPS','TECH')")
    public R<Long> create(@RequestBody CostItem item) {
        return R.ok(costItemService.create(item));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OPS','TECH')")
    public R<Void> update(@PathVariable Long id, @RequestBody CostItem item) {
        item.setId(id);
        costItemService.update(item);
        return R.ok();
    }
}
