package com.dmt.erp.lc.controller;

import com.dmt.erp.common.R;
import com.dmt.erp.lc.entity.LcChange;
import com.dmt.erp.lc.entity.LcTerminate;
import com.dmt.erp.lc.service.LifecycleService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/lifecycle")
@RequiredArgsConstructor
public class LifecycleController {

    private final LifecycleService lifecycleService;

    @GetMapping("/subscriptions")
    public R<List<Map<String, Object>>> subscriptions() {
        return R.ok(lifecycleService.subscriptions());
    }

    @GetMapping("/changes")
    public R<List<LcChange>> changes(@RequestParam(required = false) String status,
                                     @RequestParam(required = false) String kw) {
        return R.ok(lifecycleService.changeList(status, kw));
    }

    @PostMapping("/changes")
    public R<Long> submitChange(@RequestBody LcChange change) {
        return R.ok(lifecycleService.submitChange(change));
    }

    @GetMapping("/terminates")
    public R<List<LcTerminate>> terminates(@RequestParam(required = false) String status,
                                           @RequestParam(required = false) String kw) {
        return R.ok(lifecycleService.terminateList(status, kw));
    }

    @GetMapping("/terminates/penalty-ref")
    public R<Map<String, Object>> penaltyRef(@RequestParam Long contractId,
                                             @RequestParam Long lineId,
                                             @RequestParam String period) {
        return R.ok(lifecycleService.penaltyReference(contractId, lineId, period));
    }

    @PostMapping("/terminates")
    public R<Long> submitTerminate(@RequestBody LcTerminate terminate) {
        return R.ok(lifecycleService.submitTerminate(terminate));
    }

    @PostMapping("/terminates/{id}/recover")
    public R<Void> executeRecover(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        lifecycleService.executeRecover(id, body == null ? null : body.get("note"));
        return R.ok();
    }

    @PostMapping("/terminates/{id}/follow")
    public R<Void> confirmFollow(@PathVariable Long id, @RequestParam String kind,
                                 @RequestParam(required = false) String note) {
        lifecycleService.confirmFollow(id, kind, note);
        return R.ok();
    }
}
