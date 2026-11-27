package com.dmt.erp.prd.controller;

import com.dmt.erp.common.R;
import com.dmt.erp.prd.dto.TypeSaveReq;
import com.dmt.erp.prd.entity.PrdProductType;
import com.dmt.erp.prd.entity.PrdTypeMaterial;
import com.dmt.erp.prd.service.ProductTypeService;
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

import java.util.List;

@RestController
@RequestMapping("/product-types")
@RequiredArgsConstructor
@Validated
public class ProductTypeController {

    private final ProductTypeService typeService;

    @GetMapping
    public R<List<PrdProductType>> list(@RequestParam(required = false) String cat,
                                        @RequestParam(required = false) String status) {
        return R.ok(typeService.list(cat, status));
    }

    @GetMapping("/{id}/materials")
    public R<List<PrdTypeMaterial>> materials(@PathVariable Long id) {
        return R.ok(typeService.materials(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','OPS','TECH')")
    public R<Long> create(@Valid @RequestBody TypeSaveReq req) {
        return R.ok(typeService.create(req));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OPS','TECH')")
    public R<Void> update(@PathVariable Long id, @Valid @RequestBody TypeSaveReq req) {
        req.setId(id);
        typeService.update(req);
        return R.ok();
    }

    @PutMapping("/{id}/materials")
    @PreAuthorize("hasAnyRole('ADMIN','OPS','TECH')")
    public R<Void> saveMaterials(@PathVariable Long id, @Valid @RequestBody TypeSaveReq req) {
        req.setId(id);
        typeService.update(req);
        return R.ok();
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OPS')")
    public R<Void> delete(@PathVariable Long id) {
        typeService.delete(id);
        return R.ok();
    }
}
