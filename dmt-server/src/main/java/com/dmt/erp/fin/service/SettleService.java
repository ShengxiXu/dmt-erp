package com.dmt.erp.fin.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.CodeGen;
import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.cost.entity.CostSheet;
import com.dmt.erp.cost.mapper.CostSheetMapper;
import com.dmt.erp.fin.entity.FinBill;
import com.dmt.erp.fin.entity.FinSettleRecord;
import com.dmt.erp.fin.mapper.FinBillMapper;
import com.dmt.erp.fin.mapper.FinSettleRecordMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** 月结：按签单快照口径归档（已通过核算单 + 账单），只增不重算 */
@Service
@RequiredArgsConstructor
public class SettleService {

    private final FinSettleRecordMapper settleMapper;
    private final CostSheetMapper sheetMapper;
    private final FinBillMapper billMapper;

    @Transactional
    public FinSettleRecord run(String period) {
        Long exists = settleMapper.selectCount(new LambdaQueryWrapper<FinSettleRecord>()
                .eq(FinSettleRecord::getPeriod, period));
        if (exists > 0) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, period + " 账期已跑过月结，不可重复");
        }
        List<CostSheet> sheets = sheetMapper.selectList(new LambdaQueryWrapper<CostSheet>()
                .eq(CostSheet::getStatus, "已通过"));
        List<FinBill> bills = billMapper.selectList(new LambdaQueryWrapper<FinBill>()
                .eq(FinBill::getPeriod, period));

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("period", period);
        snapshot.put("runAt", LocalDate.now().toString());
        snapshot.put("sheets", sheets.stream().map(s -> {
            Map<String, Object> m = new HashMap<>();
            m.put("code", s.getCode());
            m.put("monthlyCost", s.getMonthlyCost());
            m.put("margin", s.getMargin());
            m.put("contractValue", s.getContractValue());
            return m;
        }).collect(Collectors.toList()));
        snapshot.put("bills", bills.stream().map(b -> {
            Map<String, Object> m = new HashMap<>();
            m.put("billNo", b.getBillNo());
            m.put("amount", b.getAmount());
            m.put("received", b.getReceivedAmt());
            m.put("status", b.getStatus());
            return m;
        }).collect(Collectors.toList()));
        snapshot.put("totals", Map.of(
                "sheetCount", sheets.size(),
                "monthlyCost", sheets.stream().map(s -> s.getMonthlyCost() == null
                        ? java.math.BigDecimal.ZERO : s.getMonthlyCost())
                        .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add),
                "billed", bills.stream().map(b -> b.getAmount() == null
                        ? java.math.BigDecimal.ZERO : b.getAmount())
                        .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add),
                "received", bills.stream().map(b -> b.getReceivedAmt() == null
                        ? java.math.BigDecimal.ZERO : b.getReceivedAmt())
                        .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add)));

        FinSettleRecord record = new FinSettleRecord();
        record.setPeriod(period);
        record.setBatchNo(CodeGen.next(() -> {
            List<Object> objs = settleMapper.selectObjs(new LambdaQueryWrapper<FinSettleRecord>()
                    .select(FinSettleRecord::getBatchNo).orderByDesc(FinSettleRecord::getId).last("LIMIT 1"));
            return objs.isEmpty() ? null : (String) objs.get(0);
        }, "MS-2026-"));
        try {
            record.setSnapshotJson(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(snapshot));
        } catch (Exception e) {
            throw new BizException(ResultCode.SYSTEM_ERROR, "快照序列化失败");
        }
        settleMapper.insert(record);
        return record;
    }

    public PageResult<FinSettleRecord> page(long pageNum, long pageSize) {
        Page<FinSettleRecord> page = new Page<>(pageNum, Math.min(pageSize, 100));
        return PageResult.of(settleMapper.selectPage(page, new LambdaQueryWrapper<FinSettleRecord>()
                .orderByDesc(FinSettleRecord::getId)));
    }
}
