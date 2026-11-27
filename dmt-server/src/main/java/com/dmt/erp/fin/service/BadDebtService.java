package com.dmt.erp.fin.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.approval.service.ApprovalEngineService;
import com.dmt.erp.approval.service.WritebackRegistry;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.CodeGen;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.fin.entity.FinBadDebt;
import com.dmt.erp.fin.entity.FinBill;
import com.dmt.erp.fin.mapper.FinBadDebtMapper;
import com.dmt.erp.fin.mapper.FinBillMapper;
import com.dmt.erp.lc.entity.LcTerminate;
import com.dmt.erp.lc.service.LifecycleService;
import com.dmt.erp.mdm.entity.MdmContract;
import com.dmt.erp.mdm.entity.MdmContractLine;
import com.dmt.erp.mdm.entity.MdmCustomer;
import com.dmt.erp.mdm.mapper.MdmContractLineMapper;
import com.dmt.erp.mdm.mapper.MdmContractMapper;
import com.dmt.erp.mdm.mapper.MdmCustomerMapper;
import com.dmt.erp.sys.entity.SysConfig;
import com.dmt.erp.sys.mapper.SysConfigMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 欠费与坏账（P04）：欠费账单=到期未收讫派生视图（不重算）；
 * 坏账申请走审批引擎（管理层），通过 → 账单置「坏账」→ 关联合同在网订阅自动发起退订（原因=欠费坏账）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BadDebtService {

    private final FinBadDebtMapper badDebtMapper;
    private final FinBillMapper billMapper;
    private final MdmCustomerMapper customerMapper;
    private final MdmContractMapper contractMapper;
    private final MdmContractLineMapper lineMapper;
    private final SysConfigMapper sysConfigMapper;
    private final LifecycleService lifecycleService;
    private final SuspendTicketService suspendTicketService;
    private final ApprovalEngineService approvalEngine;
    private final WritebackRegistry writebackRegistry;

    @PostConstruct
    void registerWriteback() {
        writebackRegistry.register("坏账申请",
                this::onApproval,
                id -> Map.of("badDebtId", id),
                id -> {
                    FinBadDebt b = badDebtMapper.selectById(id);
                    return b == null ? String.valueOf(id) : b.getBdNo();
                });
    }

    /** 欠费账单派生视图：到期未收讫 + 逾期天数（宽限期/停机门槛取策略中心） */
    public List<Map<String, Object>> overdueBills() {
        int graceDays = cfgInt("overdue.graceDays", 3);
        int suspendDays = cfgInt("overdue.suspendDays", 30);
        LocalDate today = LocalDate.now();
        List<FinBill> bills = billMapper.selectList(new LambdaQueryWrapper<FinBill>()
                .lt(FinBill::getDueDate, today)
                .in(FinBill::getStatus, "未收讫", "部分收讫")
                .eq(FinBill::getIssueStatus, "已发出")
                .orderByAsc(FinBill::getDueDate));
        Map<Long, String> custNames = new LinkedHashMap<>();
        List<Map<String, Object>> r = new ArrayList<>();
        for (FinBill b : bills) {
            String cust = custNames.computeIfAbsent(b.getCustomerId(), id -> {
                MdmCustomer c = customerMapper.selectById(id);
                return c == null ? "客户 #" + id : c.getName();
            });
            long days = ChronoUnit.DAYS.between(b.getDueDate(), today);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("billId", b.getId());
            m.put("billNo", b.getBillNo());
            m.put("customer", cust);
            m.put("contractId", b.getContractId());
            m.put("period", b.getPeriod());
            m.put("amount", b.getAmount());
            m.put("balance", b.getAmount().subtract(b.getReceivedAmt() == null ? BigDecimal.ZERO : b.getReceivedAmt()));
            m.put("dueDate", b.getDueDate());
            m.put("overdueDays", days);
            m.put("suspended", suspendTicketService.isSuspended(b.getContractId()));
            m.put("level", days > suspendDays ? "达停机门槛" : days > graceDays ? "逾期催收" : "宽限期内");
            r.add(m);
        }
        return r;
    }

    public List<FinBadDebt> list(String status) {
        return badDebtMapper.selectList(new LambdaQueryWrapper<FinBadDebt>()
                .eq(status != null && !status.isBlank(), FinBadDebt::getStatus, status)
                .orderByDesc(FinBadDebt::getId));
    }

    @Transactional
    public Long submit(FinBadDebt app) {
        FinBill bill = billMapper.selectById(app.getBillId());
        if (bill == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "账单不存在");
        }
        if (!"未收讫".equals(bill.getStatus()) && !"部分收讫".equals(bill.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "仅逾期账单可申请坏账");
        }
        int threshold = cfgInt("overdue.badDebtDays", 180);
        long days = bill.getDueDate() == null ? 0 : ChronoUnit.DAYS.between(bill.getDueDate(), LocalDate.now());
        if (days < threshold) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION,
                    "未达坏账门槛（逾期 " + days + " 天 < " + threshold + " 天，策略中心 overdue.badDebtDays 可配）");
        }
        Long inflight = badDebtMapper.selectCount(new LambdaQueryWrapper<FinBadDebt>()
                .eq(FinBadDebt::getBillId, app.getBillId())
                .in(FinBadDebt::getStatus, "审批中", "已通过"));
        if (inflight > 0) {
            throw new BizException(ResultCode.STATE_CONFLICT, "该账单已有在途或已通过的坏账申请");
        }
        MdmCustomer cust = customerMapper.selectById(bill.getCustomerId());
        app.setBillNo(bill.getBillNo());
        app.setCustomer(cust == null ? null : cust.getName());
        app.setAmount(bill.getAmount().subtract(bill.getReceivedAmt() == null ? BigDecimal.ZERO : bill.getReceivedAmt()));
        app.setBdNo(CodeGen.next(() -> {
            List<Object> objs = badDebtMapper.selectObjs(new LambdaQueryWrapper<FinBadDebt>()
                    .select(FinBadDebt::getBdNo).orderByDesc(FinBadDebt::getId).last("LIMIT 1"));
            return objs.isEmpty() ? null : (String) objs.get(0);
        }, "BD-2026-"));
        app.setStatus("审批中");
        badDebtMapper.insert(app);
        approvalEngine.submit("坏账申请", "提交", app.getId(), Map.of("badDebtId", app.getId()));
        return app.getId();
    }

    /** 审批写回：通过 → 账单置坏账 + 关联合同在网行自动发起退订；驳回 → 已驳回 */
    @Transactional
    public void onApproval(Long id, boolean pass) {
        FinBadDebt app = badDebtMapper.selectById(id);
        if (app == null) {
            return;
        }
        if (!pass) {
            app.setStatus("已驳回");
            app.setRejectNote("坏账审批被驳回（见审批中心意见）");
            badDebtMapper.updateById(app);
            return;
        }
        app.setStatus("已通过");
        badDebtMapper.updateById(app);
        FinBill bill = billMapper.selectById(app.getBillId());
        if (bill == null) {
            return;
        }
        if ("核销坏账".equals(app.getHandling())) {
            bill.setStatus("坏账");
            billMapper.updateById(bill);
        }
        // 坏账确认 → 订阅强制进入退订流程（自动发起，原因=欠费坏账）
        if (bill.getContractId() != null) {
            List<MdmContractLine> lines = lineMapper.selectList(new LambdaQueryWrapper<MdmContractLine>()
                    .eq(MdmContractLine::getContractId, bill.getContractId()));
            MdmContract ct = contractMapper.selectById(bill.getContractId());
            if (ct != null && "已生效".equals(ct.getStatus())) {
                for (MdmContractLine line : lines) {
                    try {
                        LcTerminate t = new LcTerminate();
                        t.setContractId(ct.getId());
                        t.setLineId(line.getId());
                        t.setReason("欠费坏账");
                        t.setReasonText("坏账申请 " + app.getBdNo() + " 审批通过，自动发起");
                        t.setEffectivePeriod(java.time.YearMonth.now().toString());
                        lifecycleService.submitTerminate(t);
                    } catch (BizException e) {
                        log.info("bad-debt auto terminate skipped: contract={} line={} reason={}",
                                ct.getId(), line.getId(), e.getMessage());
                    }
                }
            }
        }
    }

    private int cfgInt(String key, int def) {
        try {
            SysConfig cfg = sysConfigMapper.selectOne(new LambdaQueryWrapper<SysConfig>()
                    .eq(SysConfig::getCfgKey, key).last("LIMIT 1"));
            if (cfg != null && cfg.getCfgValue() != null) {
                return Integer.parseInt(cfg.getCfgValue().trim());
            }
        } catch (Exception ignored) {
        }
        return def;
    }
}
