package com.dmt.erp.wo.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.dmt.erp.approval.service.ApprovalEngineService;
import com.dmt.erp.approval.service.WritebackRegistry;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.CodeGen;
import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.cost.entity.CostSheet;
import com.dmt.erp.cost.entity.CostSheetLine;
import com.dmt.erp.cost.mapper.CostSheetLineMapper;
import com.dmt.erp.cost.mapper.CostSheetMapper;
import com.dmt.erp.mdm.entity.MdmContract;
import com.dmt.erp.mdm.entity.MdmCustomer;
import com.dmt.erp.mdm.mapper.MdmContractMapper;
import com.dmt.erp.mdm.mapper.MdmCustomerMapper;
import com.dmt.erp.prd.entity.ResEquipment;
import com.dmt.erp.prd.entity.ResExitPool;
import com.dmt.erp.prd.entity.ResIpSegment;
import com.dmt.erp.prd.mapper.ResEquipmentMapper;
import com.dmt.erp.prd.mapper.ResExitPoolMapper;
import com.dmt.erp.prd.mapper.ResIpSegmentMapper;
import com.dmt.erp.security.LoginUser;
import com.dmt.erp.security.SecurityUtils;
import com.dmt.erp.wo.dto.AssignmentApplyReq;
import com.dmt.erp.wo.entity.ResAssignment;
import com.dmt.erp.wo.entity.ResDeductRecord;
import com.dmt.erp.wo.entity.WoTask;
import com.dmt.erp.wo.entity.WoWorkOrder;
import com.dmt.erp.wo.mapper.ResAssignmentMapper;
import com.dmt.erp.wo.mapper.ResDeductRecordMapper;
import com.dmt.erp.wo.mapper.WoTaskMapper;
import com.dmt.erp.wo.mapper.WoWorkOrderMapper;
import com.dmt.erp.wo.vo.WoVo;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 交付域（M4）：核算单审批通过自动生成工单 → 可用性检查（IP/CPE 自动、负载人工结论）
 * → 资源分配申请（走审批引擎）→ 绑定扣减（事务 + 流水）→ 完工锁交付快照 → 激活计费（M5 钩子）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WoService {

    public static final String[] TASK_NAMES = {
            "资源可用性检查", "资源分配申请", "资源分配审批", "资源绑定与扣减", "开通实施", "开通确认", "激活计费"};

    private final WoWorkOrderMapper woMapper;
    private final WoTaskMapper taskMapper;
    private final ResAssignmentMapper assignmentMapper;
    private final ResDeductRecordMapper deductMapper;
    private final CostSheetMapper sheetMapper;
    private final CostSheetLineMapper sheetLineMapper;
    private final MdmContractMapper contractMapper;
    private final MdmCustomerMapper customerMapper;
    private final ResEquipmentMapper equipmentMapper;
    private final ResExitPoolMapper poolMapper;
    private final ResIpSegmentMapper ipSegmentMapper;
    private final com.dmt.erp.prd.mapper.ResExitLineMapper exitLineMapper;
    private final ApprovalEngineService approvalEngine;
    private final WritebackRegistry writebackRegistry;

    @PostConstruct
    void registerWriteback() {
        writebackRegistry.register("资源分配",
                this::onAssignmentApproval,
                woId -> Map.of("woId", woId),
                id -> {
                    WoWorkOrder wo = woMapper.selectById(id);
                    return wo == null ? String.valueOf(id) : wo.getCode();
                });
    }

    /** 资源分配审批写回：通过 → 分配单转「审批」可绑定；驳回 → 回「申请」重新调整 */
    public void onAssignmentApproval(Long woId, boolean pass) {
        assignmentMapper.update(null, new LambdaUpdateWrapper<ResAssignment>()
                .eq(ResAssignment::getWoId, woId)
                .eq(ResAssignment::getStatus, pass ? "申请" : "审批")
                .set(ResAssignment::getStatus, pass ? "审批" : "申请"));
    }

    // ---------- 生成 ----------

    /** 核算单审批通过钩子：自动生成开通工单 + 七步任务 */
    @Transactional
    public WoWorkOrder generateFromSheet(CostSheet sheet) {
        List<WoWorkOrder> existing = woMapper.selectList(new LambdaQueryWrapper<WoWorkOrder>()
                .eq(WoWorkOrder::getSheetId, sheet.getId()).orderByDesc(WoWorkOrder::getId));
        if (!existing.isEmpty()) {
            return existing.get(0);
        }
        WoWorkOrder wo = new WoWorkOrder();
        wo.setSheetId(sheet.getId());
        wo.setContractId(sheet.getContractId());
        wo.setStatus("已生成");
        wo.setDeadline(LocalDate.now().plusDays(7));
        wo.setOwner("运维");
        String prefix = "WO-" + LocalDate.now().getYear() + "-";
        wo.setCode(CodeGen.next(() -> {
            List<Object> objs = woMapper.selectObjs(new LambdaQueryWrapper<WoWorkOrder>()
                    .select(WoWorkOrder::getCode).orderByDesc(WoWorkOrder::getId).last("LIMIT 1"));
            return objs.isEmpty() ? null : (String) objs.get(0);
        }, prefix));
        woMapper.insert(wo);
        for (int i = 0; i < TASK_NAMES.length; i++) {
            WoTask t = new WoTask();
            t.setWoId(wo.getId());
            t.setName(TASK_NAMES[i]);
            t.setSort(i + 1);
            t.setDone(0);
            taskMapper.insert(t);
        }
        return wo;
    }

    // ---------- 查询 ----------

    public PageResult<WoVo> page(String status, long pageNum, long pageSize) {
        Page<WoWorkOrder> page = new Page<>(pageNum, Math.min(pageSize, 100));
        LambdaQueryWrapper<WoWorkOrder> wrapper = new LambdaQueryWrapper<WoWorkOrder>()
                .eq(StringUtils.hasText(status), WoWorkOrder::getStatus, status)
                .orderByDesc(WoWorkOrder::getId);
        applyScope(wrapper);
        return PageResult.of(woMapper.selectPage(page, wrapper).convert(this::toVo));
    }

    private void applyScope(LambdaQueryWrapper<WoWorkOrder> wrapper) {
        LoginUser me = SecurityUtils.currentUser().orElse(null);
        if (me == null || me.getDataScope() == LoginUser.DataScope.ALL) {
            return;
        }
        if (me.getDataScope() == LoginUser.DataScope.DEPT) {
            wrapper.inSql(WoWorkOrder::getContractId,
                    "SELECT id FROM mdm_contract WHERE deleted = 0 AND opportunity_id IN "
                            + "(SELECT id FROM mdm_opportunity WHERE deleted = 0 AND sales_id IN "
                            + "(SELECT id FROM sys_user WHERE dept_id = " + me.getDeptId() + " AND deleted = 0))");
        } else {
            wrapper.inSql(WoWorkOrder::getContractId,
                    "SELECT id FROM mdm_contract WHERE deleted = 0 AND opportunity_id IN "
                            + "(SELECT id FROM mdm_opportunity WHERE deleted = 0 AND sales_id = " + me.getUserId() + ")");
        }
    }

    public WoVo detail(Long id) {
        WoWorkOrder wo = woMapper.selectById(id);
        if (wo == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "工单不存在");
        }
        return toVo(wo);
    }

    public WoVo bySheet(Long sheetId) {
        CostSheet sheet = sheetMapper.selectById(sheetId);
        if (sheet == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "核算单不存在");
        }
        return toVo(generateFromSheet(sheet));
    }

    private WoVo toVo(WoWorkOrder wo) {
        WoVo vo = new WoVo();
        org.springframework.beans.BeanUtils.copyProperties(wo, vo);
        CostSheet sheet = sheetMapper.selectById(wo.getSheetId());
        vo.setSheetCode(sheet == null ? null : sheet.getCode());
        MdmContract c = contractMapper.selectById(wo.getContractId());
        if (c != null) {
            vo.setContractCode(c.getCode());
            MdmCustomer cust = customerMapper.selectById(c.getCustomerId());
            vo.setCustomerName(cust == null ? null : cust.getName());
        }
        vo.setTasks(taskMapper.selectList(new LambdaQueryWrapper<WoTask>()
                .eq(WoTask::getWoId, wo.getId()).orderByAsc(WoTask::getSort)));
        List<ResAssignment> assignments = assignmentMapper.selectList(new LambdaQueryWrapper<ResAssignment>()
                .eq(ResAssignment::getWoId, wo.getId()));
        List<WoVo.AssignmentVo> avs = assignments.stream().map(a -> {
            WoVo.AssignmentVo av = new WoVo.AssignmentVo();
            org.springframework.beans.BeanUtils.copyProperties(a, av);
            av.setRefName(refName(a));
            return av;
        }).collect(Collectors.toList());
        vo.setAssignments(avs);
        List<Long> assignmentIds = assignments.stream().map(ResAssignment::getId).collect(Collectors.toList());
        vo.setDeductRecords(assignmentIds.isEmpty() ? List.of() : deductMapper.selectList(
                new LambdaQueryWrapper<ResDeductRecord>().in(ResDeductRecord::getAssignmentId, assignmentIds)));
        return vo;
    }

    private String refName(ResAssignment a) {
        if (a.getRefId() == null) {
            return null;
        }
        return switch (a.getKind()) {
            case "CPE" -> {
                ResEquipment e = equipmentMapper.selectById(a.getRefId());
                yield e == null ? null : e.getName();
            }
            case "出口带宽" -> {
                ResExitPool p = poolMapper.selectById(a.getRefId());
                yield p == null ? null : p.getName();
            }
            case "IP" -> {
                ResIpSegment s = ipSegmentMapper.selectById(a.getRefId());
                yield s == null ? null : s.getSeg();
            }
            default -> {
                com.dmt.erp.prd.entity.ResExitLine l = exitLineMapper.selectById(a.getRefId());
                yield l == null ? null : l.getName();
            }
        };
    }

    // ---------- 可用性检查（IP/CPE 自动；负载人工评估结论录入） ----------

    @Transactional
    public Map<String, Object> availabilityCheck(Long woId, String loadConclusion) {
        WoWorkOrder wo = mustGet(woId);
        if (!"已生成".equals(wo.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "当前状态不能做可用性检查");
        }
        List<CostSheetLine> lines = sheetLineMapper.selectList(new LambdaQueryWrapper<CostSheetLine>()
                .eq(CostSheetLine::getSheetId, wo.getSheetId()));
        Map<String, BigDecimal> need = new LinkedHashMap<>();
        for (CostSheetLine l : lines) {
            if (l.getQty() != null) {
                need.merge(l.getItemKey(), l.getQty(), BigDecimal::add);
            }
        }
        List<String> problems = new ArrayList<>();
        // 出口带宽：需求 vs 全部池剩余
        BigDecimal bwNeed = need.getOrDefault("exit_bandwidth", BigDecimal.ZERO);
        if (bwNeed.compareTo(BigDecimal.ZERO) > 0) {
            int remain = poolMapper.selectList(new LambdaQueryWrapper<ResExitPool>()).stream()
                    .mapToInt(p -> Math.max(p.getCapacityM() - p.getUsedM(), 0)).sum();
            if (remain < bwNeed.intValue()) {
                problems.add("出口带宽不足：需 " + bwNeed + "M，全池剩余 " + remain + "M");
            }
        }
        // IP：需求个数 vs 可用段数
        BigDecimal ipNeed = need.getOrDefault("ip_fee", BigDecimal.ZERO);
        if (ipNeed.compareTo(BigDecimal.ZERO) > 0) {
            long available = ipSegmentMapper.selectCount(new LambdaQueryWrapper<ResIpSegment>()
                    .eq(ResIpSegment::getStatus, "可用"));
            if (available < ipNeed.longValue()) {
                problems.add("IP 段不足：需 " + ipNeed + " 段，可用 " + available + " 段");
            }
        }
        // CPE：需求台数 vs 可用库存
        BigDecimal cpeNeed = need.getOrDefault("cpe_device", BigDecimal.ZERO);
        if (cpeNeed.compareTo(BigDecimal.ZERO) > 0) {
            int stock = equipmentMapper.selectList(new LambdaQueryWrapper<ResEquipment>()).stream()
                    .mapToInt(e -> Math.max(e.getStock() - e.getLocked(), 0)).sum();
            if (stock < cpeNeed.intValue()) {
                problems.add("CPE 库存不足：需 " + cpeNeed + " 台，可用 " + stock + " 台");
            }
        }
        markTask(woId, 1, true);
        wo.setStatus("资源分配申请");
        woMapper.updateById(wo);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("pass", problems.isEmpty());
        result.put("problems", problems);
        result.put("loadConclusion", StringUtils.hasText(loadConclusion) ? loadConclusion : "（出口负载人工评估结论未填写）");
        result.put("note", "IP/CPE 余量系统自动校验；出口负载由工程师人工评估，系统不做流量预测");
        return result;
    }

    // ---------- 资源分配申请（走审批引擎） ----------

    @Transactional
    public void applyAssignments(Long woId, AssignmentApplyReq req) {
        WoWorkOrder wo = mustGet(woId);
        if (!"资源分配申请".equals(wo.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "请先完成资源可用性检查");
        }
        if (approvalEngine.activeInstance("资源分配", woId) != null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "资源分配审批已在途");
        }
        if (req.getItems() != null) {
            for (AssignmentApplyReq.Item item : req.getItems()) {
                ResAssignment a = new ResAssignment();
                a.setWoId(woId);
                a.setKind(item.getKind());
                a.setRefId(item.getRefId());
                a.setQty(item.getQty());
                a.setStatus("申请");
                assignmentMapper.insert(a);
            }
        }
        markTask(woId, 2, true);
        wo.setStatus("资源分配审批");
        woMapper.updateById(wo);
        approvalEngine.submit("资源分配", "申请", woId, Map.of("woId", woId));
    }

    // ---------- 绑定扣减（事务 + 流水） ----------

    @Transactional
    public void bind(Long assignmentId) {
        LoginUser me = SecurityUtils.currentUser().orElse(null);
        ResAssignment a = assignmentMapper.selectById(assignmentId);
        if (a == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "资源分配单不存在");
        }
        if (!"审批".equals(a.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "分配单未审批通过，不能绑定扣减");
        }
        WoWorkOrder wo = mustGet(a.getWoId());
        int before;
        int after;
        switch (a.getKind()) {
            case "CPE" -> {
                ResEquipment e = equipmentMapper.selectById(a.getRefId());
                if (e == null) {
                    throw new BizException(ResultCode.STATE_CONFLICT, "设备档案不存在");
                }
                int available = e.getStock() - e.getLocked();
                if (available < a.getQty()) {
                    throw new BizException(ResultCode.INSUFFICIENT_STOCK,
                            "设备「" + e.getName() + "」可用 " + available + " 台，需 " + a.getQty() + " 台");
                }
                before = e.getLocked();
                e.setLocked(e.getLocked() + a.getQty());
                after = e.getLocked();
                equipmentMapper.updateById(e);
            }
            case "出口带宽" -> {
                ResExitPool p = poolMapper.selectById(a.getRefId());
                if (p == null) {
                    throw new BizException(ResultCode.STATE_CONFLICT, "出口池不存在");
                }
                if (p.getUsedM() + a.getQty() > p.getCapacityM()) {
                    throw new BizException(ResultCode.INSUFFICIENT_STOCK,
                            "出口池「" + p.getName() + "」剩余 " + (p.getCapacityM() - p.getUsedM()) + "M，需 " + a.getQty() + "M");
                }
                before = p.getUsedM();
                p.setUsedM(p.getUsedM() + a.getQty());
                after = p.getUsedM();
                poolMapper.updateById(p);
            }
            case "IP" -> {
                ResIpSegment seg = ipSegmentMapper.selectById(a.getRefId());
                if (seg == null) {
                    throw new BizException(ResultCode.STATE_CONFLICT, "IP 段不存在");
                }
                if (!"可用".equals(seg.getStatus())) {
                    throw new BizException(ResultCode.STATE_CONFLICT, "IP 段 " + seg.getSeg() + " 已分配");
                }
                before = seg.getCount();
                seg.setStatus("已分配");
                ipSegmentMapper.updateById(seg);
                after = seg.getCount();
            }
            default -> {
                before = 0;
                after = 0;
            }
        }
        ResDeductRecord record = new ResDeductRecord();
        record.setAssignmentId(assignmentId);
        record.setRefId(a.getRefId());
        record.setBeforeQty(before);
        record.setAfterQty(after);
        record.setActedBy(me == null ? null : me.getUserId());
        record.setActedAt(LocalDateTime.now());
        deductMapper.insert(record);

        a.setStatus("绑定");
        assignmentMapper.updateById(a);

        long unbound = assignmentMapper.selectCount(new LambdaQueryWrapper<ResAssignment>()
                .eq(ResAssignment::getWoId, a.getWoId())
                .ne(ResAssignment::getStatus, "绑定"));
        if (unbound == 0) {
            markTask(wo.getId(), 4, true);
            wo.setStatus("开通实施");
            woMapper.updateById(wo);
        }
    }

    // ---------- 完工 / 激活 ----------

    /** 开通确认：把实际分配的资源固化进交付快照（计费与月结依据，契约 §4.4） */
    @Transactional
    public void complete(Long woId) {
        WoWorkOrder wo = mustGet(woId);
        if (!"开通实施".equals(wo.getStatus()) && !"资源绑定与扣减".equals(wo.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "当前状态不能开通确认");
        }
        List<ResAssignment> bound = assignmentMapper.selectList(new LambdaQueryWrapper<ResAssignment>()
                .eq(ResAssignment::getWoId, woId).eq(ResAssignment::getStatus, "绑定"));
        List<Map<String, Object>> snapshot = bound.stream().map(a -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("kind", a.getKind());
            m.put("refId", a.getRefId());
            m.put("refName", refName(a));
            m.put("qty", a.getQty());
            return m;
        }).collect(Collectors.toList());
        wo.setDeliverySnapshot(new com.fasterxml.jackson.databind.ObjectMapper().valueToTree(snapshot).toString());
        markTask(woId, 6, true);
        wo.setStatus("开通确认");
        woMapper.updateById(wo);
    }

    /** 激活计费（M5 财务域钩子位：账单生成接此状态） */
    public void activate(Long woId) {
        WoWorkOrder wo = mustGet(woId);
        if (!"开通确认".equals(wo.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "请先完成开通确认");
        }
        markTask(woId, 7, true);
        wo.setStatus("激活计费");
        woMapper.updateById(wo);
    }

    // ---------- 内部 ----------

    private WoWorkOrder mustGet(Long id) {
        WoWorkOrder wo = woMapper.selectById(id);
        if (wo == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "工单不存在");
        }
        return wo;
    }

    private void markTask(Long woId, int sort, boolean done) {
        taskMapper.update(null, new LambdaUpdateWrapper<WoTask>()
                .eq(WoTask::getWoId, woId)
                .eq(WoTask::getSort, sort)
                .set(WoTask::getDone, done ? 1 : 0));
    }
}
