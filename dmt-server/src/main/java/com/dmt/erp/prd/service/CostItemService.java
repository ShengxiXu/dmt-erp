package com.dmt.erp.prd.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.cost.service.CostCalcService;
import com.dmt.erp.prd.dto.TrialReq;
import com.dmt.erp.prd.entity.CostItem;
import com.dmt.erp.prd.mapper.CostItemMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CostItemService {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final CostItemMapper costItemMapper;
    private final com.dmt.erp.prd.mapper.PrdTypeMaterialMapper typeMaterialMapper;
    private final com.dmt.erp.prd.mapper.CostItemCategoryMapper itemCategoryMapper;
    private final CostCalcService calcService;

    public List<CostItem> list(String dept, String costType, String status, String kw) {
        List<CostItem> items = costItemMapper.selectList(new LambdaQueryWrapper<CostItem>()
                .eq(StringUtils.hasText(dept), CostItem::getDept, dept)
                .eq(StringUtils.hasText(costType), CostItem::getCostType, costType)
                .eq(StringUtils.hasText(status), CostItem::getStatus, status)
                .and(StringUtils.hasText(kw), x -> x.like(CostItem::getName, kw).or().like(CostItem::getItemKey, kw))
                .orderByAsc(CostItem::getId));
        // 可增补类别绑定（受控增补范围）
        Map<String, List<String>> catsByItem = new HashMap<>();
        for (com.dmt.erp.prd.entity.CostItemCategory b : itemCategoryMapper.selectList(null)) {
            catsByItem.computeIfAbsent(b.getItemKey(), k -> new java.util.ArrayList<>()).add(b.getCat());
        }
        // 被装配：产品组成引用了本条目「适用资源」的类型数（直接成本自动推导的命中面）
        for (CostItem item : items) {
            item.setCats(catsByItem.getOrDefault(item.getItemKey(), List.of()));
            if (!StringUtils.hasText(item.getAppliesTo())) {
                item.setRefCount(0L);
                continue;
            }
            item.setRefCount(typeMaterialMapper.selectList(new LambdaQueryWrapper<com.dmt.erp.prd.entity.PrdTypeMaterial>()
                            .eq(com.dmt.erp.prd.entity.PrdTypeMaterial::getMaterialKey, item.getAppliesTo()))
                    .stream().map(com.dmt.erp.prd.entity.PrdTypeMaterial::getTypeId).distinct().count());
        }
        return items;
    }

    public Long create(CostItem item) {
        if (!StringUtils.hasText(item.getStatus())) {
            item.setStatus("草稿");
        }
        if (!StringUtils.hasText(item.getItemKey())) {
            // 逻辑删除的行仍占唯一键，序号必须按物理最大 id 续（自定义 SQL 绕过逻辑删除过滤）
            item.setItemKey("CI-" + String.format("%04d", costItemMapper.nextItemSeq()));
        }
        deriveCategory(item);
        deriveCalcRule(item);
        checkActivatable(item);
        try {
            costItemMapper.insert(item);
        } catch (DuplicateKeyException e) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "条目 key 已存在");
        }
        saveCats(item);
        return item.getId();
    }

    public void update(CostItem item) {
        CostItem exist = costItemMapper.selectById(item.getId());
        if (exist == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "成本条目不存在");
        }
        deriveCategory(item);
        deriveCalcRule(item);
        checkActivatable(item);
        if ("停用".equals(item.getStatus()) && !"停用".equals(exist.getStatus())) {
            long refs = refCountOf(StringUtils.hasText(item.getAppliesTo()) ? item.getAppliesTo() : exist.getAppliesTo());
            if (refs > 0) {
                throw new BizException(ResultCode.BIZ_RULE_VIOLATION,
                        "该条目正被 " + refs + " 个产品类型装配/引用，请先解除装配关系再停用");
            }
        }
        try {
            costItemMapper.updateById(item);
        } catch (DuplicateKeyException e) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "条目 key 已存在");
        }
        saveCats(item);
    }

    /** 可增补类别绑定整组替换（受控增补范围字典） */
    private void saveCats(CostItem item) {
        if (item.getCats() == null) {
            return;
        }
        itemCategoryMapper.delete(new LambdaQueryWrapper<com.dmt.erp.prd.entity.CostItemCategory>()
                .eq(com.dmt.erp.prd.entity.CostItemCategory::getItemKey, item.getItemKey()));
        item.getCats().stream().filter(StringUtils::hasText).distinct().forEach(cat -> {
            com.dmt.erp.prd.entity.CostItemCategory b = new com.dmt.erp.prd.entity.CostItemCategory();
            b.setItemKey(item.getItemKey());
            b.setCat(cat.trim());
            itemCategoryMapper.insert(b);
        });
    }

    /** 生效门槛：状态为「生效」时四要素必须齐全（新建直接生效、草稿置生效、生效态保存均校验） */
    private void checkActivatable(CostItem item) {
        if (!"生效".equals(item.getStatus())) {
            return;
        }
        List<String> miss = missingElements(item);
        if (!miss.isEmpty()) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION,
                    "四要素未齐全，无法生效：缺少 " + String.join("、", miss));
        }
    }

    /** 四要素（与原型 missingElements 同口径） */
    private List<String> missingElements(CostItem it) {
        List<String> miss = new java.util.ArrayList<>();
        if (!StringUtils.hasText(it.getSettleType())) {
            miss.add("算账去向");
        }
        if ("资源驱动".equals(it.getCategory()) && !StringUtils.hasText(it.getSourceArchive())) {
            miss.add("取数来源");
        }
        if (!"间接".equals(it.getSettleType()) && !StringUtils.hasText(it.getCalcMethod())) {
            miss.add("计价方式");
        }
        if (!"间接".equals(it.getSettleType()) && !StringUtils.hasText(it.getAppliesTo())) {
            miss.add("适用资源");
        }
        if ("间接".equals(it.getSettleType()) && !StringUtils.hasText(it.getCostCenter())) {
            miss.add("归属成本中心");
        }
        return miss;
    }

    /** 取数档案 → 适用资源（推导桥，与原型 SOURCE_TO_MAT 一致）：资源驱动条目的适用资源由档案自动得出 */
    private static final Map<String, String> SOURCE_TO_MAT = Map.of(
            "r1", "mat_exit", "r2", "mat_base", "r3", "mat_ip", "r4", "mat_dev", "resale", "mat_resale");

    private void deriveCategory(CostItem item) {
        if (StringUtils.hasText(item.getSourceArchive())) {
            item.setCategory("资源驱动");
            String mat = SOURCE_TO_MAT.get(item.getSourceArchive());
            if (mat != null) {
                item.setAppliesTo(mat);
            }
        } else if (!StringUtils.hasText(item.getCategory())) {
            item.setCategory("手工录入");
        }
        if ("间接".equals(item.getSettleType())) {
            // 间接费用不从产品组成推导，无需适用资源
            item.setAppliesTo(null);
        }
        if (!StringUtils.hasText(item.getRequiredFlag())) {
            item.setRequiredFlag("按装配");
        }
    }

    private long refCountOf(String appliesTo) {
        if (!StringUtils.hasText(appliesTo)) {
            return 0;
        }
        return typeMaterialMapper.selectList(new LambdaQueryWrapper<com.dmt.erp.prd.entity.PrdTypeMaterial>()
                        .eq(com.dmt.erp.prd.entity.PrdTypeMaterial::getMaterialKey, appliesTo))
                .stream().map(com.dmt.erp.prd.entity.PrdTypeMaterial::getTypeId).distinct().count();
    }

    /** 计算规则派生：formula / calcKind 由服务端按 方式+参数 生成，不接受手工填写；间接费用无算式；草稿允许暂不选方式 */
    private void deriveCalcRule(CostItem item) {
        if ("间接".equals(item.getSettleType())) {
            item.setCalcMethod(null);
            item.setCalcParams(null);
            item.setCalcKind("中心分法");
            item.setFormula("金额由成本中心分法统一计算（月末归集分摊）");
            return;
        }
        if (!StringUtils.hasText(item.getCalcMethod())) {
            item.setCalcParams(null);
            item.setCalcKind(null);
            item.setFormula(null);
            return;
        }
        Map<String, Object> params = parseParams(item.getCalcParams());
        calcService.validate(item.getCalcMethod(), params);
        item.setCalcParams(params.isEmpty() ? null : writeParams(params));
        item.setCalcKind(calcService.methodLabel(item.getCalcMethod()));
        item.setFormula(calcService.formulaText(item.getCalcMethod(), params));
    }

    /** 试算：传 itemKey 用已存条目规则；或传 calcMethod+calcParams 试未保存规则（表单内）。与核算单填报同一引擎 */
    public Map<String, Object> trial(TrialReq req) {
        String method;
        Map<String, Object> params;
        if (StringUtils.hasText(req.getItemKey())) {
            CostItem item = costItemMapper.selectOne(new LambdaQueryWrapper<CostItem>()
                    .eq(CostItem::getItemKey, req.getItemKey()).last("LIMIT 1"));
            if (item == null) {
                throw new BizException(ResultCode.STATE_CONFLICT, "成本条目不存在：" + req.getItemKey());
            }
            method = item.getCalcMethod();
            params = parseParams(item.getCalcParams());
            if (!StringUtils.hasText(method)) {
                throw new BizException(ResultCode.BIZ_RULE_VIOLATION,
                        "间接费用条目无自己的算式，金额由成本中心分法统一计算");
            }
        } else {
            method = req.getCalcMethod();
            params = req.getCalcParams() == null ? Map.of() : req.getCalcParams();
        }
        if (!StringUtils.hasText(method)) {
            throw new BizException(ResultCode.PARAM_INVALID, "缺少计算方式");
        }
        CostCalcService.CalcResult r = calcService.calc(method, params, req.getInputs());
        Map<String, Object> out = new HashMap<>();
        out.put("amount", r.amount());
        out.put("calcText", r.calcText());
        out.put("methodLabel", calcService.methodLabel(method));
        out.put("formula", calcService.formulaText(method, params));
        return out;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseParams(String json) {
        if (!StringUtils.hasText(json)) {
            return new HashMap<>();
        }
        try {
            return JSON.readValue(json, Map.class);
        } catch (Exception e) {
            throw new BizException(ResultCode.PARAM_INVALID, "计算参数 JSON 格式不正确");
        }
    }

    private String writeParams(Map<String, Object> params) {
        try {
            return JSON.writeValueAsString(params);
        } catch (Exception e) {
            throw new BizException(ResultCode.PARAM_INVALID, "计算参数序列化失败");
        }
    }
}
