package com.dmt.erp.mdm.controller;

import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.R;
import com.dmt.erp.mdm.dto.OpportunityQuery;
import com.dmt.erp.mdm.dto.OpportunitySaveReq;
import com.dmt.erp.mdm.service.OpportunityService;
import com.dmt.erp.mdm.vo.OpportunityVo;
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
@RequestMapping("/opportunities")
@RequiredArgsConstructor
@Validated
public class OpportunityController {

    private final OpportunityService opportunityService;

    @GetMapping
    public R<PageResult<OpportunityVo>> page(OpportunityQuery query) {
        return R.ok(opportunityService.page(query));
    }

    @PostMapping
    public R<Long> create(@Valid @RequestBody OpportunitySaveReq req) {
        return R.ok(opportunityService.create(req));
    }

    @GetMapping("/{id}")
    public R<OpportunityVo> detail(@PathVariable Long id) {
        return R.ok(opportunityService.detail(id));
    }

    @PutMapping("/{id}")
    public R<Void> update(@PathVariable Long id, @Valid @RequestBody OpportunitySaveReq req) {
        req.setId(id);
        opportunityService.update(req);
        return R.ok();
    }

    @PostMapping("/{id}/stage")
    public R<Void> changeStage(@PathVariable Long id, @RequestBody Map<String, String> body) {
        opportunityService.changeStage(id, body.get("stage"));
        return R.ok();
    }
}
