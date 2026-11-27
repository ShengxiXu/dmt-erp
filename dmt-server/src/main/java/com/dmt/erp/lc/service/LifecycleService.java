package com.dmt.erp.lc.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.approval.service.ApprovalEngineService;
import com.dmt.erp.approval.service.WritebackRegistry;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.CodeGen;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.lc.entity.LcChange;
import com.dmt.erp.lc.entity.LcTerminate;
import com.dmt.erp.lc.mapper.LcChangeMapper;
import com.dmt.erp.lc.mapper.LcTerminateMapper;
import com.dmt.erp.mdm.entity.MdmContract;
import com.dmt.erp.mdm.entity.MdmContractLine;
import com.dmt.erp.mdm.entity.MdmCustomer;
import com.dmt.erp.mdm.mapper.MdmContractLineMapper;
import com.dmt.erp.mdm.mapper.MdmContractMapper;
import com.dmt.erp.mdm.mapper.MdmCustomerMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 客户生命周期（P05 订阅变更 / P06 退订与资源回收）：
 * 订阅 = 已生效合同行推导（SUB-{contractId}-{lineId}）；变更/退订走审批引擎，通过后写回状态；
 * 退订生效自动生成回收任务（CPE 回库 / IP 释放 / 配置清除，执行留痕）。
 */
@Service
@RequiredArgsConstructor
public class LifecycleService {

    private final LcChangeMapper changeMapper;
    private final LcTerminateMapper terminateMapper;
    private final MdmContractMapper contractMapper;
    private final MdmContractLineMapper lineMapper;
    private final MdmCustomerMapper customerMapper;
    private final ApprovalEngineService approvalEngine;
    private final WritebackRegistry writebackRegistry;
    private final com.dmt.erp.sys.mapper.SysConfigMapper sysConfigMapper;
    private final com.dmt.erp.fin.service.SuspendTicketService suspendTicketService;

    @PostConstruct
    void registerWriteback() {
        writebackRegistry.register("订阅变更",
                this::onChangeApproval,
                id -> Map.of("changeId", id),
                id -> {
                    LcChange c = changeMapper.selectById(id);
                    return c == null ? String.valueOf(id) : c.getChNo();
                });
        writebackRegistry.register("退订申请",
                this::onTerminateApproval,
                id -> Map.of("terminateId", id),
                id -> {
                    LcTerminate t = terminateMapper.selectById(id);
                    return t == null ? String.valueOf(id) : t.getTmNo();
                });
    }

    public void onChangeApproval(Long id, boolean pass) {
        LcChange c = changeMapper.selectById(id);
        if (c == null) {
            return;
        }
        c.setStatus(pass ? "已生效" : "已驳回");
        if (!pass) {
            c.setRejectNote("订阅变更审批被驳回（见审批中心意见）");
        }
        changeMapper.updateById(c);
    }

    public void onTerminateApproval(Long id, boolean pass) {
        LcTerminate t = terminateMapper.selectById(id);
        if (t == null) {
            return;
        }
        if (pass) {
            t.setStatus("退订生效");
            t.setRecoverStatus("待执行");
        } else {
            t.setStatus("已驳回");
            t.setRejectNote("退订审批被驳回（见审批中心意见）");
        }
        terminateMapper.updateById(t);
    }

    // ---------- 订阅（合同行推导） ----------

    /** 订阅视图：已生效合同的行级展开；退订生效记录覆盖状态 */
    public List<Map<String, Object>> subscriptions() {
        List<MdmContract> contracts = contractMapper.selectList(new LambdaQueryWrapper<MdmContract>()
                .eq(MdmContract::getStatus, "已生效").orderByAsc(MdmContract::getId));
        Map<Long, String> customerNames = new LinkedHashMap<>();
        List<Map<String, Object>> result = new ArrayList<>();
        for (MdmContract ct : contracts) {
            String custName = customerNames.computeIfAbsent(ct.getCustomerId(), id -> {
                MdmCustomer c = customerMapper.selectById(id);
                return c == null ? "客户 #" + id : c.getName();
            });
            List<MdmContractLine> lines = lineMapper.selectList(new LambdaQueryWrapper<MdmContractLine>()
                    .eq(MdmContractLine::getContractId, ct.getId()).orderByAsc(MdmContractLine::getId));
            for (MdmContractLine line : lines) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("subNo", "SUB-" + ct.getId() + "-" + line.getId());
                m.put("contractId", ct.getId());
                m.put("lineId", line.getId());
                m.put("customer", custName);
                m.put("contractNo", ct.getCode());
                m.put("product", line.getPtype() != null ? line.getPtype() : line.getCat());
                m.put("spec", line.getSpec());
                m.put("monthlyFee", line.getPrice());
                m.put("startDate", ct.getStartDate());
                m.put("endDate", ct.getEndDate());
                LcTerminate active = terminateMapper.selectOne(new LambdaQueryWrapper<LcTerminate>()
                        .eq(LcTerminate::getContractId, ct.getId())
                        .eq(LcTerminate::getLineId, line.getId())
                        .eq(LcTerminate::getStatus, "退订生效")
                        .last("LIMIT 1"));
                m.put("status", active != null ? "退订"
                        : suspendTicketService.isSuspended(ct.getId()) ? "欠停" : "在网");
                result.add(m);
            }
        }
        return result;
    }

    // ---------- 订阅变更 ----------

    public List<LcChange> changeList(String status, String kw) {
        return changeMapper.selectList(new LambdaQueryWrapper<LcChange>()
                .eq(status != null && !status.isBlank(), LcChange::getStatus, status)
                .and(kw != null && !kw.isBlank(), q -> q.like(LcChange::getChNo, kw)
                        .or().like(LcChange::getCustomer, kw))
                .orderByDesc(LcChange::getId));
    }

    @Transactional
    public Long submitChange(LcChange change) {
        MdmContractLine line = mustSubscribable(change.getContractId(), change.getLineId());
        MdmContract ct = contractMapper.selectById(change.getContractId());
        change.setContractNo(ct.getCode());
        MdmCustomer cust = customerMapper.selectById(ct.getCustomerId());
        change.setCustomer(cust == null ? null : cust.getName());
        estimateChange(change);
        change.setChNo(CodeGen.next(() -> {
            List<Object> objs = changeMapper.selectObjs(new LambdaQueryWrapper<LcChange>()
                    .select(LcChange::getChNo).orderByDesc(LcChange::getId).last("LIMIT 1"));
            return objs.isEmpty() ? null : (String) objs.get(0);
        }, "CH-2026-"));
        change.setStatus("审批中");
        changeMapper.insert(change);
        approvalEngine.submit("订阅变更", "提交", change.getId(), Map.of("changeId", change.getId()));
        return change.getId();
    }

    /**
     * 变更测算（P05）：带宽升降 = 带宽差 × 出口带宽成本单价；增加/减少 IP = 数量差 × IP 单价；
     * 套餐变更 = 月租差 × 成本率兜底；地址迁移 = 安装调测费（一次性，不入月成本）。
     * 单价全部读策略中心（cost.exitPerM / cost.ipUnit / cost.planRatio / cost.installFee）。
     */
    private void estimateChange(LcChange c) {
        String type = c.getType() == null ? "" : c.getType();
        BigDecimal delta = BigDecimal.ZERO;
        String basis;
        switch (type) {
            case "带宽升级", "带宽降级" -> {
                double from = parseNumber(c.getFromVal());
                double to = parseNumber(c.getToVal());
                BigDecimal perM = cfgDecimal("cost.exitPerM", "40");
                delta = BigDecimal.valueOf(to - from).multiply(perM).setScale(0, RoundingMode.HALF_UP);
                basis = "口径：出口带宽成本 " + perM.stripTrailingZeros().toPlainString()
                        + " 元/M/月（策略中心 cost.exitPerM）× 带宽差 " + (long) (to - from) + "M";
            }
            case "增加 IP", "减少 IP" -> {
                double from = parseNumber(c.getFromVal());
                double to = parseNumber(c.getToVal());
                BigDecimal unit = cfgDecimal("cost.ipUnit", "25");
                delta = BigDecimal.valueOf(to - from).multiply(unit).setScale(0, RoundingMode.HALF_UP);
                basis = "口径：IP 地址成本 " + unit.stripTrailingZeros().toPlainString()
                        + " 元/个·月（策略中心 cost.ipUnit）× 数量差 " + (long) (to - from);
            }
            case "地址迁移" -> {
                BigDecimal fee = cfgDecimal("cost.installFee", "2000");
                delta = BigDecimal.ZERO;
                basis = "口径：地址迁移为一次性成本 " + fee.stripTrailingZeros().toPlainString()
                        + " 元/次（策略中心 cost.installFee），不影响月成本";
            }
            default -> {
                BigDecimal before = currentMonthlyFee(c);
                BigDecimal after = c.getMonthlyFeeAfter() == null ? before : c.getMonthlyFeeAfter();
                BigDecimal ratio = cfgDecimal("cost.planRatio", "60").divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
                delta = after.subtract(before).multiply(ratio).setScale(0, RoundingMode.HALF_UP);
                basis = "口径：套餐变更成本率兜底 " + ratio.multiply(BigDecimal.valueOf(100)).stripTrailingZeros().toPlainString()
                        + "%（策略中心 cost.planRatio）× 月租差";
            }
        }
        c.setCostDelta(delta);
        c.setCostBasis(basis);
    }

    private BigDecimal currentMonthlyFee(LcChange c) {
        MdmContractLine line = lineMapper.selectById(c.getLineId());
        return line == null || line.getPrice() == null ? BigDecimal.ZERO : line.getPrice();
    }

    /** 从「单线 200M」「绑定 IP 8 个」等描述解析首个数字 */
    private double parseNumber(String text) {
        if (text == null) {
            return 0;
        }
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("([\\d.]+)").matcher(text);
        return m.find() ? Double.parseDouble(m.group(1)) : 0;
    }

    private BigDecimal cfgDecimal(String key, String def) {
        try {
            com.dmt.erp.sys.entity.SysConfig cfg = sysConfigMapper.selectOne(
                    new LambdaQueryWrapper<com.dmt.erp.sys.entity.SysConfig>()
                            .eq(com.dmt.erp.sys.entity.SysConfig::getCfgKey, key).last("LIMIT 1"));
            if (cfg != null && cfg.getCfgValue() != null) {
                return new BigDecimal(cfg.getCfgValue().trim());
            }
        } catch (Exception ignored) {
        }
        return new BigDecimal(def);
    }

    // ---------- 退订与回收 ----------

    public List<LcTerminate> terminateList(String status, String kw) {
        return terminateMapper.selectList(new LambdaQueryWrapper<LcTerminate>()
                .eq(status != null && !status.isBlank(), LcTerminate::getStatus, status)
                .and(kw != null && !kw.isBlank(), q -> q.like(LcTerminate::getTmNo, kw)
                        .or().like(LcTerminate::getCustomer, kw))
                .orderByDesc(LcTerminate::getId));
    }

    /** 违约金参考试算（非定价依据）：剩余未履行账期月租合计 × 策略中心「违约金参考比例」 */
    public Map<String, Object> penaltyReference(Long contractId, Long lineId, String effectivePeriod) {
        MdmContract ct = contractMapper.selectById(contractId);
        MdmContractLine line = lineMapper.selectById(lineId);
        Map<String, Object> r = new LinkedHashMap<>();
        if (ct == null || line == null || effectivePeriod == null || ct.getEndDate() == null) {
            r.put("penalty", BigDecimal.ZERO);
            r.put("basis", "未找到订阅或合同，无法参考试算");
            return r;
        }
        YearMonth from = YearMonth.parse(effectivePeriod);
        YearMonth end = YearMonth.from(ct.getEndDate());
        long months = Math.max(0, java.time.temporal.ChronoUnit.MONTHS.between(from, end) + 1);
        BigDecimal fee = line.getPrice() == null ? BigDecimal.ZERO : line.getPrice();
        BigDecimal rate = refRate();
        BigDecimal penalty = fee.multiply(BigDecimal.valueOf(months)).multiply(rate)
                .setScale(2, RoundingMode.HALF_UP);
        r.put("penalty", penalty);
        r.put("basis", "参考试算（非定价依据）：剩余未履行 " + months + " 期 × 月租 "
                + fee.stripTrailingZeros().toPlainString() + " 元 × "
                + rate.multiply(BigDecimal.valueOf(100)).stripTrailingZeros().toPlainString()
                + "%（策略中心 penalty.refRate 可配）；最终金额由退订审批确定");
        return r;
    }

    /** 违约金参考比例：读策略中心 penalty.refRate（%），缺省 30% */
    private BigDecimal refRate() {
        try {
            com.dmt.erp.sys.entity.SysConfig cfg = sysConfigMapper.selectOne(
                    new LambdaQueryWrapper<com.dmt.erp.sys.entity.SysConfig>()
                            .eq(com.dmt.erp.sys.entity.SysConfig::getCfgKey, "penalty.refRate").last("LIMIT 1"));
            if (cfg != null && cfg.getCfgValue() != null) {
                return new BigDecimal(cfg.getCfgValue()).divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
            }
        } catch (Exception ignored) {
        }
        return new BigDecimal("0.30");
    }

    @Transactional
    public Long submitTerminate(LcTerminate terminate) {
        mustSubscribable(terminate.getContractId(), terminate.getLineId());
        MdmContract ct = contractMapper.selectById(terminate.getContractId());
        terminate.setContractNo(ct.getCode());
        MdmCustomer cust = customerMapper.selectById(ct.getCustomerId());
        terminate.setCustomer(cust == null ? null : cust.getName());
        terminate.setTmNo(CodeGen.next(() -> {
            List<Object> objs = terminateMapper.selectObjs(new LambdaQueryWrapper<LcTerminate>()
                    .select(LcTerminate::getTmNo).orderByDesc(LcTerminate::getId).last("LIMIT 1"));
            return objs.isEmpty() ? null : (String) objs.get(0);
        }, "TM-2026-"));
        terminate.setStatus("审批中");
        terminateMapper.insert(terminate);
        approvalEngine.submit("退订申请", "提交", terminate.getId(), Map.of("terminateId", terminate.getId()));
        return terminate.getId();
    }

    /** 执行资源回收：CPE 回库 / IP 释放 / 配置清除，完工留痕；完工后进入「后续商机确认」 */
    public void executeRecover(Long id, String note) {
        LcTerminate t = terminateMapper.selectById(id);
        if (t == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "退订单不存在");
        }
        if (!"退订生效".equals(t.getStatus()) || !"待执行".equals(t.getRecoverStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "仅退订生效且回收待执行的单据可执行回收");
        }
        t.setRecoverStatus("已完工");
        t.setRecoverNote(note);
        t.setExecutedAt(LocalDateTime.now());
        t.setFollowStatus("待确认");
        terminateMapper.updateById(t);
    }

    /** 后续商机确认：has=有后续（去录商机）/ none=无后续（登记原因留痕） */
    public void confirmFollow(Long id, String kind, String note) {
        LcTerminate t = terminateMapper.selectById(id);
        if (t == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "退订单不存在");
        }
        if (!"待确认".equals(t.getFollowStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "该退订单无需确认或已确认");
        }
        if ("none".equals(kind) && (note == null || note.isBlank())) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "无后续须登记原因（留痕）");
        }
        t.setFollowStatus("has".equals(kind) ? "有后续" : "无后续");
        t.setFollowNote(note);
        terminateMapper.updateById(t);
    }

    /** 订阅可变更/退订校验：合同已生效 + 行存在 + 无在途/生效退订 */
    private MdmContractLine mustSubscribable(Long contractId, Long lineId) {
        MdmContract ct = contractMapper.selectById(contractId);
        if (ct == null || !"已生效".equals(ct.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "仅已生效合同可发起变更/退订");
        }
        MdmContractLine line = lineMapper.selectById(lineId);
        if (line == null || !contractId.equals(line.getContractId())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "订阅行不存在");
        }
        Long active = terminateMapper.selectCount(new LambdaQueryWrapper<LcTerminate>()
                .eq(LcTerminate::getContractId, contractId)
                .eq(LcTerminate::getLineId, lineId)
                .in(LcTerminate::getStatus, "审批中", "退订生效"));
        if (active > 0) {
            throw new BizException(ResultCode.STATE_CONFLICT, "该订阅已有在途或生效的退订申请");
        }
        return line;
    }
}
