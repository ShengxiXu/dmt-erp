package com.dmt.erp.mdm.controller;

import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.R;
import com.dmt.erp.mdm.dto.SpecialSaveReq;
import com.dmt.erp.mdm.service.SpecialService;
import com.dmt.erp.mdm.vo.SpecialVo;
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
@RequestMapping("/specials")
@RequiredArgsConstructor
@Validated
public class SpecialController {

    private final SpecialService specialService;

    @GetMapping
    public R<PageResult<SpecialVo>> page(@RequestParam(defaultValue = "1") long pageNum,
                                         @RequestParam(defaultValue = "10") long pageSize,
                                         @RequestParam(required = false) String status,
                                         @RequestParam(required = false) Long opportunityId) {
        return R.ok(specialService.page(pageNum, pageSize, status, opportunityId));
    }

    @GetMapping("/{id}")
    public R<SpecialVo> detail(@PathVariable Long id) {
        return R.ok(specialService.detail(id));
    }

    @PostMapping
    public R<Long> create(@Valid @RequestBody SpecialSaveReq req) {
        return R.ok(specialService.create(req));
    }
}
