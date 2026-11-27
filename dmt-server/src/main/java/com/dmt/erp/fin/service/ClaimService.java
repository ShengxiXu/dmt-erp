package com.dmt.erp.fin.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.CodeGen;
import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.fin.entity.FinBankFlow;
import com.dmt.erp.fin.entity.FinBill;
import com.dmt.erp.fin.entity.FinClaimAlloc;
import com.dmt.erp.fin.entity.FinPayment;
import com.dmt.erp.fin.mapper.FinBankFlowMapper;
import com.dmt.erp.fin.mapper.FinBillMapper;
import com.dmt.erp.fin.mapper.FinClaimAllocMapper;
import com.dmt.erp.fin.mapper.FinPaymentMapper;
import com.dmt.erp.mdm.entity.MdmCustomer;
import com.dmt.erp.mdm.mapper.MdmCustomerMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 回款认领（真实财务主路径）：银行流水 → 按付款方模糊匹配未收讫账单 → 人工确认拆分认领
 * → 事务内生成收款登记并逐笔核销；一笔流水可拆多笔账单，一笔账单可累计多笔流水核销；红冲留痕。
 */
@Service
@RequiredArgsConstructor
public class ClaimService {

    private final FinBankFlowMapper flowMapper;
    private final FinBillMapper billMapper;
    private final FinPaymentMapper paymentMapper;
    private final FinClaimAllocMapper allocMapper;
    private final MdmCustomerMapper customerMapper;
    private final SuspendTicketService suspendTicketService;

    // ---------- 流水 ----------

    public PageResult<FinBankFlow> flowPage(String status, String kw, long pageNum, long pageSize) {
        Page<FinBankFlow> page = new Page<>(pageNum, Math.min(pageSize, 100));
        return PageResult.of(flowMapper.selectPage(page, new LambdaQueryWrapper<FinBankFlow>()
                .eq(status != null && !status.isBlank(), FinBankFlow::getStatus, status)
                .and(kw != null && !kw.isBlank(), x -> x.like(FinBankFlow::getPayer, kw).or().like(FinBankFlow::getFlowNo, kw))
                .orderByDesc(FinBankFlow::getId)));
    }

    public Long createFlow(FinBankFlow flow) {
        if (flow.getArrivedAt() == null) {
            flow.setArrivedAt(LocalDateTime.now());
        }
        flow.setStatus("未认领");
        flow.setClaimedAmt(BigDecimal.ZERO);
        String prefix = "BF-" + java.time.LocalDate.now().getYear() + "-";
        flow.setFlowNo(CodeGen.next(() -> {
            List<Object> objs = flowMapper.selectObjs(new LambdaQueryWrapper<FinBankFlow>()
                    .select(FinBankFlow::getFlowNo).orderByDesc(FinBankFlow::getId).last("LIMIT 1"));
            return objs.isEmpty() ? null : (String) objs.get(0);
        }, prefix));
        flowMapper.insert(flow);
        return flow.getId();
    }

    /** 自动认领建议：付款方 ≈ 客户名（模糊），列该客户未收讫账单 */
    public Map<String, Object> match(Long flowId) {
        FinBankFlow flow = mustFlow(flowId);
        List<MdmCustomer> customers = customerMapper.selectList(null);
        List<Map<String, Object>> suggestions = new ArrayList<>();
        for (MdmCustomer c : customers) {
            if (flow.getPayer() != null && (flow.getPayer().contains(c.getName()) || c.getName().contains(flow.getPayer()))) {
                List<FinBill> bills = billMapper.selectList(new LambdaQueryWrapper<FinBill>()
                        .eq(FinBill::getCustomerId, c.getId())
                        .in(FinBill::getStatus, "未收讫", "部分收讫")
                .eq(FinBill::getIssueStatus, "已发出")
                        .orderByAsc(FinBill::getDueDate));
                for (FinBill b : bills) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("billId", b.getId());
                    m.put("billNo", b.getBillNo());
                    m.put("period", b.getPeriod());
                    m.put("amount", b.getAmount());
                    m.put("balance", b.getAmount().subtract(b.getReceivedAmt() == null ? BigDecimal.ZERO : b.getReceivedAmt()));
                    m.put("dueDate", b.getDueDate());
                    suggestions.add(m);
                }
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("flow", flow);
        result.put("suggestions", suggestions);
        result.put("remain", flow.getAmount().subtract(flow.getClaimedAmt() == null ? BigDecimal.ZERO : flow.getClaimedAmt()));
        return result;
    }

    /** 确认认领：拆分分配 → 生成收款登记 → 核销账单 → 回写流水（全事务） */
    @Transactional
    public void claim(Long flowId, List<Map<String, Object>> allocs) {
        FinBankFlow flow = mustFlow(flowId);
        if ("已红冲".equals(flow.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "该流水已红冲");
        }
        if (allocs == null || allocs.isEmpty()) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "认领分配不能为空");
        }
        BigDecimal remain = flow.getAmount().subtract(flow.getClaimedAmt() == null ? BigDecimal.ZERO : flow.getClaimedAmt());
        BigDecimal total = BigDecimal.ZERO;
        for (Map<String, Object> a : allocs) {
            Long billId = Long.valueOf(String.valueOf(a.get("billId")));
            BigDecimal amount = new BigDecimal(String.valueOf(a.get("amount")));
            if (amount.compareTo(BigDecimal.ZERO) <= 0) {
                throw new BizException(ResultCode.PARAM_INVALID, "认领金额必须大于 0");
            }
            FinBill bill = billMapper.selectById(billId);
            if (bill == null) {
                throw new BizException(ResultCode.STATE_CONFLICT, "账单不存在：" + billId);
            }
            BigDecimal balance = bill.getAmount().subtract(bill.getReceivedAmt() == null ? BigDecimal.ZERO : bill.getReceivedAmt());
            if (amount.compareTo(balance) > 0) {
                throw new BizException(ResultCode.BIZ_RULE_VIOLATION,
                        "账单 " + bill.getBillNo() + " 余额 " + balance + " 元，认领金额超出");
            }
            total = total.add(amount);

            String payNo = nextNo("PAY-", paymentMapper, FinPayment::getPayNo);
            FinPayment payment = new FinPayment();
            payment.setPayNo(payNo);
            payment.setBillId(billId);
            payment.setAmount(amount);
            payment.setMethod(flow.getMethod());
            payment.setPaidAt(LocalDateTime.now());
            payment.setSource("认领生成");
            payment.setFlowId(flowId);
            paymentMapper.insert(payment);

            FinClaimAlloc alloc = new FinClaimAlloc();
            alloc.setAllocNo(nextNo("CA-", allocMapper, FinClaimAlloc::getAllocNo));
            alloc.setFlowId(flowId);
            alloc.setBillId(billId);
            alloc.setCustomerId(bill.getCustomerId());
            alloc.setAmount(amount);
            alloc.setPayNo(payNo);
            alloc.setClaimedAt(LocalDateTime.now());
            allocMapper.insert(alloc);

            bill.setReceivedAmt(bill.getReceivedAmt().add(amount));
            bill.setStatus(bill.getReceivedAmt().compareTo(bill.getAmount()) >= 0 ? "已收讫" : "部分收讫");
            billMapper.updateById(bill);
            if ("已收讫".equals(bill.getStatus())) {
                // 复机仅由足额收讫自动触发（P04-8）
                suspendTicketService.autoResumeOnPaid(bill.getId());
            }
        }
        if (total.compareTo(remain) > 0) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "认领合计 " + total + " 超出流水剩余 " + remain);
        }
        flow.setClaimedAmt(flow.getClaimedAmt().add(total));
        flow.setStatus(flow.getClaimedAmt().compareTo(flow.getAmount()) >= 0 ? "已核销" : "部分认领");
        flowMapper.updateById(flow);
    }

    /** 红冲：生成反向流水，已认领部分自动反核销，原流水留痕 */
    @Transactional
    public void redFlush(Long flowId) {
        FinBankFlow flow = mustFlow(flowId);
        if ("已红冲".equals(flow.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "该流水已红冲");
        }
        FinBankFlow reversal = new FinBankFlow();
        reversal.setFlowNo(nextNo("BF-", flowMapper, FinBankFlow::getFlowNo));
        reversal.setArrivedAt(LocalDateTime.now());
        reversal.setPayer(flow.getPayer() + "（红冲）");
        reversal.setAmount(flow.getAmount().negate());
        reversal.setMethod(flow.getMethod());
        reversal.setReferenceNo("REV-" + flow.getFlowNo());
        reversal.setStatus("已红冲");
        reversal.setClaimedAmt(BigDecimal.ZERO);
        reversal.setNote("红冲 " + flow.getFlowNo() + "，原流水留痕不删除");
        flowMapper.insert(reversal);

        List<FinClaimAlloc> allocs = allocMapper.selectList(new LambdaQueryWrapper<FinClaimAlloc>()
                .eq(FinClaimAlloc::getFlowId, flowId));
        for (FinClaimAlloc a : allocs) {
            FinBill bill = billMapper.selectById(a.getBillId());
            if (bill != null) {
                String payNo = nextNo("PAY-", paymentMapper, FinPayment::getPayNo);
                FinPayment back = new FinPayment();
                back.setPayNo(payNo);
                back.setBillId(bill.getId());
                back.setAmount(a.getAmount().negate());
                back.setMethod("红冲");
                back.setPaidAt(LocalDateTime.now());
                back.setSource("红冲回退");
                back.setFlowId(reversal.getId());
                paymentMapper.insert(back);
                bill.setReceivedAmt(bill.getReceivedAmt().subtract(a.getAmount()));
                bill.setStatus(bill.getReceivedAmt().compareTo(BigDecimal.ZERO) <= 0 ? "未收讫"
                        : bill.getReceivedAmt().compareTo(bill.getAmount()) >= 0 ? "已收讫" : "部分收讫");
                billMapper.updateById(bill);
            }
        }
        flow.setStatus("已红冲");
        flowMapper.updateById(flow);
    }

    private FinBankFlow mustFlow(Long id) {
        FinBankFlow flow = flowMapper.selectById(id);
        if (flow == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "流水不存在");
        }
        return flow;
    }

    private <T> String nextNo(String prefix, com.baomidou.mybatisplus.core.mapper.BaseMapper<T> mapper,
                              com.baomidou.mybatisplus.core.toolkit.support.SFunction<T, ?> column) {
        List<Object> objs = mapper.selectObjs(new LambdaQueryWrapper<T>()
                .select(column).orderByDesc(column).last("LIMIT 1"));
        return CodeGen.next(() -> objs.isEmpty() ? null : (String) objs.get(0), prefix);
    }
}
