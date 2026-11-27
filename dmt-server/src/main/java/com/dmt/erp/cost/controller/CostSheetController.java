package com.dmt.erp.cost.controller;

import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.R;
import com.dmt.erp.cost.dto.LineSaveReq;
import com.dmt.erp.cost.dto.SheetQuery;
import com.dmt.erp.cost.entity.CostSignSnapshot;
import com.dmt.erp.cost.service.CostSheetService;
import com.dmt.erp.cost.vo.SheetVo;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/sheets")
@RequiredArgsConstructor
@Validated
public class CostSheetController {

    private final CostSheetService sheetService;

    @GetMapping
    public R<PageResult<SheetVo>> page(SheetQuery query) {
        return R.ok(sheetService.page(query));
    }

    @GetMapping("/by-contract/{contractId}")
    public R<SheetVo> byContract(@PathVariable Long contractId) {
        return R.ok(sheetService.byContract(contractId));
    }

    @GetMapping("/{id}")
    public R<SheetVo> detail(@PathVariable Long id) {
        return R.ok(sheetService.detail(id));
    }

    @GetMapping("/{id}/skeleton")
    public R<Map<String, Object>> skeleton(@PathVariable Long id, @RequestParam String dept) {
        return R.ok(sheetService.skeleton(id, dept));
    }

    @PutMapping("/{id}/lines")
    public R<Void> saveLines(@PathVariable Long id, @Valid @RequestBody LineSaveReq req) {
        sheetService.saveLines(id, req);
        return R.ok();
    }

    @PostMapping("/{id}/submit")
    public R<Void> submit(@PathVariable Long id, @RequestParam String dept) {
        sheetService.submit(id, dept);
        return R.ok();
    }

    @PostMapping("/{id}/start-approval")
    public R<Void> startApproval(@PathVariable Long id) {
        sheetService.startApproval(id);
        return R.ok();
    }

    @GetMapping("/{id}/snapshot")
    public R<CostSignSnapshot> snapshot(@PathVariable Long id) {
        return R.ok(sheetService.snapshot(id));
    }

    @PostMapping("/{id}/change")
    public R<Void> change(@PathVariable Long id) {
        sheetService.change(id);
        return R.ok();
    }
}
