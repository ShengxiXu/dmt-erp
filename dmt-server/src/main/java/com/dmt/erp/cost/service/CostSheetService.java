package com.dmt.erp.cost.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.dmt.erp.approval.service.ApprovalEngineService;
import com.dmt.erp.approval.service.WritebackRegistry;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.CodeGen;
import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.cost.dto.LineSaveReq;
import com.dmt.erp.cost.dto.SheetQuery;
import com.dmt.erp.cost.entity.CostSheet;
import com.dmt.erp.cost.entity.CostSheetLine;
import com.dmt.erp.cost.entity.CostSignSnapshot;
import com.dmt.erp.cost.mapper.CostSheetLineMapper;
import com.dmt.erp.cost.mapper.CostSheetMapper;
import com.dmt.erp.cost.mapper.CostSignSnapshotMapper;
import com.dmt.erp.cost.vo.SheetVo;
import com.dmt.erp.mdm.entity.*;
import com.dmt.erp.mdm.mapper.*;
import com.dmt.erp.prd.entity.CostItem;
import com.dmt.erp.prd.entity.PrdProductType;
import com.dmt.erp.prd.entity.PrdTypeMaterial;
import com.dmt.erp.prd.entity.ResExitPool;
import com.dmt.erp.prd.mapper.CostItemMapper;
import com.dmt.erp.prd.mapper.PrdProductTypeMapper;
import com.dmt.erp.prd.mapper.PrdTypeMaterialMapper;
import com.dmt.erp.prd.mapper.ResExitPoolMapper;
import com.dmt.erp.security.LoginUser;
import com.dmt.erp.security.SecurityUtils;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CostSheetService {

    public static final String DEPT_OPS = "支撑部";
    public static final String DEPT_TECH = "技术部";
    private static final Set<String> EDITABLE = Set.of("待填写", "待对方提交", "已齐套", "已驳回");

    private final CostSheetMapper sheetMapper;
    private final CostSheetLineMapper lineMapper;
    private final CostSignSnapshotMapper snapshotMapper;
    private final MdmContractMapper contractMapper;
    private final MdmContractLineMapper contractLineMapper;
    private final MdmCustomerMapper customerMapper;
    private final MdmOpportunityMapper opportunityMapper;
    private final CostItemMapper costItemMapper;
    private final ResExitPoolMapper poolMapper;
    private final PrdProductTypeMapper productTypeMapper;
    private final PrdTypeMaterialMapper typeMaterialMapper;
    private final com.dmt.erp.prd.mapper.CostItemCategoryMapper costItemCategoryMapper;
    private final ApprovalEngineService approvalEngine;
    private final WritebackRegistry writebackRegistry;
    private final com.dmt.erp.wo.service.WoService woService;

    @PostConstruct
    void registerWriteback() {
        writebackRegistry.register("成本核算单",
                this::onApproval,
                sheetId -> {
                    Map<String, Object> form = new HashMap<>();
                    CostSheet s = sheetMapper.selectById(sheetId);
                    if (s != null) {
                        form.put("monthlyCost", s.getMonthlyCost());
                        form.put("margin", s.getMargin());
                        form.put("contractValue", s.getContractValue());
                    }
                    return form;
                },
                id -> {
                    CostSheet s = sheetMapper.selectById(id);
                    return s == null ? String.valueOf(id) : s.getCode();
                });
    }

    /** 审批写回（契约 §4.3：单据状态只允许被引擎写回）；通过时自动生成开通工单（M4 钩子） */
    public void onApproval(Long sheetId, boolean pass) {
        CostSheet sheet = sheetMapper.selectById(sheetId);
        if (sheet == null) {
            return;
        }
        sheet.setStatus(pass ? "已通过" : "已驳回");
        sheet.setCurNode(pass ? "审批通过（签单快照已锁定）" : "已驳回，可修改后重新提交");
        sheetMapper.updateById(sheet);
        if (pass) {
            woService.generateFromSheet(sheet);
        }
    }

    // ---------- 台账 ----------

    public PageResult<SheetVo> page(SheetQuery q) {
        Page<CostSheet> page = new Page<>(q.getPageNum(), Math.min(q.getPageSize(), 100));
        LambdaQueryWrapper<CostSheet> wrapper = new LambdaQueryWrapper<CostSheet>()
                .and(StringUtils.hasText(q.getKw()), x -> x.like(CostSheet::getCode, q.getKw()))
                .eq(StringUtils.hasText(q.getStatus()), CostSheet::getStatus, q.getStatus())
                .orderByDesc(CostSheet::getId);
        if (q.getPending() != null && q.getPending() == 1) {
            wrapper.eq(CostSheet::getOpsDone, 1).eq(CostSheet::getTechDone, 1)
                    .in(CostSheet::getStatus, "待填写", "待对方提交", "已齐套");
        }
        applyScope(wrapper);
        Page<CostSheet> result = sheetMapper.selectPage(page, wrapper);
        return PageResult.of(result.convert(this::toVo));
    }

    /** 数据范围：核算单沿「合同 → 商机 → 客户归属销售」链路（与合同列表同口径） */
    private void applyScope(LambdaQueryWrapper<CostSheet> wrapper) {
        LoginUser me = SecurityUtils.currentUser().orElse(null);
        if (me == null || me.getDataScope() == LoginUser.DataScope.ALL) {
            return;
        }
        if (me.getDataScope() == LoginUser.DataScope.DEPT) {
            wrapper.inSql(CostSheet::getContractId,
                    "SELECT id FROM mdm_contract WHERE deleted = 0 AND opportunity_id IN "
                            + "(SELECT id FROM mdm_opportunity WHERE deleted = 0 AND sales_id IN "
                            + "(SELECT id FROM sys_user WHERE dept_id = " + me.getDeptId() + " AND deleted = 0))");
        } else {
            wrapper.inSql(CostSheet::getContractId,
                    "SELECT id FROM mdm_contract WHERE deleted = 0 AND opportunity_id IN "
                            + "(SELECT id FROM mdm_opportunity WHERE deleted = 0 AND sales_id = " + me.getUserId() + ")");
        }
    }

    private SheetVo toVo(CostSheet s) {
        SheetVo vo = new SheetVo();
        org.springframework.beans.BeanUtils.copyProperties(s, vo);
        MdmContract c = s.getContractId() == null ? null : contractMapper.selectById(s.getContractId());
        if (c != null) {
            vo.setContractCode(c.getCode());
            MdmCustomer cust = customerMapper.selectById(c.getCustomerId());
            vo.setCustomerName(cust == null ? null : cust.getName());
            MdmOpportunity opp = opportunityMapper.selectById(c.getOpportunityId());
            vo.setOpportunityName(opp == null ? null : opp.getName());
        }
        return vo;
    }

    // ---------- 建档 ----------

    /** 合同生效钩子：按合同取核算单，无则自动建档（合同生效 → 核算单自动建档） */
    @Transactional
    public CostSheet ensureSheet(MdmContract contract) {
        List<CostSheet> existing = sheetMapper.selectList(new LambdaQueryWrapper<CostSheet>()
                .eq(CostSheet::getContractId, contract.getId())
                .orderByDesc(CostSheet::getId));
        if (!existing.isEmpty()) {
            return existing.get(0);
        }
        CostSheet sheet = new CostSheet();
        sheet.setContractId(contract.getId());
        sheet.setCustomerId(contract.getCustomerId());
        sheet.setStatus("待填写");
        sheet.setOpsDone(0);
        sheet.setTechDone(0);
        sheet.setChangeVersion(0);
        sheet.setContractValue(contract.getAmount());
        String prefix = "CS-" + LocalDate.now().getYear() + "-";
        sheet.setCode(CodeGen.next(() -> {
            List<Object> objs = sheetMapper.selectObjs(new LambdaQueryWrapper<CostSheet>()
                    .select(CostSheet::getCode).orderByDesc(CostSheet::getId).last("LIMIT 1"));
            return objs.isEmpty() ? null : (String) objs.get(0);
        }, prefix));
        sheetMapper.insert(sheet);
        return sheet;
    }

    public SheetVo byContract(Long contractId) {
        MdmContract contract = contractMapper.selectById(contractId);
        if (contract == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "合同不存在");
        }
        return toVoDetail(ensureSheet(contract));
    }

    // ---------- 条目骨架（装配落地：合同行 → 产品类型 → BOM 组成 → 本部门生效条目） ----------

    /**
     * 骨架推导：合同行 ptype 命中产品类型 → 类型 BOM 材料 → 「适用资源」命中材料且本部门、生效的条目。
     * lines = 默认填报（按装配带出，可删可补回）；optional = 按需选配（默认不带出）；eligible = 本部门可增补全集。
     */
    public Map<String, Object> skeleton(Long id, String dept) {
        CostSheet sheet = mustGet(id);
        String d = normalizeDept(dept);
        List<MdmContractLine> cls = contractLineMapper.selectList(new LambdaQueryWrapper<MdmContractLine>()
                .eq(MdmContractLine::getContractId, sheet.getContractId()));
        Set<String> matKeys = new LinkedHashSet<>();
        Map<String, String> matFromType = new HashMap<>();
        List<String> typeNames = new ArrayList<>();
        for (MdmContractLine cl : cls) {
            if (!StringUtils.hasText(cl.getPtype())) {
                continue;
            }
            PrdProductType type = productTypeMapper.selectOne(new LambdaQueryWrapper<PrdProductType>()
                    .eq(PrdProductType::getName, cl.getPtype())
                    .eq(StringUtils.hasText(cl.getCat()), PrdProductType::getCat, cl.getCat())
                    .last("LIMIT 1"));
            if (type == null) {
                continue;
            }
            typeNames.add(type.getName());
            for (PrdTypeMaterial tm : typeMaterialMapper.selectList(new LambdaQueryWrapper<PrdTypeMaterial>()
                    .eq(PrdTypeMaterial::getTypeId, type.getId()))) {
                matKeys.add(tm.getMaterialKey());
                matFromType.putIfAbsent(tm.getMaterialKey(), type.getName());
            }
        }
        List<CostItem> deptItems = costItemMapper.selectList(new LambdaQueryWrapper<CostItem>()
                .eq(CostItem::getDept, d).eq(CostItem::getStatus, "生效").orderByAsc(CostItem::getId));
        List<Map<String, Object>> lines = new ArrayList<>();
        List<Map<String, Object>> optional = new ArrayList<>();
        Set<String> composedKeys = new LinkedHashSet<>();
        for (CostItem it : deptItems) {
            if (!StringUtils.hasText(it.getAppliesTo()) || !matKeys.contains(it.getAppliesTo())) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("itemKey", it.getItemKey());
            row.put("name", it.getName());
            row.put("costType", it.getCostType());
            row.put("calcMethod", it.getCalcMethod());
            row.put("sourceArchive", it.getSourceArchive());
            row.put("fromType", matFromType.get(it.getAppliesTo()));
            BigDecimal qty = qtyHint(it, cls);
            if (qty != null) {
                row.put("qty", qty);
            }
            composedKeys.add(it.getItemKey());
            if ("否".equals(it.getRequiredFlag())) {
                optional.add(row);
            } else {
                lines.add(row);
            }
        }
        // 受控增补（设计 §6.5）：仅可增补与本单产品类别有绑定关系的条目（cost_item_category）
        List<String> cats = cls.stream().map(MdmContractLine::getCat)
                .filter(StringUtils::hasText).distinct().collect(Collectors.toList());
        Set<String> boundKeys = cats.isEmpty() ? Set.of()
                : costItemCategoryMapper.selectList(new LambdaQueryWrapper<com.dmt.erp.prd.entity.CostItemCategory>()
                        .in(com.dmt.erp.prd.entity.CostItemCategory::getCat, cats))
                .stream().map(com.dmt.erp.prd.entity.CostItemCategory::getItemKey).collect(Collectors.toSet());
        List<Map<String, Object>> bound = new ArrayList<>();
        for (CostItem it : deptItems) {
            if (!boundKeys.contains(it.getItemKey()) || composedKeys.contains(it.getItemKey())) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("itemKey", it.getItemKey());
            row.put("name", it.getName());
            row.put("costType", it.getCostType());
            row.put("calcMethod", it.getCalcMethod());
            row.put("sourceArchive", it.getSourceArchive());
            bound.add(row);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("lines", lines);
        out.put("optional", optional);
        out.put("bound", bound);
        out.put("eligible", deptItems.stream().map(CostItem::getItemKey).collect(Collectors.toList()));
        out.put("types", typeNames.stream().distinct().collect(Collectors.toList()));
        out.put("cats", cats);
        return out;
    }

    /** 带宽类条目的数量提示：从合同行规格解析首个「数字+M」（如 单线 500M → 500） */
    private BigDecimal qtyHint(CostItem it, List<MdmContractLine> cls) {
        if (!"POOL_SHARE".equals(it.getCalcMethod()) && !"BGP_UTIL".equals(it.getCalcMethod())) {
            return null;
        }
        for (MdmContractLine cl : cls) {
            if (cl.getSpec() == null) {
                continue;
            }
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("(\\d+(?:\\.\\d+)?)\\s*M").matcher(cl.getSpec());
            if (m.find()) {
                return new BigDecimal(m.group(1));
            }
        }
        return null;
    }

    // ---------- 详情 / 填报 ----------

    public SheetVo detail(Long id) {
        return toVoDetail(mustGet(id));
    }

    private SheetVo toVoDetail(CostSheet s) {
        SheetVo vo = toVo(s);
        List<CostSheetLine> lines = lineMapper.selectList(new LambdaQueryWrapper<CostSheetLine>()
                .eq(CostSheetLine::getSheetId, s.getId()));
        vo.setOpsLines(lines.stream().filter(l -> DEPT_OPS.equals(l.getDept())).collect(Collectors.toList()));
        vo.setTechLines(lines.stream().filter(l -> DEPT_TECH.equals(l.getDept())).collect(Collectors.toList()));
        vo.setContractLines(contractLineMapper.selectList(new LambdaQueryWrapper<MdmContractLine>()
                .eq(MdmContractLine::getContractId, s.getContractId())));
        return vo;
    }

    private CostSheet mustGet(Long id) {
        CostSheet s = sheetMapper.selectById(id);
        if (s == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "核算单不存在");
        }
        return s;
    }

    /** 保存某部门条目行（未发起审批前可改）：整部门替换 + 指标重算 */
    @Transactional
    public void saveLines(Long id, LineSaveReq req) {
        CostSheet sheet = mustGet(id);
        if (!EDITABLE.contains(sheet.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "当前状态不允许修改条目行");
        }
        String dept = normalizeDept(req.getDept());
        Map<String, CostItem> items = loadItems(req.getLines().stream().map(LineSaveReq.LineReq::getItemKey).collect(Collectors.toSet()));
        lineMapper.delete(new LambdaQueryWrapper<CostSheetLine>()
                .eq(CostSheetLine::getSheetId, id).eq(CostSheetLine::getDept, dept));
        for (LineSaveReq.LineReq l : req.getLines()) {
            CostItem item = items.get(l.getItemKey());
            if (item == null) {
                throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "条目不存在：" + l.getItemKey());
            }
            CostSheetLine row = new CostSheetLine();
            row.setSheetId(id);
            row.setContractLineId(l.getContractLineId());
            row.setItemKey(l.getItemKey());
            row.setDept(dept);
            row.setQty(l.getQty());
            row.setMeta(l.getMeta());
            row.setAmount(l.getAmount());
            row.setCalcText(l.getCalcText());
            row.setPickSpec(l.getPickSpec());
            lineMapper.insert(row);
        }
        recompute(sheet);
    }

    private String normalizeDept(String dept) {
        if (DEPT_OPS.equals(dept) || DEPT_TECH.equals(dept)) {
            return dept;
        }
        throw new BizException(ResultCode.PARAM_INVALID, "部门必须是「支撑部」或「技术部」");
    }

    private Map<String, CostItem> loadItems(Set<String> keys) {
        if (keys.isEmpty()) {
            return Map.of();
        }
        return costItemMapper.selectList(new LambdaQueryWrapper<CostItem>().in(CostItem::getItemKey, keys))
                .stream().collect(Collectors.toMap(CostItem::getItemKey, x -> x, (a, b) -> a));
    }

    /** 周期性条目合计 → 月成本；合同月额取合同行月租合计（行缺失回退合同总额）；毛利率 = (1 - 月成本/合同月额) × 100 */
    private void recompute(CostSheet sheet) {
        List<CostSheetLine> all = lineMapper.selectList(new LambdaQueryWrapper<CostSheetLine>()
                .eq(CostSheetLine::getSheetId, sheet.getId()));
        Map<String, CostItem> items = loadItems(all.stream().map(CostSheetLine::getItemKey).collect(Collectors.toSet()));
        BigDecimal monthly = BigDecimal.ZERO;
        for (CostSheetLine l : all) {
            CostItem item = items.get(l.getItemKey());
            if (item != null && "周期性".equals(item.getCostType()) && l.getAmount() != null) {
                monthly = monthly.add(l.getAmount());
            }
        }
        sheet.setMonthlyCost(monthly);
        BigDecimal lineSum = contractLineMapper.selectList(new LambdaQueryWrapper<MdmContractLine>()
                        .eq(MdmContractLine::getContractId, sheet.getContractId()))
                .stream().map(MdmContractLine::getPrice).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (lineSum.compareTo(BigDecimal.ZERO) > 0) {
            sheet.setContractValue(lineSum);
        }
        if (sheet.getContractValue() != null && sheet.getContractValue().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal margin = BigDecimal.ONE.subtract(
                    monthly.divide(sheet.getContractValue(), 6, RoundingMode.HALF_UP));
            sheet.setMargin(margin.multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP));
        }
        sheetMapper.updateById(sheet);
    }

    /** 部门提交：两部门齐后可发起审批 */
    @Transactional
    public void submit(Long id, String dept) {
        CostSheet sheet = mustGet(id);
        if (!EDITABLE.contains(sheet.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "当前状态不允许提交");
        }
        String d = normalizeDept(dept);
        long cnt = lineMapper.selectCount(new LambdaQueryWrapper<CostSheetLine>()
                .eq(CostSheetLine::getSheetId, id).eq(CostSheetLine::getDept, d));
        if (cnt == 0) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, d + "尚未填写任何条目，不能提交");
        }
        if (DEPT_OPS.equals(d)) {
            sheet.setOpsDone(1);
            sheet.setStatus(sheet.getTechDone() == 1 ? "已齐套" : "待对方提交");
        } else {
            sheet.setTechDone(1);
            sheet.setStatus(sheet.getOpsDone() == 1 ? "已齐套" : "待填写");
        }
        sheetMapper.updateById(sheet);
    }

    /** 发起审批：两部门齐 → 生成签单快照（只增不改）→ 审批中（引擎流转 M3） */
    @Transactional
    public void startApproval(Long id) {
        CostSheet sheet = mustGet(id);
        if (!EDITABLE.contains(sheet.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "当前状态不允许发起审批");
        }
        if (sheet.getOpsDone() == 0 || sheet.getTechDone() == 0) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "两部门都提交后才允许发起审批");
        }
        CostSignSnapshot snap = new CostSignSnapshot();
        snap.setSheetId(id);
        snap.setSnapshotJson(buildSnapshotJson(sheet));
        snap.setLockedAt(LocalDateTime.now().toString());
        snapshotMapper.insert(snap);
        sheet.setStatus("审批中");
        Map<String, Object> form = new HashMap<>();
        form.put("monthlyCost", sheet.getMonthlyCost());
        form.put("margin", sheet.getMargin());
        form.put("contractValue", sheet.getContractValue());
        var inst = approvalEngine.submit("成本核算单", "提交", id, form);
        sheet.setCurNode(inst == null
                ? "核算单审批（未命中审批流，请在审批流配置挂接「成本核算单 · 提交」）"
                : "审批引擎流转中（进度见审批中心）");
        sheetMapper.updateById(sheet);
    }

    /** 签单快照：池水位 / 选用资源 / 条目金额演算 —— 计价相关变更此后一律走变更流程，不允许静默改快照 */
    private String buildSnapshotJson(CostSheet sheet) {
        MdmContract contract = contractMapper.selectById(sheet.getContractId());
        List<CostSheetLine> lines = lineMapper.selectList(new LambdaQueryWrapper<CostSheetLine>()
                .eq(CostSheetLine::getSheetId, sheet.getId()));
        List<Map<String, Object>> poolRows = poolMapper.selectList(new LambdaQueryWrapper<ResExitPool>()
                        .orderByAsc(ResExitPool::getId)).stream()
                .map(p -> {
                    Map<String, Object> m = new LinkedHashMap<String, Object>();
                    m.put("code", p.getCode());
                    m.put("name", p.getName());
                    m.put("capacityM", p.getCapacityM());
                    m.put("usedM", p.getUsedM());
                    m.put("rentMonth", p.getRentMonth());
                    return m;
                }).collect(Collectors.toList());
        Map<String, Object> json = new LinkedHashMap<String, Object>();
        json.put("sheetCode", sheet.getCode());
        json.put("contract", contract == null ? null : Map.of(
                "code", contract.getCode(), "amount", contract.getAmount(), "discount", contract.getDiscount()));
        json.put("monthlyCost", sheet.getMonthlyCost());
        json.put("margin", sheet.getMargin());
        json.put("pools", poolRows);
        json.put("lines", lines.stream().map(l -> {
            Map<String, Object> m = new LinkedHashMap<String, Object>();
            m.put("dept", l.getDept());
            m.put("itemKey", l.getItemKey());
            m.put("qty", l.getQty());
            m.put("amount", l.getAmount());
            m.put("calcText", l.getCalcText());
            m.put("pickSpec", l.getPickSpec());
            return m;
        }).collect(Collectors.toList()));
        json.put("takenAt", LocalDateTime.now().toString());
        return new com.fasterxml.jackson.databind.ObjectMapper().valueToTree(json).toString();
    }

    /** 签单快照查看（只增不改，取最新一次） */
    public CostSignSnapshot snapshot(Long id) {
        mustGet(id);
        return snapshotMapper.selectOne(new LambdaQueryWrapper<CostSignSnapshot>()
                .eq(CostSignSnapshot::getSheetId, id)
                .orderByDesc(CostSignSnapshot::getId)
                .last("LIMIT 1"));
    }

    /** 发起核算变更（已通过 → 变更中，补关联价差等） */
    public void change(Long id) {
        CostSheet sheet = mustGet(id);
        if (!"已通过".equals(sheet.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "仅「已通过」核算单可发起变更");
        }
        sheet.setStatus("变更中");
        sheet.setChangeVersion(sheet.getChangeVersion() + 1);
        sheetMapper.updateById(sheet);
    }
}
