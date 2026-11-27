package com.dmt.erp.mdm.controller;

import com.dmt.erp.common.R;
import com.dmt.erp.mdm.dto.EntitySaveReq;
import com.dmt.erp.mdm.service.EntityService;
import com.dmt.erp.mdm.vo.EntityVo;
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
@RequestMapping("/entities")
@RequiredArgsConstructor
@Validated
@PreAuthorize("hasAnyRole('ADMIN','FIN')")
public class EntityController {

    private final EntityService entityService;

    @GetMapping
    public R<List<EntityVo>> list() {
        return R.ok(entityService.list());
    }

    @GetMapping("/{id}")
    public R<EntityVo> detail(@PathVariable Long id) {
        return R.ok(entityService.detail(id));
    }

    @PostMapping
    public R<Long> create(@RequestBody EntitySaveReq req) {
        return R.ok(entityService.create(req));
    }

    @PutMapping("/{id}")
    public R<Void> update(@PathVariable Long id, @RequestBody EntitySaveReq req) {
        req.setId(id);
        entityService.update(req);
        return R.ok();
    }

    @DeleteMapping("/{id}")
    public R<Void> delete(@PathVariable Long id) {
        entityService.delete(id);
        return R.ok();
    }
}
