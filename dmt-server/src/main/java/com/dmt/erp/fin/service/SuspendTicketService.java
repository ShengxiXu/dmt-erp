package com.dmt.erp.fin.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.CodeGen;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.fin.entity.FinBill;
import com.dmt.erp.fin.entity.FinSuspendTicket;
import com.dmt.erp.fin.mapper.FinBillMapper;
import com.dmt.erp.fin.mapper.FinSuspendTicketMapper;
import com.dmt.erp.mdm.entity.MdmCustomer;
import com.dmt.erp.mdm.mapper.MdmCustomerMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 停机复机工单（P04-7/8）：停机由欠费行人工生成（策略命中提示）；执行后订阅=欠停；
 * 复机仅由足额收讫自动触发（ClaimService 核销后调用），不接受人工手工复机。
 */
@Service
@RequiredArgsConstructor
public class SuspendTicketService {

    private final FinSuspendTicketMapper ticketMapper;
    private final FinBillMapper billMapper;
    private final MdmCustomerMapper customerMapper;

    public List<FinSuspendTicket> list(String status) {
        return ticketMapper.selectList(new LambdaQueryWrapper<FinSuspendTicket>()
                .eq(status != null && !status.isBlank(), FinSuspendTicket::getStatus, status)
                .orderByDesc(FinSuspendTicket::getId));
    }

    /** 生成停机工单：同账单有未执行停机单则拦截 */
    public Long createSuspend(Long billId, String reason) {
        FinBill bill = billMapper.selectById(billId);
        if (bill == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "账单不存在");
        }
        Long inflight = ticketMapper.selectCount(new LambdaQueryWrapper<FinSuspendTicket>()
                .eq(FinSuspendTicket::getBillId, billId)
                .eq(FinSuspendTicket::getType, "停机")
                .eq(FinSuspendTicket::getStatus, "待执行"));
        if (inflight > 0) {
            throw new BizException(ResultCode.STATE_CONFLICT, "该账单已有待执行的停机工单");
        }
        MdmCustomer cust = customerMapper.selectById(bill.getCustomerId());
        BigDecimal balance = bill.getAmount()
                .subtract(bill.getReceivedAmt() == null ? BigDecimal.ZERO : bill.getReceivedAmt());
        FinSuspendTicket t = new FinSuspendTicket();
        t.setType("停机");
        t.setBillId(billId);
        t.setBillNo(bill.getBillNo());
        t.setCustomer(cust == null ? null : cust.getName());
        t.setContractId(bill.getContractId());
        t.setDebtSummary("欠费 " + balance.stripTrailingZeros().toPlainString() + " 元（" + bill.getBillNo() + "）");
        t.setReason(reason);
        t.setStatus("待执行");
        t.setTicketNo(nextNo("SP-2026-"));
        ticketMapper.insert(t);
        return t.getId();
    }

    /** 执行工单：动作 + 结果 + 留痕 */
    public void execute(Long id, String action, String result, String note) {
        FinSuspendTicket t = ticketMapper.selectById(id);
        if (t == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "工单不存在");
        }
        if (!"待执行".equals(t.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "工单已执行");
        }
        t.setAction(action);
        t.setResult(result);
        t.setNote(note);
        t.setStatus("已执行");
        t.setExecutedAt(LocalDateTime.now());
        ticketMapper.updateById(t);
    }

    /** 足额收讫自动触发复机：该合同有已执行停机、且无在途/已执行复机 → 生成复机工单（待执行） */
    public void autoResumeOnPaid(Long billId) {
        FinBill bill = billMapper.selectById(billId);
        if (bill == null || bill.getContractId() == null) {
            return;
        }
        Long stopped = ticketMapper.selectCount(new LambdaQueryWrapper<FinSuspendTicket>()
                .eq(FinSuspendTicket::getContractId, bill.getContractId())
                .eq(FinSuspendTicket::getType, "停机")
                .eq(FinSuspendTicket::getStatus, "已执行"));
        if (stopped == 0) {
            return;
        }
        Long resumed = ticketMapper.selectCount(new LambdaQueryWrapper<FinSuspendTicket>()
                .eq(FinSuspendTicket::getContractId, bill.getContractId())
                .eq(FinSuspendTicket::getType, "复机")
                .in(FinSuspendTicket::getStatus, "待执行", "已执行"));
        if (resumed > 0) {
            return;
        }
        // 仍有其他未收讫账单则不复机
        Long unpaid = billMapper.selectCount(new LambdaQueryWrapper<FinBill>()
                .eq(FinBill::getContractId, bill.getContractId())
                .eq(FinBill::getIssueStatus, "已发出")
                .in(FinBill::getStatus, "未收讫", "部分收讫"));
        if (unpaid > 0) {
            return;
        }
        MdmCustomer cust = customerMapper.selectById(bill.getCustomerId());
        FinSuspendTicket t = new FinSuspendTicket();
        t.setType("复机");
        t.setBillId(billId);
        t.setBillNo(bill.getBillNo());
        t.setCustomer(cust == null ? null : cust.getName());
        t.setContractId(bill.getContractId());
        t.setDebtSummary("欠费已足额收讫（" + bill.getBillNo() + "）");
        t.setReason("收讫自动触发复机（不接受人工手工复机）");
        t.setStatus("待执行");
        t.setTicketNo(nextNo("SP-2026-"));
        ticketMapper.insert(t);
    }

    /** 合同当前是否欠停：有已执行停机且其后无已执行复机 */
    public boolean isSuspended(Long contractId) {
        if (contractId == null) {
            return false;
        }
        FinSuspendTicket lastStop = ticketMapper.selectOne(new LambdaQueryWrapper<FinSuspendTicket>()
                .eq(FinSuspendTicket::getContractId, contractId)
                .eq(FinSuspendTicket::getType, "停机")
                .eq(FinSuspendTicket::getStatus, "已执行")
                .orderByDesc(FinSuspendTicket::getId).last("LIMIT 1"));
        if (lastStop == null) {
            return false;
        }
        Long resumeAfter = ticketMapper.selectCount(new LambdaQueryWrapper<FinSuspendTicket>()
                .eq(FinSuspendTicket::getContractId, contractId)
                .eq(FinSuspendTicket::getType, "复机")
                .eq(FinSuspendTicket::getStatus, "已执行")
                .gt(FinSuspendTicket::getId, lastStop.getId()));
        return resumeAfter == 0;
    }

    private String nextNo(String prefix) {
        return CodeGen.next(() -> {
            List<Object> objs = ticketMapper.selectObjs(new LambdaQueryWrapper<FinSuspendTicket>()
                    .select(FinSuspendTicket::getTicketNo).orderByDesc(FinSuspendTicket::getId).last("LIMIT 1"));
            return objs.isEmpty() ? null : (String) objs.get(0);
        }, prefix);
    }
}
