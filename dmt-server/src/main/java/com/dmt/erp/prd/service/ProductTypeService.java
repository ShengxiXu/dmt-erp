package com.dmt.erp.prd.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.prd.dto.TypeSaveReq;
import com.dmt.erp.prd.entity.PrdProductType;
import com.dmt.erp.prd.entity.PrdTypeMaterial;
import com.dmt.erp.prd.mapper.PrdProductTypeMapper;
import com.dmt.erp.prd.mapper.PrdTypeMaterialMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ProductTypeService {

    private final PrdProductTypeMapper typeMapper;
    private final PrdTypeMaterialMapper materialMapper;
    private final com.dmt.erp.mdm.mapper.MdmContractLineMapper contractLineMapper;

    public List<PrdProductType> list(String cat, String status) {
        List<PrdProductType> list = typeMapper.selectList(new LambdaQueryWrapper<PrdProductType>()
                .eq(StringUtils.hasText(cat), PrdProductType::getCat, cat)
                .eq(StringUtils.hasText(status), PrdProductType::getStatus, status)
                .orderByAsc(PrdProductType::getId));
        list.forEach(t -> {
            t.setSpecFields(parseJson(t.getSpecFieldsJson()));
            t.setPlans(parseJson(t.getPlansJson()));
        });
        return list;
    }

    @SuppressWarnings("unchecked")
    private java.util.List<java.util.Map<String, Object>> parseJson(String json) {
        if (!StringUtils.hasText(json)) {
            return java.util.List.of();
        }
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().readValue(json, java.util.List.class);
        } catch (Exception e) {
            return java.util.List.of();
        }
    }

    public List<PrdTypeMaterial> materials(Long typeId) {
        return materialMapper.selectList(new LambdaQueryWrapper<PrdTypeMaterial>()
                .eq(PrdTypeMaterial::getTypeId, typeId)
                .orderByAsc(PrdTypeMaterial::getId));
    }

    @Transactional
    public Long create(TypeSaveReq req) {
        PrdProductType t = new PrdProductType();
        t.setCat(req.getCat());
        t.setName(req.getName());
        t.setStatus(StringUtils.hasText(req.getStatus()) ? req.getStatus() : "启用");
        t.setRemark(req.getRemark());
        t.setSla(req.getSla());
        t.setBillingCycle(req.getBillingCycle());
        t.setTaxRate(req.getTaxRate());
        t.setLeadTime(req.getLeadTime());
        t.setSpecFieldsJson(req.getSpecFieldsJson());
        t.setPlansJson(req.getPlansJson());
        typeMapper.insert(t);
        saveMaterials(t.getId(), req);
        return t.getId();
    }

    @Transactional
    public void update(TypeSaveReq req) {
        PrdProductType t = typeMapper.selectById(req.getId());
        if (t == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "产品类型不存在");
        }
        t.setCat(req.getCat());
        t.setName(req.getName());
        if (StringUtils.hasText(req.getStatus())) {
            t.setStatus(req.getStatus());
        }
        t.setRemark(req.getRemark());
        t.setSla(req.getSla());
        t.setBillingCycle(req.getBillingCycle());
        t.setTaxRate(req.getTaxRate());
        t.setLeadTime(req.getLeadTime());
        t.setSpecFieldsJson(req.getSpecFieldsJson());
        t.setPlansJson(req.getPlansJson());
        if (req.getCentersJson() != null) {
            t.setCentersJson(req.getCentersJson());
        }
        if (req.getDirectOffJson() != null) {
            t.setDirectOffJson(req.getDirectOffJson());
        }
        // 清单保存（携带组成/中心/剔除）→ 版本自动 +1 并追加历史
        if (req.getMaterials() != null || req.getCentersJson() != null || req.getDirectOffJson() != null) {
            int next = (t.getAsmVersion() == null ? 1 : t.getAsmVersion()) + 1;
            t.setAsmVersion(next);
            t.setAsmHistoryJson(appendHistory(t.getAsmHistoryJson(), next));
        }
        typeMapper.updateById(t);
        saveMaterials(t.getId(), req);
    }

    private String appendHistory(String historyJson, int ver) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();
            java.util.List<Map<String, Object>> history = historyJson == null || historyJson.isBlank()
                    ? new java.util.ArrayList<>()
                    : om.readValue(historyJson, new com.fasterxml.jackson.core.type.TypeReference<>() {
                    });
            Map<String, Object> row = new java.util.LinkedHashMap<>();
            row.put("ver", ver);
            row.put("at", java.time.LocalDateTime.now().toString().substring(0, 16).replace('T', ' '));
            try {
                row.put("by", com.dmt.erp.security.SecurityUtils.requireUser().getUsername());
            } catch (Exception e) {
                row.put("by", "system");
            }
            history.add(0, row);
            return om.writeValueAsString(history);
        } catch (Exception e) {
            return historyJson;
        }
    }

    /** 删除类型（有合同行引用时拦截；同时清理 BOM 关联） */
    @Transactional
    public void delete(Long id) {
        PrdProductType t = typeMapper.selectById(id);
        if (t == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "产品类型不存在");
        }
        Long used = contractLineMapper.selectCount(new LambdaQueryWrapper<com.dmt.erp.mdm.entity.MdmContractLine>()
                .eq(com.dmt.erp.mdm.entity.MdmContractLine::getPtype, t.getName()));
        if (used > 0) {
            throw new BizException(ResultCode.STATE_CONFLICT, "该类型已被 " + used + " 条合同订单行引用，不可删除（可停用下架）");
        }
        materialMapper.delete(new LambdaQueryWrapper<PrdTypeMaterial>().eq(PrdTypeMaterial::getTypeId, id));
        typeMapper.deleteById(id);
    }

    private void saveMaterials(Long typeId, TypeSaveReq req) {
        if (req.getMaterials() == null) {
            return;
        }
        materialMapper.delete(new LambdaQueryWrapper<PrdTypeMaterial>().eq(PrdTypeMaterial::getTypeId, typeId));
        req.getMaterials().stream()
                .filter(m -> StringUtils.hasText(m.getMaterialKey()))
                .forEach(m -> {
                    PrdTypeMaterial row = new PrdTypeMaterial();
                    row.setTypeId(typeId);
                    row.setMaterialKey(m.getMaterialKey());
                    row.setQty(m.getQty());
                    row.setRemark(m.getRemark());
                    materialMapper.insert(row);
                });
    }
}
