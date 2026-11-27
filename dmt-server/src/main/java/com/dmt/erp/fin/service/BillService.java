package com.dmt.erp.fin.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.CodeGen;
import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.fin.entity.FinBill;
import com.dmt.erp.fin.entity.FinPayment;
import com.dmt.erp.fin.mapper.FinBillMapper;
import com.dmt.erp.fin.mapper.FinPaymentMapper;
import com.dmt.erp.mdm.entity.MdmContract;
import com.dmt.erp.mdm.entity.MdmCustomer;
import com.dmt.erp.mdm.mapper.MdmContractMapper;
import com.dmt.erp.mdm.mapper.MdmCustomerMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** 账单与收款登记：账单一经生成不重算，收款由认领/手工登记累加核销 */
@Service
@RequiredArgsConstructor
public class BillService {

    private final FinBillMapper billMapper;
    private final FinPaymentMapper paymentMapper;
    private final MdmCustomerMapper customerMapper;
    private final MdmContractMapper contractMapper;
    private final com.dmt.erp.mdm.mapper.MdmContractLineMapper contractLineMapper;
    private final com.dmt.erp.lc.mapper.LcTerminateMapper terminateMapper;

    public PageResult<Map<String, Object>> page(String kw, String status, String issueStatus, Long customerId, long pageNum, long pageSize) {
        Page<FinBill> page = new Page<>(pageNum, Math.min(pageSize, 100));
        Page<FinBill> result = billMapper.selectPage(page, new LambdaQueryWrapper<FinBill>()
                .eq(status != null && !status.isBlank(), FinBill::getStatus, status)
                .eq(issueStatus != null && !issueStatus.isBlank(), FinBill::getIssueStatus, issueStatus)
                .eq(customerId != null, FinBill::getCustomerId, customerId)
                .like(kw != null && !kw.isBlank(), FinBill::getBillNo, kw)
                .orderByDesc(FinBill::getId));
        Map<Long, String> customers = new HashMap<>();
        Map<Long, String> contracts = new HashMap<>();
        Map<Long, String> summaries = new HashMap<>();
        if (!result.getRecords().isEmpty()) {
            customerMapper.selectBatchIds(result.getRecords().stream().map(FinBill::getCustomerId)
                    .filter(java.util.Objects::nonNull).distinct().collect(Collectors.toList()))
                    .forEach(c -> customers.put(c.getId(), c.getName()));
            List<Long> ctIds = result.getRecords().stream().map(FinBill::getContractId)
                    .filter(java.util.Objects::nonNull).distinct().collect(Collectors.toList());
            contractMapper.selectBatchIds(ctIds)
                    .forEach(c -> contracts.put(c.getId(), c.getCode()));
            if (!ctIds.isEmpty()) {
                Map<Long, List<com.dmt.erp.mdm.entity.MdmContractLine>> linesByCt = contractLineMapper.selectList(
                                new LambdaQueryWrapper<com.dmt.erp.mdm.entity.MdmContractLine>()
                                        .in(com.dmt.erp.mdm.entity.MdmContractLine::getContractId, ctIds))
                        .stream().collect(Collectors.groupingBy(com.dmt.erp.mdm.entity.MdmContractLine::getContractId));
                linesByCt.forEach((ctId, lines) -> summaries.put(ctId, lines.stream()
                        .map(l -> l.getPtype() != null ? l.getPtype() : (l.getSpec() != null ? l.getSpec() : l.getCat()))
                        .filter(java.util.Objects::nonNull).distinct().collect(Collectors.joining(" + "))));
            }
        }
        return PageResult.of(result.convert(b -> {
            Map<String, Object> m = new HashMap<>();
            m.put("bill", b);
            m.put("customerName", customers.get(b.getCustomerId()));
            m.put("contractCode", contracts.get(b.getContractId()));
            m.put("linesSummary", summaries.get(b.getContractId()));
            return m;
        }));
    }

    public Long create(FinBill bill) {
        if (bill.getCustomerId() == null || bill.getAmount() == null) {
            throw new BizException(ResultCode.PARAM_INVALID, "客户与金额必填");
        }
        MdmCustomer customer = customerMapper.selectById(bill.getCustomerId());
        if (customer == null) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "客户不存在");
        }
        bill.setBillNo(CodeGen.next(() -> {
            List<Object> objs = billMapper.selectObjs(new LambdaQueryWrapper<FinBill>()
                    .select(FinBill::getBillNo).orderByDesc(FinBill::getId).last("LIMIT 1"));
            return objs.isEmpty() ? null : (String) objs.get(0);
        }, "INV-2026-"));
        bill.setReceivedAmt(BigDecimal.ZERO);
        bill.setStatus("未收讫");
        // 例外审核规则①：手工单必审（P03-4）；通过前不进应收
        bill.setIssueStatus("审核中");
        if (bill.getDueDate() == null) {
            bill.setDueDate(LocalDate.now().plusDays(30));
        }
        billMapper.insert(bill);
        return bill.getId();
    }

    /** 出账审核：审核中 → 已发出（进应收）/ 已驳回（留痕） */
    public void review(Long id, boolean pass, String note) {
        FinBill bill = billMapper.selectById(id);
        if (bill == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "账单不存在");
        }
        if (!"审核中".equals(bill.getIssueStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "仅审核中账单可审核");
        }
        if (pass) {
            bill.setIssueStatus("已发出");
            bill.setIssuedAt(java.time.LocalDateTime.now());
            bill.setReviewNote("人工通过");
        } else {
            bill.setIssueStatus("已驳回");
            bill.setReviewNote(note);
        }
        billMapper.updateById(bill);
    }

    public Map<String, Object> detail(Long id) {
        FinBill bill = billMapper.selectById(id);
        if (bill == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "账单不存在");
        }
        Map<String, Object> m = new HashMap<>();
        m.put("bill", bill);
        MdmCustomer customer = customerMapper.selectById(bill.getCustomerId());
        m.put("customerName", customer == null ? null : customer.getName());
        MdmContract contract = bill.getContractId() == null ? null : contractMapper.selectById(bill.getContractId());
        m.put("contractCode", contract == null ? null : contract.getCode());
        m.put("payments", paymentMapper.selectList(new LambdaQueryWrapper<FinPayment>()
                .eq(FinPayment::getBillId, id).orderByDesc(FinPayment::getId)));
        return m;
    }

    /** 逾期清单：到期未收讫（派生视图，不重算） */
    public List<FinBill> overdue() {
        return billMapper.selectList(new LambdaQueryWrapper<FinBill>()
                .lt(FinBill::getDueDate, LocalDate.now())
                .in(FinBill::getStatus, "未收讫", "部分收讫")
                .eq(FinBill::getIssueStatus, "已发出")
                .orderByAsc(FinBill::getDueDate));
    }

    /**
     * 账期扫描出账（P03-1/2/3）：已生效合同 × 在网订阅行 → 按合同生成账期账单（金额=在网行月租合计）；
     * 同合同同账期去重；正常账单自动发出（机械计算，人审不如系统校验）。
     */
    @org.springframework.transaction.annotation.Transactional
    public Map<String, Object> runScan(String period) {
        if (period == null || !period.matches("\\d{4}-\\d{2}")) {
            throw new BizException(ResultCode.PARAM_INVALID, "账期格式应为 YYYY-MM");
        }
        List<MdmContract> contracts = contractMapper.selectList(new LambdaQueryWrapper<MdmContract>()
                .eq(MdmContract::getStatus, "已生效").orderByAsc(MdmContract::getId));
        int generated = 0, skipped = 0;
        List<String> details = new java.util.ArrayList<>();
        for (MdmContract ct : contracts) {
            List<com.dmt.erp.mdm.entity.MdmContractLine> lines = contractLineMapper.selectList(
                    new LambdaQueryWrapper<com.dmt.erp.mdm.entity.MdmContractLine>()
                            .eq(com.dmt.erp.mdm.entity.MdmContractLine::getContractId, ct.getId()));
            BigDecimal monthly = BigDecimal.ZERO;
            for (com.dmt.erp.mdm.entity.MdmContractLine line : lines) {
                Long terminated = terminateMapper.selectCount(new LambdaQueryWrapper<com.dmt.erp.lc.entity.LcTerminate>()
                        .eq(com.dmt.erp.lc.entity.LcTerminate::getContractId, ct.getId())
                        .eq(com.dmt.erp.lc.entity.LcTerminate::getLineId, line.getId())
                        .eq(com.dmt.erp.lc.entity.LcTerminate::getStatus, "退订生效"));
                if (terminated == 0 && line.getPrice() != null) {
                    monthly = monthly.add(line.getPrice());
                }
            }
            if (monthly.signum() <= 0) {
                skipped++;
                continue;
            }
            Long dup = billMapper.selectCount(new LambdaQueryWrapper<FinBill>()
                    .eq(FinBill::getContractId, ct.getId())
                    .eq(FinBill::getPeriod, period));
            if (dup > 0) {
                skipped++;
                details.add(ct.getCode() + " 已有 " + period + " 账单，跳过");
                continue;
            }
            FinBill bill = new FinBill();
            bill.setCustomerId(ct.getCustomerId());
            bill.setContractId(ct.getId());
            bill.setPeriod(period);
            bill.setAmount(monthly);
            bill.setReceivedAmt(BigDecimal.ZERO);
            bill.setStatus("未收讫");
            // 正常账单自动发出（金额=订阅月租机械计算，系统校验比人工抽看可靠）
            bill.setIssueStatus("已发出");
            bill.setIssuedAt(java.time.LocalDateTime.now());
            bill.setDueDate(java.time.YearMonth.parse(period).atEndOfMonth().plusDays(10));
            bill.setBillNo(CodeGen.next(() -> {
                List<Object> objs = billMapper.selectObjs(new LambdaQueryWrapper<FinBill>()
                        .select(FinBill::getBillNo).orderByDesc(FinBill::getId).last("LIMIT 1"));
                return objs.isEmpty() ? null : (String) objs.get(0);
            }, "INV-2026-"));
            billMapper.insert(bill);
            generated++;
        }
        Map<String, Object> r = new HashMap<>();
        r.put("generated", generated);
        r.put("skipped", skipped);
        r.put("details", details);
        return r;
    }
}
