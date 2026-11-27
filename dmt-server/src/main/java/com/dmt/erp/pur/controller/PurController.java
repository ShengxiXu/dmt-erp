package com.dmt.erp.pur.controller;

import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.R;
import com.dmt.erp.prd.entity.ResIpSegment;
import com.dmt.erp.pur.entity.PurBill;
import com.dmt.erp.pur.entity.PurContract;
import com.dmt.erp.pur.entity.PurInboundDevice;
import com.dmt.erp.pur.entity.PurOrder;
import com.dmt.erp.pur.entity.PurOrderLine;
import com.dmt.erp.pur.entity.PurReq;
import com.dmt.erp.pur.service.PurService;
import com.dmt.erp.pur.service.SupBillService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/purchase")
@RequiredArgsConstructor
@Validated
public class PurController {

    private final PurService purService;
    private final SupBillService supBillService;
    private final ObjectMapper objectMapper;

    // ---------- 供应商账单 ----------

    @GetMapping("/bills")
    public R<List<PurBill>> bills(@RequestParam(required = false) String status,
                                  @RequestParam(required = false) String kw) {
        return R.ok(supBillService.list(status, kw));
    }

    @GetMapping("/bills/{id}")
    public R<Map<String, Object>> billDetail(@PathVariable Long id) {
        return R.ok(supBillService.detail(id));
    }

    @PostMapping("/bills")
    public R<Long> createBill(@RequestBody PurBill bill) {
        return R.ok(supBillService.create(bill));
    }

    @PostMapping("/bills/{id}/post")
    public R<Void> postBill(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        supBillService.post(id, body == null ? null : body.get("tag"));
        return R.ok();
    }

    @PostMapping("/bills/{id}/void")
    public R<Void> voidBill(@PathVariable Long id) {
        supBillService.voidBill(id);
        return R.ok();
    }

    // ---------- 需求单 ----------

    @GetMapping("/reqs")
    public R<PageResult<PurReq>> reqs(@RequestParam(required = false) String status,
                                      @RequestParam(required = false) Long woId,
                                      @RequestParam(defaultValue = "1") long pageNum,
                                      @RequestParam(defaultValue = "10") long pageSize) {
        return R.ok(purService.reqPage(status, woId, pageNum, pageSize));
    }

    @PostMapping("/reqs")
    public R<Long> createReq(@RequestBody PurReq req) {
        return R.ok(purService.createReq(req));
    }

    @PostMapping("/reqs/{id}/close")
    public R<Void> closeReq(@PathVariable Long id) {
        purService.closeReq(id);
        return R.ok();
    }

    @PostMapping("/reqs/{id}/convert")
    public R<Map<String, Object>> convert(@PathVariable Long id,
                                          @RequestParam(required = false) Long poId,
                                          @RequestParam String kind) {
        return R.ok(purService.convertReq(id, poId, kind));
    }

    // ---------- 采购合同 ----------

    @GetMapping("/contracts")
    public R<List<PurContract>> contracts(@RequestParam(required = false) String kw) {
        return R.ok(purService.contractList(kw));
    }

    @PostMapping("/contracts")
    public R<Long> saveContract(@RequestBody PurContract contract) {
        return R.ok(purService.saveContract(contract));
    }

    // ---------- 采购单 ----------

    @GetMapping("/orders")
    public R<PageResult<Map<String, Object>>> orders(@RequestParam(required = false) String status,
                                                     @RequestParam(defaultValue = "1") long pageNum,
                                                     @RequestParam(defaultValue = "10") long pageSize) {
        return R.ok(purService.orderPage(status, pageNum, pageSize));
    }

    @PostMapping("/orders")
    public R<Long> createOrder(@RequestBody Map<String, Object> body) {
        PurOrder order = objectMapper
                .convertValue(body.get("order"), PurOrder.class);
        List<PurOrderLine> lines = body.get("lines") == null ? List.of()
                : objectMapper
                .convertValue(body.get("lines"),
                        new com.fasterxml.jackson.core.type.TypeReference<List<PurOrderLine>>() {
                        });
        return R.ok(purService.createOrder(order, lines));
    }

    @PostMapping("/orders/{id}/submit")
    public R<Void> submitOrder(@PathVariable Long id) {
        purService.submitOrder(id);
        return R.ok();
    }

    @PostMapping("/orders/{id}/receipts")
    public R<Void> receipt(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        purService.receipt(id, String.valueOf(body.get("itemsJson")));
        return R.ok();
    }

    @PostMapping("/orders/{id}/inbound")
    public R<Void> inbound(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        List<PurInboundDevice> devices = body.get("devices") == null ? null
                : objectMapper
                .convertValue(body.get("devices"),
                        new com.fasterxml.jackson.core.type.TypeReference<List<PurInboundDevice>>() {
                        });
        List<ResIpSegment> segments = body.get("segments") == null ? null
                : objectMapper
                .convertValue(body.get("segments"),
                        new com.fasterxml.jackson.core.type.TypeReference<List<ResIpSegment>>() {
                        });
        purService.inbound(id, devices, segments);
        return R.ok();
    }

    @GetMapping("/orders/{id}/detail")
    public R<Map<String, Object>> orderDetail(@PathVariable Long id) {
        return R.ok(purService.orderDetail(id));
    }
}
