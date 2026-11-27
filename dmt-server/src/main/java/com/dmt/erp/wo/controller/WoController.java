package com.dmt.erp.wo.controller;

import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.R;
import com.dmt.erp.wo.dto.AssignmentApplyReq;
import com.dmt.erp.wo.service.WoService;
import com.dmt.erp.wo.vo.WoVo;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/work-orders")
@RequiredArgsConstructor
@Validated
public class WoController {

    private final WoService woService;

    @GetMapping
    public R<PageResult<WoVo>> page(@RequestParam(required = false) String status,
                                    @RequestParam(defaultValue = "1") long pageNum,
                                    @RequestParam(defaultValue = "10") long pageSize) {
        return R.ok(woService.page(status, pageNum, pageSize));
    }

    @GetMapping("/{id}")
    public R<WoVo> detail(@PathVariable Long id) {
        return R.ok(woService.detail(id));
    }

    @GetMapping("/by-sheet/{sheetId}")
    public R<WoVo> bySheet(@PathVariable Long sheetId) {
        return R.ok(woService.bySheet(sheetId));
    }

    @PostMapping("/{id}/availability-check")
    public R<Map<String, Object>> availabilityCheck(@PathVariable Long id,
                                                    @RequestParam(required = false) String loadConclusion) {
        return R.ok(woService.availabilityCheck(id, loadConclusion));
    }

    @PostMapping("/{id}/assignments")
    public R<Void> applyAssignments(@PathVariable Long id, @Valid @RequestBody(required = false) AssignmentApplyReq req) {
        woService.applyAssignments(id, req == null ? new AssignmentApplyReq() : req);
        return R.ok();
    }

    @PostMapping("/{id}/complete")
    public R<Void> complete(@PathVariable Long id) {
        woService.complete(id);
        return R.ok();
    }

    @PostMapping("/{id}/activate")
    public R<Void> activate(@PathVariable Long id) {
        woService.activate(id);
        return R.ok();
    }
}
