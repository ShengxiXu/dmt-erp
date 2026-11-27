package com.dmt.erp.prd.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.R;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.prd.entity.PrdMaterial;
import com.dmt.erp.prd.mapper.PrdMaterialMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 资源目录（物料库）CRUD */
@RestController
@RequestMapping("/materials")
@RequiredArgsConstructor
public class MaterialController {

    private final PrdMaterialMapper materialMapper;
    private final com.dmt.erp.prd.mapper.PrdTypeMaterialMapper typeMaterialMapper;

    @GetMapping
    public R<List<PrdMaterial>> list() {
        List<PrdMaterial> rows = materialMapper.selectList(new LambdaQueryWrapper<PrdMaterial>()
                .orderByAsc(PrdMaterial::getId));
        for (PrdMaterial m : rows) {
            m.setRefCount(typeMaterialMapper.selectList(new LambdaQueryWrapper<com.dmt.erp.prd.entity.PrdTypeMaterial>()
                            .eq(com.dmt.erp.prd.entity.PrdTypeMaterial::getMaterialKey, m.getMatKey()))
                    .stream().map(com.dmt.erp.prd.entity.PrdTypeMaterial::getTypeId).distinct().count());
        }
        return R.ok(rows);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','OPS')")
    public R<Long> create(@RequestBody PrdMaterial material) {
        if (!StringUtils.hasText(material.getName())) {
            throw new BizException(ResultCode.PARAM_INVALID, "资源名称必填");
        }
        // key 系统自动生成：mat_ + 递增序号（存量语义 key 不动；唯一锚点，用户无需关心）
        if (!StringUtils.hasText(material.getMatKey())) {
            material.setMatKey(nextMatKey());
        }
        Long dup = materialMapper.selectCount(new LambdaQueryWrapper<PrdMaterial>()
                .eq(PrdMaterial::getMatKey, material.getMatKey()));
        if (dup > 0) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "物料 key 已存在");
        }
        materialMapper.insert(material);
        return R.ok(material.getId());
    }

    private String nextMatKey() {
        int max = materialMapper.selectList(new LambdaQueryWrapper<PrdMaterial>()
                        .select(PrdMaterial::getMatKey))
                .stream()
                .map(PrdMaterial::getMatKey)
                .filter(k -> k != null && k.matches("mat_\\d+"))
                .mapToInt(k -> Integer.parseInt(k.substring(4)))
                .max().orElse(12);
        return "mat_" + (max + 1);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OPS')")
    public R<Void> update(@PathVariable Long id, @RequestBody PrdMaterial material) {
        PrdMaterial exist = materialMapper.selectById(id);
        if (exist == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "物料不存在");
        }
        material.setId(id);
        materialMapper.updateById(material);
        return R.ok();
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OPS')")
    public R<Void> delete(@PathVariable Long id) {
        PrdMaterial exist = materialMapper.selectById(id);
        if (exist == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "物料不存在");
        }
        Long refs = typeMaterialMapper.selectCount(new LambdaQueryWrapper<com.dmt.erp.prd.entity.PrdTypeMaterial>()
                .eq(com.dmt.erp.prd.entity.PrdTypeMaterial::getMaterialKey, exist.getMatKey()));
        if (refs > 0) {
            throw new BizException(ResultCode.STATE_CONFLICT, "该资源已被 " + refs + " 条产品组成引用，不可删除（可停用）");
        }
        materialMapper.deleteById(id);
        return R.ok();
    }
}
