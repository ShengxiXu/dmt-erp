package com.dmt.erp.approval.controller;

import com.dmt.erp.approval.dto.FlowSaveReq;
import com.dmt.erp.approval.entity.AprFlowDef;
import com.dmt.erp.approval.entity.AprFlowNode;
import com.dmt.erp.approval.service.AprFlowService;
import com.dmt.erp.common.R;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/approval-flows")
@RequiredArgsConstructor
@Validated
@PreAuthorize("hasRole('ADMIN')")
public class ApprovalFlowController {

    private final AprFlowService flowService;

    @GetMapping
    public R<List<AprFlowDef>> list() {
        return R.ok(flowService.list());
    }

    @GetMapping("/{id}/nodes")
    public R<List<AprFlowNode>> nodes(@PathVariable Long id) {
        return R.ok(flowService.nodes(id));
    }

    @PostMapping
    public R<Long> create(@Valid @RequestBody FlowSaveReq req) {
        return R.ok(flowService.create(req));
    }

    @PutMapping("/{id}")
    public R<Void> update(@PathVariable Long id, @Valid @RequestBody FlowSaveReq req) {
        req.setId(id);
        flowService.update(req);
        return R.ok();
    }

    @PostMapping("/{id}/enabled")
    public R<Void> toggle(@PathVariable Long id, @RequestParam Integer enabled) {
        flowService.toggleEnabled(id, enabled);
        return R.ok();
    }

    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable Long id) {
        flowService.delete(id);
        return R.ok();
    }
}
