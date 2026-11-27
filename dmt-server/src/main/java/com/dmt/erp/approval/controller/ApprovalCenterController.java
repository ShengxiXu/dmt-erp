package com.dmt.erp.approval.controller;

import com.dmt.erp.approval.dto.ActReq;
import com.dmt.erp.approval.service.ApprovalEngineService;
import com.dmt.erp.approval.vo.InstanceVo;
import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.R;
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

@RestController
@RequestMapping("/approvals")
@RequiredArgsConstructor
@Validated
public class ApprovalCenterController {

    private final ApprovalEngineService engine;

    @GetMapping("/todo")
    public R<PageResult<InstanceVo>> todo(@RequestParam(defaultValue = "1") long pageNum,
                                          @RequestParam(defaultValue = "10") long pageSize) {
        return R.ok(engine.todo(pageNum, pageSize));
    }

    @GetMapping("/done")
    public R<PageResult<InstanceVo>> done(@RequestParam(defaultValue = "1") long pageNum,
                                          @RequestParam(defaultValue = "10") long pageSize) {
        return R.ok(engine.done(pageNum, pageSize));
    }

    @GetMapping("/instances/{id}")
    public R<InstanceVo> detail(@PathVariable Long id) {
        return R.ok(engine.detail(id));
    }

    @GetMapping("/active")
    public R<InstanceVo> active(@RequestParam String docType, @RequestParam Long docId) {
        var inst = engine.activeInstance(docType, docId);
        return R.ok(inst == null ? null : engine.detail(inst.getId()));
    }

    @PostMapping("/instances/{id}/act")
    public R<Void> act(@PathVariable Long id, @Valid @RequestBody ActReq req) {
        engine.act(id, Boolean.TRUE.equals(req.getApprove()), req.getComment());
        return R.ok();
    }

    @PostMapping("/instances/{id}/resubmit")
    public R<Long> resubmit(@PathVariable Long id) {
        return R.ok(engine.resubmit(id).getId());
    }
}
