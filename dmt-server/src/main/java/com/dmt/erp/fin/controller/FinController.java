package com.dmt.erp.fin.controller;

import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.R;
import com.dmt.erp.fin.entity.*;
import com.dmt.erp.fin.service.BillService;
import com.dmt.erp.fin.service.ClaimService;
import com.dmt.erp.fin.service.InvoiceService;
import com.dmt.erp.fin.service.SettleService;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/finance")
@RequiredArgsConstructor
@Validated
public class FinController {

    private final ClaimService claimService;
    private final BillService billService;
    private final SettleService settleService;
    private final InvoiceService invoiceService;
    private final com.dmt.erp.fin.service.BadDebtService badDebtService;
    private final com.dmt.erp.fin.service.SuspendTicketService suspendTicketService;

    // ---------- 回款认领 ----------

    @GetMapping("/bank-flows")
    public R<PageResult<FinBankFlow>> flows(@RequestParam(required = false) String status,
                                            @RequestParam(required = false) String kw,
                                            @RequestParam(defaultValue = "1") long pageNum,
                                            @RequestParam(defaultValue = "10") long pageSize) {
        return R.ok(claimService.flowPage(status, kw, pageNum, pageSize));
    }

    @PostMapping("/bank-flows")
    public R<Long> createFlow(@RequestBody FinBankFlow flow) {
        return R.ok(claimService.createFlow(flow));
    }

    @GetMapping("/bank-flows/{id}/match")
    public R<Map<String, Object>> match(@PathVariable Long id) {
        return R.ok(claimService.match(id));
    }

    @PostMapping("/bank-flows/{id}/claim")
    public R<Void> claim(@PathVariable Long id, @RequestBody List<Map<String, Object>> allocs) {
        claimService.claim(id, allocs);
        return R.ok();
    }

    @PostMapping("/bank-flows/{id}/red-flush")
    public R<Void> redFlush(@PathVariable Long id) {
        claimService.redFlush(id);
        return R.ok();
    }

    // ---------- 账单 ----------

    @GetMapping("/bills")
    public R<PageResult<Map<String, Object>>> bills(@RequestParam(required = false) String kw,
                                                    @RequestParam(required = false) String status,
                                                    @RequestParam(required = false) String issueStatus,
                                                    @RequestParam(required = false) Long customerId,
                                                    @RequestParam(defaultValue = "1") long pageNum,
                                                    @RequestParam(defaultValue = "10") long pageSize) {
        return R.ok(billService.page(kw, status, issueStatus, customerId, pageNum, pageSize));
    }

    @PostMapping("/bills/{id}/review")
    public R<Void> reviewBill(@PathVariable Long id, @RequestParam boolean pass,
                              @RequestParam(required = false) String note) {
        billService.review(id, pass, note);
        return R.ok();
    }

    @PostMapping("/bills")
    public R<Long> createBill(@RequestBody FinBill bill) {
        return R.ok(billService.create(bill));
    }

    @GetMapping("/bills/{id}")
    public R<Map<String, Object>> billDetail(@PathVariable Long id) {
        return R.ok(billService.detail(id));
    }

    @GetMapping("/bills/overdue")
    public R<List<FinBill>> overdue() {
        return R.ok(billService.overdue());
    }

    @PostMapping("/billing/scan")
    public R<Map<String, Object>> billingScan(@RequestParam String period) {
        return R.ok(billService.runScan(period));
    }

    // ---------- 欠费与坏账 ----------

    @GetMapping("/overdue-bills")
    public R<List<Map<String, Object>>> overdueBills() {
        return R.ok(badDebtService.overdueBills());
    }

    @GetMapping("/bad-debts")
    public R<List<com.dmt.erp.fin.entity.FinBadDebt>> badDebts(@RequestParam(required = false) String status) {
        return R.ok(badDebtService.list(status));
    }

    @PostMapping("/bad-debts")
    public R<Long> submitBadDebt(@RequestBody com.dmt.erp.fin.entity.FinBadDebt app) {
        return R.ok(badDebtService.submit(app));
    }

    // ---------- 停机复机工单 ----------

    @GetMapping("/tickets")
    public R<List<com.dmt.erp.fin.entity.FinSuspendTicket>> tickets(@RequestParam(required = false) String status) {
        return R.ok(suspendTicketService.list(status));
    }

    @PostMapping("/bills/{id}/suspend")
    public R<Long> createSuspend(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        return R.ok(suspendTicketService.createSuspend(id, body == null ? null : body.get("reason")));
    }

    @PostMapping("/tickets/{id}/execute")
    public R<Void> executeTicket(@PathVariable Long id, @RequestBody Map<String, String> body) {
        suspendTicketService.execute(id, body.get("action"), body.get("result"), body.get("note"));
        return R.ok();
    }

    // ---------- 月结 ----------

    @PostMapping("/settle/run")
    public R<FinSettleRecord> runSettle(@RequestParam String period) {
        return R.ok(settleService.run(period));
    }

    @GetMapping("/settle/batches")
    public R<PageResult<FinSettleRecord>> settleBatches(@RequestParam(defaultValue = "1") long pageNum,
                                                        @RequestParam(defaultValue = "10") long pageSize) {
        return R.ok(settleService.page(pageNum, pageSize));
    }

    // ---------- 开票 / 付款 ----------

    @GetMapping("/invoices")
    public R<PageResult<FinInvoiceApp>> invoices(@RequestParam(required = false) String status,
                                                 @RequestParam(defaultValue = "1") long pageNum,
                                                 @RequestParam(defaultValue = "10") long pageSize) {
        return R.ok(invoiceService.invoicePage(status, pageNum, pageSize));
    }

    @PostMapping("/invoices")
    public R<Long> createInvoice(@RequestBody FinInvoiceApp app) {
        return R.ok(invoiceService.createInvoice(app));
    }

    @PostMapping("/invoices/{id}/action")
    public R<Void> invoiceAction(@PathVariable Long id, @RequestParam String action) {
        invoiceService.invoiceAction(id, action);
        return R.ok();
    }

    @GetMapping("/pay-requests")
    public R<PageResult<FinPayRequest>> payRequests(@RequestParam(required = false) String status,
                                                    @RequestParam(defaultValue = "1") long pageNum,
                                                    @RequestParam(defaultValue = "10") long pageSize) {
        return R.ok(invoiceService.payPage(status, pageNum, pageSize));
    }

    @PostMapping("/pay-requests")
    public R<Long> createPay(@RequestBody FinPayRequest req) {
        return R.ok(invoiceService.createPay(req));
    }

    @PostMapping("/pay-requests/{id}/action")
    public R<Void> payAction(@PathVariable Long id, @RequestParam String action) {
        invoiceService.payAction(id, action);
        return R.ok();
    }
}
