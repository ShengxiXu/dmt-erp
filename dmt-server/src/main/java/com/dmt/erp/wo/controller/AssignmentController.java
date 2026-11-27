package com.dmt.erp.wo.controller;

import com.dmt.erp.common.R;
import com.dmt.erp.wo.service.WoService;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/assignments")
@RequiredArgsConstructor
@Validated
public class AssignmentController {

    private final WoService woService;

    @PostMapping("/{id}/bind")
    public R<Void> bind(@PathVariable Long id) {
        woService.bind(id);
        return R.ok();
    }
}
