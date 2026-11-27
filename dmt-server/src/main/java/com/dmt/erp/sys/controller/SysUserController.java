package com.dmt.erp.sys.controller;

import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.R;
import com.dmt.erp.sys.dto.ResetPasswordReq;
import com.dmt.erp.sys.dto.UserQuery;
import com.dmt.erp.sys.dto.UserSaveReq;
import com.dmt.erp.sys.service.SysUserService;
import com.dmt.erp.sys.vo.UserVo;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
@Validated
@PreAuthorize("hasRole('ADMIN')")
public class SysUserController {

    private final SysUserService userService;

    @GetMapping
    public R<PageResult<UserVo>> page(UserQuery query) {
        return R.ok(userService.page(query));
    }

    @PostMapping
    public R<Long> create(@Valid @RequestBody UserSaveReq req) {
        return R.ok(userService.create(req));
    }

    @PutMapping("/{id}")
    public R<Void> update(@PathVariable Long id, @Valid @RequestBody UserSaveReq req) {
        req.setId(id);
        userService.update(req);
        return R.ok();
    }

    @PostMapping("/{id}/reset-password")
    public R<Void> resetPassword(@PathVariable Long id, @Valid @RequestBody ResetPasswordReq req) {
        userService.resetPassword(id, req);
        return R.ok();
    }

    @PostMapping("/{id}/status")
    public R<Void> toggleStatus(@PathVariable Long id, @RequestParam String status) {
        userService.toggleStatus(id, status);
        return R.ok();
    }
}
