package com.dmt.erp.prd.controller;

import com.dmt.erp.common.R;
import com.dmt.erp.prd.entity.PrdPriceDict;
import com.dmt.erp.prd.service.PriceDictService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
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
@RequestMapping("/price-dicts")
@RequiredArgsConstructor
public class PriceDictController {

    private final PriceDictService priceDictService;

    @GetMapping
    public R<List<PrdPriceDict>> list(@RequestParam(required = false) String dictKey) {
        return R.ok(priceDictService.list(dictKey));
    }

    @GetMapping("/current")
    public R<PrdPriceDict> current(@RequestParam String dictKey) {
        return R.ok(priceDictService.current(dictKey));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','OPS','TECH')")
    public R<Long> create(@RequestBody PrdPriceDict dict) {
        return R.ok(priceDictService.create(dict));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OPS','TECH')")
    public R<Void> update(@PathVariable Long id, @RequestBody PrdPriceDict dict) {
        dict.setId(id);
        priceDictService.update(dict);
        return R.ok();
    }
}
