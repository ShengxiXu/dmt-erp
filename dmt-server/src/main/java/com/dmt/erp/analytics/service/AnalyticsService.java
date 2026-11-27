package com.dmt.erp.analytics.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.fin.entity.FinBill;
import com.dmt.erp.fin.entity.FinSettleRecord;
import com.dmt.erp.fin.mapper.FinBillMapper;
import com.dmt.erp.fin.mapper.FinSettleRecordMapper;
import com.dmt.erp.mdm.entity.MdmContract;
import com.dmt.erp.mdm.entity.MdmContractLine;
import com.dmt.erp.mdm.entity.MdmCustomer;
import com.dmt.erp.mdm.entity.MdmOpportunity;
import com.dmt.erp.mdm.mapper.MdmContractLineMapper;
import com.dmt.erp.mdm.mapper.MdmContractMapper;
import com.dmt.erp.mdm.mapper.MdmCustomerMapper;
import com.dmt.erp.mdm.mapper.MdmOpportunityMapper;
import com.dmt.erp.prd.entity.ResExitLine;
import com.dmt.erp.prd.mapper.ResExitLineMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 经营分析：一页式聚合，全部从现有台账实时推导，不落地存储。
 * 口径：月租收入 = 已生效合同行 price 合计；出口成本 = 生效出口线路月成本合计；
 * 应收/回款/账龄 = fin_bill；pipeline = 商机按阶段；到期看板 = 90 天内到期合同。
 */
@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final MdmContractMapper contractMapper;
    private final MdmContractLineMapper lineMapper;
    private final MdmCustomerMapper customerMapper;
    private final MdmOpportunityMapper opportunityMapper;
    private final ResExitLineMapper exitLineMapper;
    private final FinBillMapper billMapper;
    private final FinSettleRecordMapper settleMapper;
    private final com.dmt.erp.prd.mapper.ResExitPoolMapper poolMapper;
    private final com.dmt.erp.wo.mapper.ResAssignmentMapper assignmentMapper;
    private final com.dmt.erp.sys.mapper.SysConfigMapper sysConfigMapper;

    public Map<String, Object> overview() {
        LocalDate today = LocalDate.now();
        Map<String, Object> r = new LinkedHashMap<>();

        // ① 月租收入与出口成本 → 带宽毛利
        List<MdmContract> active = contractMapper.selectList(new LambdaQueryWrapper<MdmContract>()
                .eq(MdmContract::getStatus, "已生效"));
        Map<Long, BigDecimal> monthlyByContract = new LinkedHashMap<>();
        BigDecimal monthlyRevenue = BigDecimal.ZERO;
        for (MdmContract ct : active) {
            BigDecimal sum = lineMapper.selectList(new LambdaQueryWrapper<MdmContractLine>()
                            .eq(MdmContractLine::getContractId, ct.getId()))
                    .stream().map(l -> l.getPrice() == null ? BigDecimal.ZERO : l.getPrice())
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            monthlyByContract.put(ct.getId(), sum);
            monthlyRevenue = monthlyRevenue.add(sum);
        }
        List<ResExitLine> exits = exitLineMapper.selectList(new LambdaQueryWrapper<ResExitLine>()
                .in(ResExitLine::getStatus, "生效", "启用"));
        BigDecimal exitCost = exits.stream().map(e -> e.getCostMonth() == null ? BigDecimal.ZERO : e.getCostMonth())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal margin = monthlyRevenue.subtract(exitCost);
        r.put("monthlyRevenue", monthlyRevenue);
        r.put("activeContractCount", active.size());
        r.put("monthlyExitCost", exitCost);
        r.put("exitLineCount", exits.size());
        r.put("grossMargin", margin);
        r.put("marginRate", monthlyRevenue.signum() > 0
                ? margin.multiply(BigDecimal.valueOf(100)).divide(monthlyRevenue, 1, RoundingMode.HALF_UP) : BigDecimal.ZERO);

        // ② 应收 / 回款率 / 逾期率 + 收入趋势（按账期归月） + 账龄
        List<FinBill> bills = billMapper.selectList(null);
        BigDecimal total = BigDecimal.ZERO, received = BigDecimal.ZERO, overdueAmt = BigDecimal.ZERO;
        Map<String, BigDecimal[]> byMonth = new LinkedHashMap<>();
        Map<String, BigDecimal> aging = new LinkedHashMap<>(Map.of(
                "未到期", BigDecimal.ZERO, "1-30 天", BigDecimal.ZERO, "31-60 天", BigDecimal.ZERO,
                "61-90 天", BigDecimal.ZERO, "90 天以上", BigDecimal.ZERO));
        int outstanding = 0;
        for (FinBill b : bills) {
            if ("已作废".equals(b.getStatus()) || "已驳回".equals(b.getIssueStatus()) || "审核中".equals(b.getIssueStatus())) {
                continue;
            }
            BigDecimal amt = b.getAmount() == null ? BigDecimal.ZERO : b.getAmount();
            BigDecimal rec = b.getReceivedAmt() == null ? BigDecimal.ZERO : b.getReceivedAmt();
            total = total.add(amt);
            received = received.add(rec);
            if (b.getPeriod() != null) {
                BigDecimal[] cur = byMonth.computeIfAbsent(b.getPeriod(), k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
                cur[0] = cur[0].add(amt);
                cur[1] = cur[1].add(rec);
            }
            BigDecimal balance = amt.subtract(rec);
            if (balance.signum() > 0) {
                outstanding++;
                if (b.getDueDate() != null && b.getDueDate().isBefore(today)) {
                    overdueAmt = overdueAmt.add(balance);
                    long days = ChronoUnit.DAYS.between(b.getDueDate(), today);
                    String bucket = days <= 30 ? "1-30 天" : days <= 60 ? "31-60 天" : days <= 90 ? "61-90 天" : "90 天以上";
                    aging.merge(bucket, balance, BigDecimal::add);
                } else {
                    aging.merge("未到期", balance, BigDecimal::add);
                }
            }
        }
        r.put("receivableTotal", total);
        r.put("receivedTotal", received);
        r.put("receiveRate", total.signum() > 0
                ? received.multiply(BigDecimal.valueOf(100)).divide(total, 0, RoundingMode.HALF_UP) : BigDecimal.ZERO);
        r.put("overdueTotal", overdueAmt);
        r.put("overdueRate", total.signum() > 0
                ? overdueAmt.multiply(BigDecimal.valueOf(100)).divide(total, 0, RoundingMode.HALF_UP) : BigDecimal.ZERO);
        r.put("outstandingCount", outstanding);
        List<Map<String, Object>> trend = new ArrayList<>();
        byMonth.entrySet().stream().sorted(Map.Entry.comparingByKey()).forEach(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("month", e.getKey());
            m.put("amount", e.getValue()[0]);
            m.put("received", e.getValue()[1]);
            trend.add(m);
        });
        r.put("revenueTrend", trend);
        List<Map<String, Object>> agingList = new ArrayList<>();
        aging.forEach((k, v) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("bucket", k);
            m.put("amount", v);
            agingList.add(m);
        });
        r.put("aging", agingList);

        // ③ 商机 pipeline（阶段 → 数量 + 预计金额）
        List<MdmOpportunity> opps = opportunityMapper.selectList(null);
        Map<String, List<MdmOpportunity>> byStage = opps.stream()
                .collect(Collectors.groupingBy(o -> o.getStage() == null ? "跟进中" : o.getStage(), LinkedHashMap::new, Collectors.toList()));
        List<Map<String, Object>> pipeline = new ArrayList<>();
        for (String st : List.of("线索", "跟进中", "已报价", "赢单", "输单")) {
            List<MdmOpportunity> g = byStage.getOrDefault(st, List.of());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("stage", st);
            m.put("count", g.size());
            m.put("amount", g.stream().map(o -> o.getExpectAmount() == null ? BigDecimal.ZERO : o.getExpectAmount())
                    .reduce(BigDecimal.ZERO, BigDecimal::add));
            pipeline.add(m);
        }
        r.put("pipeline", pipeline);

        // ④ 合同到期看板（90 天）
        Map<Long, String> custNames = customerMapper.selectList(null).stream()
                .collect(Collectors.toMap(MdmCustomer::getId, MdmCustomer::getName, (a, b) -> a));
        List<Map<String, Object>> expiring = new ArrayList<>();
        for (MdmContract ct : active) {
            if (ct.getEndDate() == null) {
                continue;
            }
            long days = ChronoUnit.DAYS.between(today, ct.getEndDate());
            if (days < 0 || days > 90) {
                continue;
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("contractId", ct.getId());
            m.put("code", ct.getCode());
            m.put("customer", custNames.getOrDefault(ct.getCustomerId(), "客户 #" + ct.getCustomerId()));
            m.put("endDate", ct.getEndDate());
            m.put("daysLeft", days);
            m.put("monthlyFee", monthlyByContract.getOrDefault(ct.getId(), BigDecimal.ZERO));
            expiring.add(m);
        }
        expiring.sort((a, b) -> Long.compare((Long) a.get("daysLeft"), (Long) b.get("daysLeft")));
        r.put("expiring", expiring);

        // ⑤ 最近月结批次
        List<FinSettleRecord> batches = settleMapper.selectList(new LambdaQueryWrapper<FinSettleRecord>()
                .orderByDesc(FinSettleRecord::getId).last("LIMIT 3"));
        r.put("batches", batches.stream().map(b -> Map.of(
                "batchNo", b.getBatchNo(), "period", b.getPeriod() == null ? "" : b.getPeriod())).collect(Collectors.toList()));

        // ⑥ 出口水位（出口=资源分配聚合 / 带宽容量；池=usedM/capacityM）
        List<Map<String, Object>> water = new ArrayList<>();
        for (ResExitLine e : exitLineMapper.selectList(new LambdaQueryWrapper<ResExitLine>()
                .in(ResExitLine::getStatus, "生效", "启用").orderByAsc(ResExitLine::getId))) {
            BigDecimal sold = assignmentSum(e.getId());
            int cap = e.getBandwidthM() == null ? 0 : e.getBandwidthM();
            int pct = cap > 0 ? sold.multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(cap), 1, RoundingMode.HALF_UP).intValue() : 0;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("label", (e.getCarrier() == null ? "" : e.getCarrier()) + "-" + e.getName());
            m.put("soldM", sold.stripTrailingZeros().toPlainString());
            m.put("capM", cap);
            m.put("pct", pct);
            m.put("pool", false);
            water.add(m);
        }
        for (com.dmt.erp.prd.entity.ResExitPool p : poolMapper.selectList(new LambdaQueryWrapper<com.dmt.erp.prd.entity.ResExitPool>()
                .in(com.dmt.erp.prd.entity.ResExitPool::getStatus, "生效", "启用").orderByAsc(com.dmt.erp.prd.entity.ResExitPool::getId))) {
            int cap = p.getCapacityM() == null ? 0 : p.getCapacityM();
            int used = p.getUsedM() == null ? 0 : p.getUsedM();
            int pct = cap > 0 ? (int) Math.round(used * 100.0 / cap) : 0;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("label", p.getName() + "（" + p.getCode() + "）");
            m.put("soldM", String.valueOf(used));
            m.put("capM", cap);
            m.put("pct", pct);
            m.put("pool", true);
            water.add(m);
        }
        r.put("exitWater", water);

        // ⑦ 账龄五桶（宽限期取策略中心）+ DSO + 坏账候选
        int graceDays = cfgInt("overdue.graceDays", 3);
        int badDebtDays = cfgInt("overdue.badDebtDays", 180);
        Map<String, BigDecimal> aging5 = new LinkedHashMap<>(Map.of());
        aging5.put("未到期", BigDecimal.ZERO);
        aging5.put("宽限期内", BigDecimal.ZERO);
        aging5.put("逾期 ≤30 天", BigDecimal.ZERO);
        aging5.put("逾期 31-90 天", BigDecimal.ZERO);
        aging5.put("逾期 >90 天", BigDecimal.ZERO);
        Map<String, Integer> aging5Cnt = new LinkedHashMap<>();
        aging5.keySet().forEach(k -> aging5Cnt.put(k, 0));
        BigDecimal dsoWeighted = BigDecimal.ZERO, dsoBase = BigDecimal.ZERO, badCandidate = BigDecimal.ZERO;
        for (FinBill b : bills) {
            if ("已作废".equals(b.getStatus()) || "坏账".equals(b.getStatus()) || !"已发出".equals(b.getIssueStatus())) {
                continue;
            }
            BigDecimal balance = b.getAmount().subtract(b.getReceivedAmt() == null ? BigDecimal.ZERO : b.getReceivedAmt());
            if (balance.signum() <= 0) {
                continue;
            }
            long days = b.getDueDate() == null ? -1 : ChronoUnit.DAYS.between(b.getDueDate(), today);
            String bucket = days < 0 ? "未到期" : days <= graceDays ? "宽限期内"
                    : days <= 30 ? "逾期 ≤30 天" : days <= 90 ? "逾期 31-90 天" : "逾期 >90 天";
            aging5.merge(bucket, balance, BigDecimal::add);
            aging5Cnt.merge(bucket, 1, Integer::sum);
            if (days > 0) {
                dsoWeighted = dsoWeighted.add(balance.multiply(BigDecimal.valueOf(days)));
                dsoBase = dsoBase.add(balance);
            }
            if (days >= badDebtDays) {
                badCandidate = badCandidate.add(balance);
            }
        }
        List<Map<String, Object>> agingList5 = new ArrayList<>();
        aging5.forEach((k, v) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("bucket", k);
            m.put("amount", v);
            m.put("count", aging5Cnt.get(k));
            agingList5.add(m);
        });
        r.put("aging5", agingList5);
        r.put("dso", dsoBase.signum() > 0
                ? dsoWeighted.divide(dsoBase, 0, RoundingMode.HALF_UP) : BigDecimal.ZERO);
        r.put("badCandidate", badCandidate);

        // ⑧ pipeline 底部合计
        BigDecimal followingSum = pipeline.stream()
                .filter(p -> List.of("跟进中", "已报价", "线索").contains(p.get("stage")))
                .map(p -> (BigDecimal) p.get("amount")).reduce(BigDecimal.ZERO, BigDecimal::add);
        long wonCnt = opps.stream().filter(o -> "赢单".equals(o.getStage())).count();
        long wonLinked = contractMapper.selectCount(new LambdaQueryWrapper<MdmContract>()
                .isNotNull(MdmContract::getOpportunityId));
        r.put("pipelineFollowingSum", followingSum);
        r.put("wonUnsigned", Math.max(0, wonCnt - wonLinked));
        return r;
    }

    private BigDecimal assignmentSum(Long exitId) {
        return assignmentMapper.selectList(new LambdaQueryWrapper<com.dmt.erp.wo.entity.ResAssignment>()
                        .eq(com.dmt.erp.wo.entity.ResAssignment::getKind, "出口带宽")
                        .eq(com.dmt.erp.wo.entity.ResAssignment::getRefId, exitId))
                .stream().map(a -> a.getQty() == null ? BigDecimal.ZERO : BigDecimal.valueOf(a.getQty()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private int cfgInt(String key, int def) {
        try {
            com.dmt.erp.sys.entity.SysConfig cfg = sysConfigMapper.selectOne(
                    new LambdaQueryWrapper<com.dmt.erp.sys.entity.SysConfig>()
                            .eq(com.dmt.erp.sys.entity.SysConfig::getCfgKey, key).last("LIMIT 1"));
            if (cfg != null && cfg.getCfgValue() != null) {
                return Integer.parseInt(cfg.getCfgValue().trim());
            }
        } catch (Exception ignored) {
        }
        return def;
    }
}
