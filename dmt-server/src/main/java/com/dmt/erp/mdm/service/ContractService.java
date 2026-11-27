package com.dmt.erp.mdm.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.dmt.erp.approval.service.ApprovalEngineService;
import com.dmt.erp.approval.service.WritebackRegistry;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.CodeGen;
import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.cost.service.CostSheetService;
import com.dmt.erp.mdm.dto.ContractQuery;
import com.dmt.erp.mdm.dto.ContractSaveReq;
import com.dmt.erp.mdm.entity.*;
import com.dmt.erp.mdm.mapper.*;
import com.dmt.erp.mdm.vo.ContractVo;
import com.dmt.erp.security.LoginUser;
import com.dmt.erp.security.SecurityUtils;
import com.dmt.erp.sys.entity.SysNotification;
import com.dmt.erp.sys.mapper.SysNotificationMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import com.dmt.erp.prd.entity.PrdProductType;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ContractService {

    private final MdmContractMapper contractMapper;
    private final MdmContractLineMapper lineMapper;
    private final MdmOpportunityMapper opportunityMapper;
    private final MdmCustomerMapper customerMapper;
    private final MdmEntityMapper entityMapper;
    private final MdmSpecialMapper specialMapper;
    private final SysNotificationMapper notificationMapper;
    private final CostSheetService costSheetService;
    private final ApprovalEngineService approvalEngine;
    private final WritebackRegistry writebackRegistry;
    private final com.dmt.erp.prd.mapper.PrdProductTypeMapper productTypeMapper;

    @PostConstruct
    void registerWriteback() {
        writebackRegistry.register("销售合同",
                this::onApproval,
                contractId -> {
                    Map<String, Object> form = new HashMap<>();
                    MdmContract c = contractMapper.selectById(contractId);
                    if (c != null) {
                        form.put("discount", c.getDiscount());
                        form.put("amount", c.getAmount());
                    }
                    return form;
                },
                id -> {
                    MdmContract c = contractMapper.selectById(id);
                    return c == null ? String.valueOf(id) : c.getCode();
                });
    }

    /** 审批写回：合同申请通过 → 待出合同（支撑部出具正式合同）；驳回 → 已驳回可修订 */
    public void onApproval(Long contractId, boolean pass) {
        MdmContract c = contractMapper.selectById(contractId);
        if (c == null) {
            return;
        }
        c.setStatus(pass ? "待出合同" : "已驳回");
        if (pass) {
            c.setStep(Math.max(c.getStep(), 1));
            appendVersion(c, "合同申请审批通过，转业务支撑部出具正式合同");
        } else {
            appendVersion(c, "合同申请被驳回");
        }
        contractMapper.updateById(c);
    }

    /** 提交合同审批（走审批引擎；未命中流程时保持原状态并提示） */
    public void submit(Long id) {
        MdmContract c = mustGet(id);
        if (!"审批中".equals(c.getStatus()) && !"待修订".equals(c.getStatus()) && !"已驳回".equals(c.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "当前状态不允许提交审批");
        }
        if (approvalEngine.activeInstance("销售合同", id) != null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "已在审批流程中");
        }
        Map<String, Object> form = new HashMap<>();
        form.put("discount", c.getDiscount());
        form.put("amount", c.getAmount());
        var inst = approvalEngine.submit("销售合同", "提交", id, form);
        if (inst == null) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "未命中已启用的合同审批流，请先在审批流配置挂接「销售合同 · 提交」");
        }
    }

    public PageResult<ContractVo> page(ContractQuery q) {
        Page<MdmContract> page = new Page<>(q.getPageNum(), Math.min(q.getPageSize(), 100));
        LambdaQueryWrapper<MdmContract> wrapper = new LambdaQueryWrapper<MdmContract>()
                .and(StringUtils.hasText(q.getKw()), x -> x.like(MdmContract::getCode, q.getKw()))
                .eq(StringUtils.hasText(q.getStatus()), MdmContract::getStatus, q.getStatus())
                .eq(q.getCustomerId() != null, MdmContract::getCustomerId, q.getCustomerId())
                .orderByDesc(MdmContract::getId);
        applyScope(wrapper);
        Page<MdmContract> result = contractMapper.selectPage(page, wrapper);
        Map<Long, String> customerNames = new HashMap<>();
        Map<Long, String> oppNames = new HashMap<>();
        Map<Long, String> entityNames = new HashMap<>();
        List<Long> custIds = result.getRecords().stream().map(MdmContract::getCustomerId).filter(Objects::nonNull).distinct().collect(Collectors.toList());
        List<Long> oppIds = result.getRecords().stream().map(MdmContract::getOpportunityId).filter(Objects::nonNull).distinct().collect(Collectors.toList());
        List<Long> entIds = result.getRecords().stream().map(MdmContract::getEntityId).filter(Objects::nonNull).distinct().collect(Collectors.toList());
        if (!custIds.isEmpty()) customerMapper.selectBatchIds(custIds).forEach(c -> customerNames.put(c.getId(), c.getName()));
        if (!oppIds.isEmpty()) opportunityMapper.selectBatchIds(oppIds).forEach(o -> oppNames.put(o.getId(), o.getName()));
        if (!entIds.isEmpty()) entityMapper.selectBatchIds(entIds).forEach(e -> entityNames.put(e.getId(), e.getShortName()));
        Map<Long, List<MdmContractLine>> linesByCt = new HashMap<>();
        List<Long> ctIds = result.getRecords().stream().map(MdmContract::getId).collect(Collectors.toList());
        if (!ctIds.isEmpty()) {
            lineMapper.selectList(new LambdaQueryWrapper<MdmContractLine>()
                            .in(MdmContractLine::getContractId, ctIds))
                    .forEach(l -> linesByCt.computeIfAbsent(l.getContractId(), k -> new java.util.ArrayList<>()).add(l));
        }
        return PageResult.of(result.convert(c -> {
            ContractVo vo = new ContractVo();
            BeanUtils.copyProperties(c, vo);
            vo.setCustomerName(customerNames.get(c.getCustomerId()));
            vo.setOpportunityName(oppNames.get(c.getOpportunityId()));
            vo.setEntityName(entityNames.get(c.getEntityId()));
            List<MdmContractLine> ls = linesByCt.getOrDefault(c.getId(), List.of());
            vo.setMonthlyFee(ls.stream().map(l -> l.getPrice() == null ? java.math.BigDecimal.ZERO : l.getPrice())
                    .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add));
            vo.setLinesSummary(ls.stream()
                    .map(l -> l.getPtype() != null ? l.getPtype() : (l.getSpec() != null ? l.getSpec() : l.getCat()))
                    .filter(Objects::nonNull).distinct().collect(Collectors.joining(" + ")));
            return vo;
        }));
    }

    public ContractVo detail(Long id) {
        MdmContract c = contractMapper.selectById(id);
        if (c == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "合同不存在");
        }
        ContractVo vo = new ContractVo();
        BeanUtils.copyProperties(c, vo);
        vo.setLines(lineMapper.selectList(new LambdaQueryWrapper<MdmContractLine>()
                .eq(MdmContractLine::getContractId, id)));
        vo.setVersions(parseVersions(c.getVersionsJson()));
        MdmOpportunity opp = opportunityMapper.selectById(c.getOpportunityId());
        vo.setOpportunityName(opp == null ? null : opp.getName());
        MdmCustomer customer = customerMapper.selectById(c.getCustomerId());
        vo.setCustomerName(customer == null ? null : customer.getName());
        MdmEntity entity = entityMapper.selectById(c.getEntityId());
        vo.setEntityName(entity == null ? null : entity.getShortName());
        return vo;
    }

    @Transactional
    public Long create(ContractSaveReq req) {
        validateDiscount(req.getSpecialId(), req.getDiscount());
        MdmContract c = new MdmContract();
        BeanUtils.copyProperties(req, c);
        c.setStatus("审批中");
        c.setStep(0);
        c.setDiscount(req.getDiscount() == null ? BigDecimal.ZERO : req.getDiscount());
        String prefix = "CT-" + LocalDate.now().getYear() + "-";
        c.setCode(CodeGen.next(() -> {
            List<Object> objs = contractMapper.selectObjs(new LambdaQueryWrapper<MdmContract>()
                    .select(MdmContract::getCode).orderByDesc(MdmContract::getId).last("LIMIT 1"));
            return objs.isEmpty() ? null : (String) objs.get(0);
        }, prefix));
        try {
            contractMapper.insert(c);
        } catch (DuplicateKeyException e) {
            throw mapDuplicate(e);
        }
        saveLines(c.getId(), req);
        Map<String, Object> form = new HashMap<>();
        form.put("discount", c.getDiscount());
        form.put("amount", c.getAmount());
        approvalEngine.submit("销售合同", "提交", c.getId(), form);
        appendVersion(c, "销售提交合同申请（关联商机 " + (c.getOpportunityId() == null ? "—" : String.valueOf(c.getOpportunityId()))
                + (c.getSpecialId() != null ? "，特批 " + c.getSpecialId() : "，标准合同") + "）");
        contractMapper.updateById(c);
        return c.getId();
    }

    @Transactional
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseVersions(String json) {
        if (!StringUtils.hasText(json)) {
            return List.of();
        }
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().readValue(json, List.class);
        } catch (Exception e) {
            return List.of();
        }
    }

    /** 版本留痕：只增不改（创建 / 审批通过 / 生效 / 终止 / 修订） */
    private void appendVersion(MdmContract c, String note) {
        List<Map<String, Object>> versions = new ArrayList<>(parseVersions(c.getVersionsJson()));
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("v", versions.size() + 1);
        v.put("note", note);
        v.put("at", java.time.LocalDate.now().toString());
        versions.add(v);
        try {
            c.setVersionsJson(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(versions));
        } catch (Exception ignored) {
        }
    }

    public void update(ContractSaveReq req) {
        MdmContract c = contractMapper.selectById(req.getId());
        if (c == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "合同不存在");
        }
        if (!"已驳回".equals(c.getStatus()) && !"待修订".equals(c.getStatus()) && !"审批中".equals(c.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "当前状态不允许修订");
        }
        validateDiscount(req.getSpecialId(), req.getDiscount());
        boolean toRevise = "待修订".equals(req.getStatus()) && !"待修订".equals(c.getStatus());
        BeanUtils.copyProperties(req, c, "code", "status", "step");
        c.setDiscount(req.getDiscount() == null ? BigDecimal.ZERO : req.getDiscount());
        if (StringUtils.hasText(req.getStatus())) {
            c.setStatus(req.getStatus());
        }
        if (toRevise) {
            appendVersion(c, "合同修订：" + (StringUtils.hasText(req.getReviseNote()) ? req.getReviseNote() : "转入待修订，修改后重新提交审批"));
        }
        try {
            contractMapper.updateById(c);
        } catch (DuplicateKeyException e) {
            throw mapDuplicate(e);
        }
        saveLines(c.getId(), req);
    }

    /** 合同阶段推进：审批中已由引擎接管时禁止手工推进；其余按 审批中 → 待出合同 → 待用章 → 签署中 手动流转 */
    public void step(Long id) {
        MdmContract c = mustGet(id);
        if ("审批中".equals(c.getStatus()) && approvalEngine.activeInstance("销售合同", id) != null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "该合同已由审批引擎接管，请在审批中心完成审批");
        }
        String next = switch (c.getStatus()) {
            case "审批中" -> "待出合同";
            case "待出合同" -> "待用章";
            case "待用章" -> "签署中";
            default -> throw new BizException(ResultCode.STATE_CONFLICT, "当前状态不能推进，请直接生效或终止");
        };
        c.setStatus(next);
        c.setStep(c.getStep() + 1);
        contractMapper.updateById(c);
    }

    /** 合同生效：生成订单行快照语义（行即快照源）、商机置赢单、通知归属销售、核算单自动建档；审批写回为 M3 钩子 */
    @Transactional
    public void effect(Long id) {
        MdmContract c = mustGet(id);
        if (!"签署中".equals(c.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "仅「签署中」合同可生效");
        }
        c.setStatus("已生效");
        c.setStep(c.getStep() + 1);
        contractMapper.updateById(c);
        MdmOpportunity opp = opportunityMapper.selectById(c.getOpportunityId());
        if (opp != null && !"赢单".equals(opp.getStage())) {
            opp.setStage("赢单");
            opportunityMapper.updateById(opp);
        }
        costSheetService.ensureSheet(c);
        appendVersion(c, "合同生效：双方签署版归档，核算单自动建档");
        contractMapper.updateById(c);
        if (opp != null && opp.getSalesId() != null) {
            SysNotification n = new SysNotification();
            n.setUserId(opp.getSalesId());
            n.setType("CONTRACT");
            n.setTitle("合同已生效");
            n.setContent("合同 " + c.getCode() + " 已生效，核算单 " + "已自动建档");
            n.setIsRead(0);
            n.setRefType("contract");
            n.setRefId(c.getId());
            notificationMapper.insert(n);
        }
    }

    public void terminate(Long id) {
        MdmContract c = mustGet(id);
        if ("已生效".equals(c.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "已生效合同请走终止审批流程");
        }
        c.setStatus("已终止");
        appendVersion(c, "合同终止（客户拒签/协商一致）");
        contractMapper.updateById(c);
    }

    private MdmContract mustGet(Long id) {
        MdmContract c = contractMapper.selectById(id);
        if (c == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "合同不存在");
        }
        return c;
    }

    /** 折扣校验：>0 必须关联已通过特批且折扣一致（契约 6.2） */
    private void validateDiscount(Long specialId, BigDecimal discount) {
        if (discount == null || discount.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        if (specialId == null) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "折扣大于 0 必须关联特批申请");
        }
        MdmSpecial special = specialMapper.selectById(specialId);
        if (special == null || !"已通过".equals(special.getStatus())) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "关联的特批申请未通过");
        }
        if (special.getDiscount().compareTo(discount) != 0) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "合同折扣必须与特批折扣一致");
        }
    }

    private void saveLines(Long contractId, ContractSaveReq req) {
        if (req.getLines() == null) {
            return;
        }
        lineMapper.delete(new LambdaQueryWrapper<MdmContractLine>().eq(MdmContractLine::getContractId, contractId));
        req.getLines().stream().filter(l -> StringUtils.hasText(l.getCat())).forEach(l -> {
            MdmContractLine line = new MdmContractLine();
            line.setContractId(contractId);
            line.setCat(l.getCat());
            line.setPtype(l.getPtype());
            Map<String, String> specs = l.getSpecs() == null ? Map.of() : l.getSpecs();
            line.setSpecsJson(writeJson(specs));
            line.setSpec(buildSpecText(l.getCat(), l.getPtype(), specs));
            line.setPrice(l.getPrice());
            lineMapper.insert(line);
        });
    }

    private String writeJson(Object value) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(value);
        } catch (Exception e) {
            return null;
        }
    }

    /** 规格摘要：由产品定义的规格字段模板拼接（如「带宽 500M · IP 个数 8」），不允许自由输入 */
    private String buildSpecText(String cat, String ptype, Map<String, String> specs) {
        if (specs.isEmpty()) {
            return null;
        }
        List<PrdProductType> types = productTypeMapper.selectList(new LambdaQueryWrapper<PrdProductType>()
                .eq(PrdProductType::getCat, cat).eq(PrdProductType::getName, ptype));
        if (types.isEmpty()) {
            return null;
        }
        String fieldsJson = types.get(0).getSpecFieldsJson();
        if (!StringUtils.hasText(fieldsJson)) {
            return null;
        }
        try {
            List<Map<String, Object>> fields = new com.fasterxml.jackson.databind.ObjectMapper().readValue(fieldsJson, List.class);
            List<String> parts = new ArrayList<>();
            for (Map<String, Object> f : fields) {
                String v = specs.get(String.valueOf(f.get("key")));
                if (StringUtils.hasText(v)) {
                    parts.add(f.get("label") + " " + v);
                }
            }
            return parts.isEmpty() ? null : String.join(" · ", parts);
        } catch (Exception e) {
            return null;
        }
    }

    private BizException mapDuplicate(DuplicateKeyException e) {
        String msg = e.getMessage() == null ? "" : e.getMessage();
        if (msg.contains("uk_contract_active_opp")) {
            return new BizException(ResultCode.BIZ_RULE_VIOLATION, "该商机已有在途合同");
        }
        return new BizException(ResultCode.BIZ_RULE_VIOLATION, "合同编码冲突，请重试");
    }

    /** 合同数据范围：沿「合同 → 商机 → 客户归属销售」解析（契约 §3.3 归属人链路） */
    private void applyScope(LambdaQueryWrapper<MdmContract> wrapper) {
        LoginUser me = SecurityUtils.currentUser().orElse(null);
        if (me == null || me.getDataScope() == LoginUser.DataScope.ALL) {
            return;
        }
        if (me.getDataScope() == LoginUser.DataScope.DEPT) {
            wrapper.inSql(MdmContract::getOpportunityId,
                    "SELECT id FROM mdm_opportunity WHERE deleted = 0 AND sales_id IN "
                            + "(SELECT id FROM sys_user WHERE dept_id = " + me.getDeptId() + " AND deleted = 0)");
        } else {
            wrapper.inSql(MdmContract::getOpportunityId,
                    "SELECT id FROM mdm_opportunity WHERE deleted = 0 AND sales_id = " + me.getUserId());
        }
    }
}
