package com.dmt.erp.sys.controller;

import com.dmt.erp.common.R;
import com.dmt.erp.sys.dto.DeptSaveReq;
import com.dmt.erp.sys.entity.SysDept;
import com.dmt.erp.sys.service.SysDeptService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/depts")
@RequiredArgsConstructor
@Validated
@PreAuthorize("hasRole('ADMIN')")
public class SysDeptController {

    private final SysDeptService deptService;

    @GetMapping
    public R<List<SysDept>> list() {
        return R.ok(deptService.list());
    }

    @PostMapping
    public R<Long> create(@Valid @RequestBody DeptSaveReq req) {
        return R.ok(deptService.create(req));
    }

    @PutMapping("/{id}")
    public R<Void> update(@PathVariable Long id, @Valid @RequestBody DeptSaveReq req) {
        req.setId(id);
        deptService.update(req);
        return R.ok();
    }

    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable Long id) {
        deptService.delete(id);
        return R.ok();
    }
}
