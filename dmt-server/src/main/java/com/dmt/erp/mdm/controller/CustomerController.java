package com.dmt.erp.mdm.controller;

import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.R;
import com.dmt.erp.mdm.dto.CustomerQuery;
import com.dmt.erp.mdm.dto.CustomerSaveReq;
import com.dmt.erp.mdm.service.CustomerService;
import com.dmt.erp.mdm.vo.CustomerVo;
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
@RequestMapping("/customers")
@RequiredArgsConstructor
@Validated
public class CustomerController {

    private final CustomerService customerService;

    @GetMapping
    public R<PageResult<CustomerVo>> page(CustomerQuery query) {
        return R.ok(customerService.page(query));
    }

    @GetMapping("/{id}")
    public R<CustomerVo> detail(@PathVariable Long id) {
        return R.ok(customerService.detail(id));
    }

    @PostMapping
    public R<Long> create(@Valid @RequestBody CustomerSaveReq req) {
        return R.ok(customerService.create(req));
    }

    @PutMapping("/{id}")
    public R<Void> update(@PathVariable Long id, @Valid @RequestBody CustomerSaveReq req) {
        req.setId(id);
        customerService.update(req);
        return R.ok();
    }
}
