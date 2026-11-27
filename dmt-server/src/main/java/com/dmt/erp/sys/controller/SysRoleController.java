package com.dmt.erp.sys.controller;

import com.dmt.erp.common.R;
import com.dmt.erp.sys.dto.RoleSaveReq;
import com.dmt.erp.sys.entity.SysRole;
import com.dmt.erp.sys.service.SysRoleService;
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
@RequestMapping("/roles")
@RequiredArgsConstructor
@Validated
@PreAuthorize("hasRole('ADMIN')")
public class SysRoleController {

    private final SysRoleService roleService;

    @GetMapping
    public R<List<SysRole>> list() {
        return R.ok(roleService.list());
    }

    @GetMapping("/{id}/menus")
    public R<List<Long>> menuIds(@PathVariable Long id) {
        return R.ok(roleService.menuIds(id));
    }

    @PostMapping
    public R<Long> create(@Valid @RequestBody RoleSaveReq req) {
        return R.ok(roleService.create(req));
    }

    @PutMapping("/{id}")
    public R<Void> update(@PathVariable Long id, @Valid @RequestBody RoleSaveReq req) {
        req.setId(id);
        roleService.update(req);
        return R.ok();
    }

    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable Long id) {
        roleService.delete(id);
        return R.ok();
    }
}
