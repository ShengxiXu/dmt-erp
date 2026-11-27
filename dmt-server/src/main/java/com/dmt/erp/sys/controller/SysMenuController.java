package com.dmt.erp.sys.controller;

import com.dmt.erp.common.R;
import com.dmt.erp.sys.service.SysMenuService;
import com.dmt.erp.sys.vo.MenuTreeVo;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/menus")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class SysMenuController {

    private final SysMenuService menuService;

    @GetMapping("/tree")
    public R<List<MenuTreeVo>> tree() {
        return R.ok(menuService.tree());
    }
}
