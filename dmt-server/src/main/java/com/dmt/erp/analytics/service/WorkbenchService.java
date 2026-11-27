package com.dmt.erp.analytics.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.fin.entity.FinBill;
import com.dmt.erp.fin.entity.FinSettleRecord;
import com.dmt.erp.fin.mapper.FinBillMapper;
import com.dmt.erp.fin.mapper.FinSettleRecordMapper;
import com.dmt.erp.lc.mapper.LcTerminateMapper;
import com.dmt.erp.mdm.entity.MdmCustomer;
import com.dmt.erp.mdm.entity.MdmOpportunity;
import com.dmt.erp.mdm.mapper.MdmCustomerMapper;
import com.dmt.erp.mdm.mapper.MdmOpportunityMapper;
import com.dmt.erp.cost.entity.CostSheet;
import com.dmt.erp.cost.mapper.CostSheetMapper;
import com.dmt.erp.prd.entity.ResExitLine;
import com.dmt.erp.prd.mapper.ResExitLineMapper;
import com.dmt.erp.pur.entity.PurBill;
import com.dmt.erp.pur.mapper.PurBillMapper;
import com.dmt.erp.security.LoginUser;
import com.dmt.erp.security.SecurityUtils;
import com.dmt.erp.sys.entity.SysNotification;
import com.dmt.erp.sys.entity.SysUser;
import com.dmt.erp.sys.mapper.SysNotificationMapper;
import com.dmt.erp.sys.mapper.SysUserMapper;
import com.dmt.erp.wo.entity.WoWorkOrder;
import com.dmt.erp.wo.mapper.WoWorkOrderMapper;
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

/**
 * 工作台角色聚合（对照原型 Workbench）：待办 / 角色 KPI / 横幅统计 / 角色关注卡 / 出口水位。
 * 全部从台账实时推导；角色取登录用户首角色（ADMIN→系统管理员）。
 */
@Service
@RequiredArgsConstructor
public class WorkbenchService {

    private final CostSheetMapper sheetMapper;
    private final WoWorkOrderMapper woMapper;
    private final FinBillMapper billMapper;
    private final FinSettleRecordMapper settleMapper;
    private final PurBillMapper purBillMapper;
    private final MdmOpportunityMapper opportunityMapper;
    private final MdmCustomerMapper customerMapper;
    private final ResExitLineMapper exitLineMapper;
    private final SysNotificationMapper notificationMapper;
    private final SysUserMapper userMapper;
    private final LcTerminateMapper terminateMapper;
    private final com.dmt.erp.sys.mapper.SysRoleMapper roleMapper;
    private final com.dmt.erp.mdm.mapper.MdmContractMapper contractMapper;
    private final com.dmt.erp.wo.mapper.ResAssignmentMapper assignmentMapper;
    
    public Map<String, Object> overview() {
        LoginUser me = SecurityUtils.requireUser();
        String role = roleName(me);
        LocalDate today = LocalDate.now();
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("role", role);
        SysUser user = userMapper.selectById(me.getUserId());
        r.put("userName", user == null ? "同事" : user.getName());

        // ---------- 共享事实 ----------
        List<CostSheet> sheets = sheetMapper.selectList(null);
        List<CostSheet> drafts = sheets.stream().filter(s -> "待填写".equals(s.getStatus())).toList();
        List<CostSheet> waiting = sheets.stream().filter(s -> "待对方提交".equals(s.getStatus()) || "已齐套".equals(s.getStatus())).toList();
        List<CostSheet> approving = sheets.stream().filter(s -> "审批中".equals(s.getStatus())).toList();
        List<CostSheet> passed = sheets.stream().filter(s -> "已通过".equals(s.getStatus())).toList();
        BigDecimal approvingCost = approving.stream().map(s -> s.getMonthlyCost() == null ? BigDecimal.ZERO : s.getMonthlyCost())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        List<WoWorkOrder> wos = woMapper.selectList(null);
        List<WoWorkOrder> woOnway = wos.stream().filter(w -> !"激活计费".equals(w.getStatus()) && !"已完结".equals(w.getStatus())).toList();
        List<FinBill> bills = billMapper.selectList(new LambdaQueryWrapper<FinBill>()
                .eq(FinBill::getIssueStatus, "已发出"));
        List<FinBill> overdueBills = bills.stream()
                .filter(b -> b.getDueDate() != null && b.getDueDate().isBefore(today)
                        && !"已收讫".equals(b.getStatus()) && !"坏账".equals(b.getStatus())).toList();
        BigDecimal overdueSum = overdueBills.stream()
                .map(b -> b.getAmount().subtract(b.getReceivedAmt() == null ? BigDecimal.ZERO : b.getReceivedAmt()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        List<PurBill> supOverdue = purBillMapper.selectList(new LambdaQueryWrapper<PurBill>()
                .lt(PurBill::getPayDueDate, today).in(PurBill::getStatus, "待入账", "已入账"));
        long unread = notificationMapper.selectCount(new LambdaQueryWrapper<SysNotification>()
                .eq(SysNotification::getUserId, me.getUserId()).eq(SysNotification::getIsRead, 0));
        List<MdmOpportunity> opps = opportunityMapper.selectList(null);
        FinSettleRecord latestBatch = settleMapper.selectList(new LambdaQueryWrapper<FinSettleRecord>()
                .orderByDesc(FinSettleRecord::getId).last("LIMIT 1")).stream().findFirst().orElse(null);
        List<Map<String, Object>> exitWater = exitWater();
        Map<String, Object> topExit = exitWater.isEmpty() ? null : exitWater.get(0);

        // ---------- 待办（角色专属） ----------
        List<Map<String, Object>> todos = new ArrayList<>();
        switch (role) {
            case "业务支撑部" -> {
                drafts.forEach(s -> todos.add(todo("核算单 " + s.getCode() + " · " + custName(s.getCustomerId()),
                        "新单待起草 · 合同行已带入", "/cost", "去填报", false)));
                waiting.forEach(s -> todos.add(todo("核算单 " + s.getCode() + " · " + custName(s.getCustomerId()),
                        "你方条目已完成，等技术部提交", "/cost", "查看进度", false)));
                approving.forEach(s -> todos.add(todo("核算单 " + s.getCode() + " · " + custName(s.getCustomerId()),
                        "审批中 · 当前节点：" + (s.getCurNode() == null ? "—" : s.getCurNode()), "/approval", "查看", false)));
            }
            case "技术部" -> {
                waiting.stream().filter(s -> s.getTechDone() == null || s.getTechDone() == 0)
                        .forEach(s -> todos.add(todo("核算单 " + s.getCode() + " · " + custName(s.getCustomerId()),
                                "支撑部已提交，等你方填技术类条目", "/cost", "去填报", false)));
                woOnway.forEach(w -> todos.add(todo("工单 " + w.getCode() + " · " + woCustName(w),
                        "当前节点：" + w.getStatus(), "/delivery?id=" + w.getId(), "去处理", false)));
                if (topExit != null) {
                    todos.add(todo("出口 " + topExit.get("label") + " 水位 " + topExit.get("pct") + "%（当前最高）",
                            "关注扩容节奏", "/resources/r1", "查看", (int) topExit.get("pct") > 85));
                }
            }
            case "财务" -> {
                approving.forEach(s -> todos.add(todo("核算单 " + s.getCode() + " · " + custName(s.getCustomerId()),
                        "月成本 " + wan(s.getMonthlyCost()) + " 元 · 毛利 " + (s.getMargin() == null ? "—" : s.getMargin() + "%")
                                + " · 当前节点：" + (s.getCurNode() == null ? "—" : s.getCurNode()),
                        "/approval", "去审批", true)));
                if (!overdueBills.isEmpty()) {
                    todos.add(todo("逾期应收 " + wan(overdueSum) + " 元",
                            overdueBills.size() + " 笔到期未收讫", "/finance/overdue", "去催收", false));
                }
                if (!supOverdue.isEmpty()) {
                    todos.add(todo("超期未付账单 " + supOverdue.size() + " 笔 · "
                            + wan(supOverdue.stream().map(PurBill::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add)) + " 元",
                            supOverdue.stream().limit(3).map(b -> b.getSupplier() + " " + b.getBillNo()).reduce((a, b) -> a + "；" + b).orElse(""),
                            "/bills", "去处理", true));
                }
                String period = java.time.YearMonth.now().minusMonths(1).toString();
                if (settleMapper.selectCount(new LambdaQueryWrapper<FinSettleRecord>()
                        .eq(FinSettleRecord::getPeriod, period)) == 0) {
                    todos.add(todo(period + " 账期待跑月结", "跑批后生成快照归档与差异对比", "/finance/settle", "去跑月结", false));
                }
            }
            case "管理层" -> {
                approving.forEach(s -> todos.add(todo("核算单 " + s.getCode() + " · " + custName(s.getCustomerId()),
                        "月成本 " + wan(s.getMonthlyCost()) + " 元 · 审批中", "/approval", "去审批", true)));
                if (!overdueBills.isEmpty()) {
                    todos.add(todo("逾期应收 " + wan(overdueSum) + " 元", overdueBills.size() + " 笔", "/finance/overdue", "查看", false));
                }
            }
            case "销售部" -> {
                opps.stream().filter(o -> "跟进中".equals(o.getStage()) || "已报价".equals(o.getStage()))
                        .forEach(o -> todos.add(todo("商机 " + o.getCode() + " · " + o.getName(),
                                "阶段：" + o.getStage() + (o.getExpectedCloseAt() != null ? " · 预计成交 " + o.getExpectedCloseAt() : ""),
                                "/opportunity", "去跟进", false)));
                if (unread > 0) {
                    todos.add(todo(unread + " 条未读通知", "合同 / 审批动态", "/notifications", "去查看", false));
                }
            }
            default -> {
                if (unread > 0) {
                    todos.add(todo(unread + " 条未读通知", "消息通知中心", "/notifications", "去查看", false));
                }
                long pendBill = purBillMapper.selectCount(new LambdaQueryWrapper<PurBill>().eq(PurBill::getStatus, "待入账"));
                if (pendBill > 0) {
                    todos.add(todo(pendBill + " 张供应商账单待入账", "手工待确认", "/bills", "去入账", false));
                }
                approving.forEach(s -> todos.add(todo("核算单 " + s.getCode() + " · " + custName(s.getCustomerId()),
                        "审批中 · " + (s.getCurNode() == null ? "—" : s.getCurNode()), "/approval", "查看", false)));
            }
        }
        r.put("todos", todos);

        // ---------- 角色 KPI（4 张） ----------
        List<Map<String, Object>> kpis = new ArrayList<>();
        switch (role) {
            case "业务支撑部" -> {
                kpis.add(kpi("我的待办", todos.size() + " 项", "按紧急度排序", true, "#todo"));
                kpis.add(kpi("待起草核算单", drafts.size() + " 单", "合同流程带入 · 无新建入口", true, "/cost"));
                kpis.add(kpi("技术待提交", waiting.size() + " 单", "支撑部已提交，等技术部", waiting.isEmpty(), "/cost"));
                kpis.add(kpi("审批中", approving.size() + " 单", "合计月成本 " + wan(approvingCost) + " 元", true, "/approval"));
            }
            case "技术部" -> {
                kpis.add(kpi("我的待办", todos.size() + " 项", "按紧急度排序", true, "#todo"));
                kpis.add(kpi("在途工单", woOnway.size() + " 个", woOnway.isEmpty() ? "无在途工单" : "按节点推进", true, "/delivery"));
                long techPending = waiting.stream().filter(s -> s.getTechDone() == null || s.getTechDone() == 0).count();
                kpis.add(kpi("待填技术条目", techPending + " 单", "支撑部已提交，等你方填报", techPending == 0, "/cost"));
                kpis.add(kpi("出口最高水位", topExit == null ? "—" : topExit.get("pct") + "%",
                        topExit == null ? "—" : String.valueOf(topExit.get("label")),
                        topExit == null || (int) topExit.get("pct") <= 70, "/resources/r1"));
            }
            case "财务" -> {
                kpis.add(kpi("我的待办", todos.size() + " 项", "按紧急度排序", true, "#todo"));
                kpis.add(kpi("待审批", approving.size() + " 单", "合计月成本 " + wan(approvingCost) + " 元", true, "/approval"));
                kpis.add(kpi("逾期应收", wan(overdueSum) + " 元", overdueBills.size() + " 笔到期未收讫", overdueBills.isEmpty(), "/finance/overdue"));
                kpis.add(kpi("月结批次", latestBatch == null ? "待跑月结" : latestBatch.getBatchNo(),
                        latestBatch == null ? "尚无归档" : latestBatch.getPeriod() + " 已归档", true, "/finance/settle"));
            }
            case "管理层" -> {
                long lowMargin = sheets.stream().filter(s -> s.getMargin() != null
                        && s.getMargin().compareTo(new BigDecimal("45")) < 0).count();
                kpis.add(kpi("低毛利核算单", lowMargin + " 张", "阈值 45%，审批时关注", lowMargin == 0, "/cost"));
                kpis.add(kpi("审批中月成本", wan(approvingCost) + " 元/月", approving.size() + " 单在审", true, "/approval"));
                kpis.add(kpi("逾期应收", wan(overdueSum) + " 元", overdueBills.size() + " 笔到期未收讫", overdueBills.isEmpty(), "/finance/overdue"));
                int avg = exitWater.isEmpty() ? 0 : (int) Math.round(exitWater.stream().mapToInt(e -> (int) e.get("pct")).average().orElse(0));
                kpis.add(kpi("出口平均水位", avg + "%", exitWater.size() + " 条出口", true, "/resources/r1"));
            }
            case "销售部" -> {
                long following = opps.stream().filter(o -> "跟进中".equals(o.getStage()) || "已报价".equals(o.getStage())).count();
                long won = opps.stream().filter(o -> "赢单".equals(o.getStage())).count();
                kpis.add(kpi("我的待办", todos.size() + " 项", "按紧急度排序", true, "#todo"));
                kpis.add(kpi("在跟进商机", following + " 个", "数据范围：仅本人数据", true, "/opportunity"));
                kpis.add(kpi("累计赢单", won + " 单", "商机赢单自动关闭", true, "/opportunity"));
                kpis.add(kpi("未读通知", unread + " 条", "消息通知中心", unread == 0, "/notifications"));
            }
            default -> {
                long active = userMapper.selectCount(new LambdaQueryWrapper<SysUser>().eq(SysUser::getStatus, "启用"));
                long total = userMapper.selectCount(null);
                long pendBill = purBillMapper.selectCount(new LambdaQueryWrapper<PurBill>().eq(PurBill::getStatus, "待入账"));
                kpis.add(kpi("启用账号", active + " 个", "共 " + total + " 个账号", true, "/system/users"));
                kpis.add(kpi("未读通知", unread + " 条", "消息通知中心", unread == 0, "/notifications"));
                kpis.add(kpi("待入账账单", pendBill + " 张", "供应商账单", pendBill == 0, "/bills"));
                kpis.add(kpi("审批中核算单", approving.size() + " 单", "审批中心", true, "/approval"));
            }
        }
        r.put("kpis", kpis);

        // ---------- 横幅 3 统计 ----------
        r.put("banner", List.of(
                Map.of("label", "我的待办", "value", todos.size() + " 项", "alert", false),
                Map.of("label", "审批中核算单", "value", approving.size() + " 单", "alert", false),
                Map.of("label", "逾期应收", "value", wan(overdueSum) + " 元", "alert", overdueSum.signum() > 0)));

        // ---------- 角色关注卡 ----------
        Map<String, Object> focus = new LinkedHashMap<>();
        switch (role) {
            case "业务支撑部" -> {
                focus.put("title", "核算单漏斗");
                focus.put("linkTo", "/cost");
                focus.put("linkText", "去处理");
                focus.put("rows", List.of(
                        bar("待填写", drafts.size(), null), bar("待对方提交", waiting.size(), null),
                        bar("审批中", approving.size(), null), bar("已通过", passed.size(), null)));
                focus.put("note", "核算单由合同签订自动带入，从「待填写」开始流转");
            }
            case "技术部" -> {
                focus.put("title", "在途工单节点");
                focus.put("linkTo", "/delivery");
                focus.put("linkText", "全部工单");
                Map<String, Integer> byStep = new LinkedHashMap<>();
                woOnway.forEach(w -> byStep.merge(w.getStatus(), 1, Integer::sum));
                List<Map<String, Object>> rows = new ArrayList<>();
                byStep.forEach((k, v) -> rows.add(bar(k, v, null)));
                focus.put("rows", rows);
                focus.put("note", "节点：可用性检查 → 分配申请 → 分配审批 → 绑定扣减 → 实施 → 确认 → 激活计费");
            }
            case "财务" -> {
                focus.put("title", "应收状态分布");
                focus.put("linkTo", "/billing");
                focus.put("linkText", "客户账单");
                Map<String, List<FinBill>> byStatus = new LinkedHashMap<>();
                bills.forEach(b -> byStatus.computeIfAbsent(b.getStatus(), k -> new ArrayList<>()).add(b));
                List<Map<String, Object>> rows = new ArrayList<>();
                byStatus.forEach((st, list) -> {
                    BigDecimal sum = list.stream().map(b -> b.getAmount()
                                    .subtract(b.getReceivedAmt() == null ? BigDecimal.ZERO : b.getReceivedAmt()))
                            .reduce(BigDecimal.ZERO, BigDecimal::add);
                    rows.add(bar(st, list.size(), wan(sum) + " 元"));
                });
                focus.put("rows", rows);
                focus.put("note", "已发出账单才进应收；收款走回款认领核销");
            }
            case "管理层" -> {
                focus.put("title", "月结概览");
                focus.put("linkTo", "/finance/settle");
                focus.put("linkText", latestBatch == null ? "去跑月结" : "全部批次");
                List<Map<String, Object>> rows = new ArrayList<>();
                if (latestBatch != null) {
                    rows.add(text("最近批次", latestBatch.getBatchNo() + "（" + latestBatch.getPeriod() + "）"));
                    rows.add(text("归档时间", latestBatch.getCreatedAt() == null ? "—" : latestBatch.getCreatedAt().toString().substring(0, 10)));
                } else {
                    rows.add(text("暂无月结批次", "跑批后展示收入/毛利对比"));
                }
                focus.put("rows", rows);
                focus.put("note", "月结快照归档不重算；差异留中心滚动");
            }
            case "销售部" -> {
                focus.put("title", "商机阶段分布");
                focus.put("linkTo", "/opportunity");
                focus.put("linkText", "全部商机");
                List<Map<String, Object>> rows = new ArrayList<>();
                for (String st : List.of("线索", "跟进中", "已报价", "赢单", "输单")) {
                    long c = opps.stream().filter(o -> st.equals(o.getStage())).count();
                    if (c > 0) {
                        rows.add(bar(st, (int) c, null));
                    }
                }
                focus.put("rows", rows);
                focus.put("note", "数据权限「仅本人数据」：列表只显示本人名下客户与商机");
            }
            default -> {
                focus.put("title", "系统运行概况");
                focus.put("linkTo", "/system/users");
                focus.put("linkText", "用户与角色 →");
                long active = userMapper.selectCount(new LambdaQueryWrapper<SysUser>().eq(SysUser::getStatus, "启用"));
                long total = userMapper.selectCount(null);
                focus.put("rows", List.of(
                        text("启用账号", active + " / " + total),
                        text("未读通知", unread + " 条"),
                        text("待入账账单", purBillMapper.selectCount(new LambdaQueryWrapper<PurBill>()
                                .eq(PurBill::getStatus, "待入账")) + " 张"),
                        text("审批中核算单", approving.size() + " 单")));
                focus.put("note", "权限矩阵调整即时生效；审批流在「审批流配置」，参数在「策略中心」维护");
            }
        }
        r.put("focus", focus);

        // ---------- 出口水位（前 4） ----------
        r.put("exits", exitWater.stream().limit(4).toList());

        // ---------- 快捷入口动态数字 ----------
        r.put("quick", Map.of(
                "approving", approving.size(),
                "woOnway", woOnway.size(),
                "latestPeriod", latestBatch == null ? "" : latestBatch.getPeriod(),
                "unread", unread));
        return r;
    }

    /** 出口水位：已售=资源分配（出口带宽）合计 / 带宽容量 */
    private List<Map<String, Object>> exitWater() {
        List<ResExitLine> exits = exitLineMapper.selectList(new LambdaQueryWrapper<ResExitLine>()
                .in(ResExitLine::getStatus, "生效", "启用"));
        List<Map<String, Object>> r = new ArrayList<>();
        for (ResExitLine e : exits) {
            BigDecimal sold = assignmentSum("出口带宽", e.getId());
            int cap = e.getBandwidthM() == null ? 0 : e.getBandwidthM();
            int pct = cap > 0 ? sold.multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(cap), 0, RoundingMode.HALF_UP).intValue() : 0;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("label", e.getCode() + " " + (e.getCarrier() == null ? "" : e.getCarrier())
                    + " · " + (cap >= 1000 ? (cap / 1000) + "G" : cap + "M"));
            m.put("pct", pct);
            r.add(m);
        }
        r.sort((a, b) -> Integer.compare((int) b.get("pct"), (int) a.get("pct")));
        return r;
    }

    private BigDecimal assignmentSum(String kind, Long refId) {
        List<com.dmt.erp.wo.entity.ResAssignment> list = assignmentMapper.selectList(
                new LambdaQueryWrapper<com.dmt.erp.wo.entity.ResAssignment>()
                        .eq(com.dmt.erp.wo.entity.ResAssignment::getKind, kind)
                        .eq(com.dmt.erp.wo.entity.ResAssignment::getRefId, refId));
        return list.stream().map(a -> a.getQty() == null ? BigDecimal.ZERO : BigDecimal.valueOf(a.getQty()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    
    private String roleName(LoginUser me) {
        List<com.dmt.erp.sys.entity.SysRole> roles = roleMapper.selectByUserId(me.getUserId());
        List<String> codes = roles == null ? List.of() : roles.stream().map(com.dmt.erp.sys.entity.SysRole::getCode).toList();
        if (codes.contains("ADMIN")) {
            return "系统管理员";
        }
        return switch (codes.isEmpty() ? "" : codes.get(0)) {
            case "OPS" -> "业务支撑部";
            case "TECH" -> "技术部";
            case "FIN" -> "财务";
            case "MANAGER" -> "管理层";
            case "SALES" -> "销售部";
            default -> "系统管理员";
        };
    }

    private String woCustName(WoWorkOrder w) {
        if (w.getContractId() == null) {
            return "—";
        }
        com.dmt.erp.mdm.entity.MdmContract ct = contractMapper.selectById(w.getContractId());
        return ct == null ? "—" : custName(ct.getCustomerId());
    }

    private String custName(Long id) {
        if (id == null) {
            return "—";
        }
        MdmCustomer c = customerMapper.selectById(id);
        return c == null ? "客户 #" + id : c.getName();
    }

    private String wan(BigDecimal n) {
        BigDecimal v = n == null ? BigDecimal.ZERO : n;
        if (v.abs().compareTo(new BigDecimal("10000")) >= 0) {
            return v.divide(new BigDecimal("10000"), 1, RoundingMode.HALF_UP) + " 万";
        }
        return v.setScale(0, RoundingMode.HALF_UP).toPlainString();
    }

    private Map<String, Object> todo(String title, String sub, String link, String cta, boolean hot) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("title", title);
        m.put("sub", sub);
        m.put("link", link);
        m.put("cta", cta);
        m.put("hot", hot);
        return m;
    }

    private Map<String, Object> kpi(String label, String value, String delta, boolean good, String to) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("label", label);
        m.put("value", value);
        m.put("delta", delta);
        m.put("good", good);
        m.put("to", to);
        return m;
    }

    private Map<String, Object> bar(String label, int count, String sum) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("label", label);
        m.put("count", count);
        if (sum != null) {
            m.put("sum", sum);
        }
        return m;
    }

    private Map<String, Object> text(String label, String value) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("label", label);
        m.put("text", value);
        return m;
    }
}
