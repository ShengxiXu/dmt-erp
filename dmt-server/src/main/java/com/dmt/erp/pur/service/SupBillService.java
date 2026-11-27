package com.dmt.erp.pur.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.CodeGen;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.pur.entity.PurBill;
import com.dmt.erp.pur.mapper.PurBillMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SupBillService {

    private final PurBillMapper billMapper;
    private final com.dmt.erp.prd.mapper.CostItemMapper costItemMapper;
    private final com.dmt.erp.cost.mapper.CostSheetLineMapper sheetLineMapper;

    public List<PurBill> list(String status, String kw) {
        List<PurBill> bills = billMapper.selectList(new LambdaQueryWrapper<PurBill>()
                .eq(StringUtils.hasText(status), PurBill::getStatus, status)
                .and(StringUtils.hasText(kw), q -> q.like(PurBill::getBillNo, kw)
                        .or().like(PurBill::getSupplier, kw))
                .orderByDesc(PurBill::getId));
        // 被引用：核算行 source_no = 账单号 的引用计数
        for (PurBill b : bills) {
            b.setRefCount(sheetLineMapper.selectCount(
                    new LambdaQueryWrapper<com.dmt.erp.cost.entity.CostSheetLine>()
                            .eq(com.dmt.erp.cost.entity.CostSheetLine::getSourceNo, b.getBillNo())));
        }
        return bills;
    }

    public Long create(PurBill bill) {
        if (!StringUtils.hasText(bill.getSupplier()) || !StringUtils.hasText(bill.getPeriod())
                || bill.getAmount() == null) {
            throw new BizException(ResultCode.PARAM_INVALID, "供应商、账期、金额必填");
        }
        bill.setBillNo(CodeGen.next(() -> {
            List<Object> objs = billMapper.selectObjs(new LambdaQueryWrapper<PurBill>()
                    .select(PurBill::getBillNo).orderByDesc(PurBill::getId).last("LIMIT 1"));
            return objs.isEmpty() ? null : (String) objs.get(0);
        }, "HY-2026-"));
        bill.setStatus("待入账");
        billMapper.insert(bill);
        return bill.getId();
    }

    /** 入账：待入账 → 已入账（差异标签留痕） */
    public void post(Long id, String tag) {
        PurBill bill = mustGet(id);
        if (!"待入账".equals(bill.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "仅待入账账单可入账");
        }
        bill.setStatus("已入账");
        if (StringUtils.hasText(tag)) {
            bill.setTag(tag);
        }
        billMapper.updateById(bill);
    }

    public void voidBill(Long id) {
        PurBill bill = mustGet(id);
        if ("已月结".equals(bill.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "已月结账单不可作废");
        }
        bill.setStatus("已作废");
        billMapper.updateById(bill);
    }

    /** 详情：账单 + 费用归类名称 + 超期标记 + 被核算单引用明细 */
    public java.util.Map<String, Object> detail(Long id) {
        PurBill bill = mustGet(id);
        java.util.Map<String, Object> m = new java.util.HashMap<>();
        m.put("bill", bill);
        m.put("overdue", overdue(bill));
        if (bill.getCostItemId() != null) {
            com.dmt.erp.prd.entity.CostItem item = costItemMapper.selectById(bill.getCostItemId());
            m.put("costItemName", item == null ? null : item.getName());
        }
        List<com.dmt.erp.cost.entity.CostSheetLine> refs = sheetLineMapper.selectList(
                new LambdaQueryWrapper<com.dmt.erp.cost.entity.CostSheetLine>()
                        .eq(com.dmt.erp.cost.entity.CostSheetLine::getSourceNo, bill.getBillNo()));
        m.put("refs", refs);
        return m;
    }

    public boolean overdue(PurBill bill) {
        return bill.getPayDueDate() != null && bill.getPayDueDate().isBefore(LocalDate.now())
                && !"已月结".equals(bill.getStatus()) && !"已作废".equals(bill.getStatus());
    }

    private PurBill mustGet(Long id) {
        PurBill bill = billMapper.selectById(id);
        if (bill == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "供应商账单不存在");
        }
        return bill;
    }
}
