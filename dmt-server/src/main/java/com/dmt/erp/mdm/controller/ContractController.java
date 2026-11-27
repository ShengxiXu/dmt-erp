package com.dmt.erp.mdm.controller;

import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.R;
import com.dmt.erp.mdm.dto.ContractQuery;
import com.dmt.erp.mdm.dto.ContractSaveReq;
import com.dmt.erp.mdm.service.ContractService;
import com.dmt.erp.mdm.vo.ContractVo;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/contracts")
@RequiredArgsConstructor
@Validated
public class ContractController {

    private final ContractService contractService;

    @GetMapping
    public R<PageResult<ContractVo>> page(ContractQuery query) {
        return R.ok(contractService.page(query));
    }

    @GetMapping("/{id}")
    public R<ContractVo> detail(@PathVariable Long id) {
        return R.ok(contractService.detail(id));
    }

    @PostMapping
    public R<Long> create(@Valid @RequestBody ContractSaveReq req) {
        return R.ok(contractService.create(req));
    }

    @PutMapping("/{id}")
    public R<Void> update(@PathVariable Long id, @Valid @RequestBody ContractSaveReq req) {
        req.setId(id);
        contractService.update(req);
        return R.ok();
    }

    @PostMapping("/{id}/submit")
    public R<Void> submit(@PathVariable Long id) {
        contractService.submit(id);
        return R.ok();
    }

    @PostMapping("/{id}/step")
    public R<Void> step(@PathVariable Long id) {
        contractService.step(id);
        return R.ok();
    }

    @PostMapping("/{id}/effect")
    public R<Void> effect(@PathVariable Long id) {
        contractService.effect(id);
        return R.ok();
    }

    @PostMapping("/{id}/terminate")
    public R<Void> terminate(@PathVariable Long id) {
        contractService.terminate(id);
        return R.ok();
    }
}
