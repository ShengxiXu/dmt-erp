package com.dmt.erp.prd.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.R;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.prd.entity.PrdCategory;
import com.dmt.erp.prd.entity.PrdProductType;
import com.dmt.erp.prd.mapper.PrdCategoryMapper;
import com.dmt.erp.prd.mapper.PrdProductTypeMapper;
import com.dmt.erp.prd.service.ProductTypeService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** 产品类别主数据：空类别可存在；删除类别级联删除其下类型（引用拦截由类型删除把关） */
@RestController
@RequestMapping("/product-categories")
@RequiredArgsConstructor
public class ProductCategoryController {

    private final PrdCategoryMapper categoryMapper;
    private final PrdProductTypeMapper typeMapper;
    private final ProductTypeService typeService;

    @GetMapping
    public R<List<Map<String, Object>>> list() {
        List<PrdCategory> cats = categoryMapper.selectList(new LambdaQueryWrapper<PrdCategory>()
                .orderByAsc(PrdCategory::getSort).orderByAsc(PrdCategory::getId));
        List<PrdProductType> types = typeMapper.selectList(null);
        return R.ok(cats.stream().map(c -> {
            Map<String, Object> m = new java.util.LinkedHashMap<String, Object>();
            m.put("id", c.getId());
            m.put("name", c.getName());
            m.put("typeCount", types.stream().filter(t -> c.getName().equals(t.getCat())).count());
            return m;
        }).toList());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','OPS')")
    public R<Long> create(@RequestBody PrdCategory category) {
        if (!StringUtils.hasText(category.getName())) {
            throw new BizException(ResultCode.PARAM_INVALID, "类别名称必填");
        }
        Long dup = categoryMapper.selectCount(new LambdaQueryWrapper<PrdCategory>()
                .eq(PrdCategory::getName, category.getName().trim()));
        if (dup > 0) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "类别已存在");
        }
        category.setName(category.getName().trim());
        categoryMapper.insert(category);
        return R.ok(category.getId());
    }

    /** 删除类别：级联删除其下类型；任一类型被合同引用即整体回滚 */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OPS')")
    @Transactional
    public R<Void> delete(@PathVariable Long id) {
        PrdCategory cat = categoryMapper.selectById(id);
        if (cat == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "类别不存在");
        }
        List<PrdProductType> types = typeMapper.selectList(new LambdaQueryWrapper<PrdProductType>()
                .eq(PrdProductType::getCat, cat.getName()));
        for (PrdProductType t : types) {
            typeService.delete(t.getId());
        }
        categoryMapper.deleteById(id);
        return R.ok();
    }
}
