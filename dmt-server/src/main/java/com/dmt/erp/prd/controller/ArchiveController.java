package com.dmt.erp.prd.controller;

import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.R;
import com.dmt.erp.prd.dto.PoolSaveReq;
import com.dmt.erp.prd.entity.*;
import com.dmt.erp.prd.service.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/archives")
@RequiredArgsConstructor
@Validated
public class ArchiveController {

    private final ExitLineService exitLineService;
    private final PoolService poolService;
    private final IpSegmentService ipSegmentService;
    private final EquipmentService equipmentService;
    private final BaseLineService baseLineService;

    // ---------- 基础线路 R2 ----------
    @GetMapping("/base-lines")
    public R<List<ResBaseLine>> baseLines(@RequestParam(required = false) String status,
                                          @RequestParam(required = false) String kw) {
        return R.ok(baseLineService.list(status, kw));
    }

    @PostMapping("/base-lines")
    @PreAuthorize("hasAnyRole('ADMIN','OPS','TECH')")
    public R<Long> createBaseLine(@RequestBody ResBaseLine line) {
        return R.ok(baseLineService.create(line));
    }

    @PutMapping("/base-lines/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OPS','TECH')")
    public R<Void> updateBaseLine(@PathVariable Long id, @RequestBody ResBaseLine line) {
        line.setId(id);
        baseLineService.update(line);
        return R.ok();
    }

    // ---------- 出口线路 R1 ----------
    @GetMapping("/exits")
    public R<List<ResExitLine>> exits(@RequestParam(required = false) String status,
                                      @RequestParam(required = false) String kw) {
        return R.ok(exitLineService.list(status, kw));
    }

    @PostMapping("/exits")
    @PreAuthorize("hasAnyRole('ADMIN','OPS','TECH')")
    public R<Long> createExit(@RequestBody ResExitLine line) {
        return R.ok(exitLineService.create(line));
    }

    @PutMapping("/exits/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OPS','TECH')")
    public R<Void> updateExit(@PathVariable Long id, @RequestBody ResExitLine line) {
        line.setId(id);
        exitLineService.update(line);
        return R.ok();
    }

    @GetMapping("/exits/{id}/load-records")
    public R<PageResult<ResExitLoad>> loadRecords(@PathVariable Long id,
                                                  @RequestParam(defaultValue = "1") long pageNum,
                                                  @RequestParam(defaultValue = "10") long pageSize) {
        return R.ok(exitLineService.loadRecords(id, pageNum, pageSize));
    }

    @PostMapping("/exits/{id}/load-records")
    @PreAuthorize("hasAnyRole('ADMIN','OPS','TECH')")
    public R<Long> addLoadRecord(@PathVariable Long id,
                                 @RequestParam Integer usedM,
                                 @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime measuredAt) {
        return R.ok(exitLineService.addLoadRecord(id, usedM, measuredAt));
    }

    // ---------- 出口池 R0 ----------
    @GetMapping("/pools")
    public R<List<ResExitPool>> pools(@RequestParam(required = false) String status,
                                      @RequestParam(required = false) String kw) {
        return R.ok(poolService.list(status, kw));
    }

    @GetMapping("/pools/{id}/members")
    public R<List<ResPoolExit>> poolMembers(@PathVariable Long id) {
        return R.ok(poolService.members(id));
    }

    @PostMapping("/pools")
    @PreAuthorize("hasAnyRole('ADMIN','OPS','TECH')")
    public R<Long> createPool(@Valid @RequestBody PoolSaveReq req) {
        return R.ok(poolService.create(req));
    }

    @PutMapping("/pools/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OPS','TECH')")
    public R<Void> updatePool(@PathVariable Long id, @Valid @RequestBody PoolSaveReq req) {
        req.setId(id);
        poolService.update(req);
        return R.ok();
    }

    // ---------- IP 段 ----------
    @GetMapping("/ip-segments")
    public R<List<ResIpSegment>> ipSegments(@RequestParam(required = false) String status,
                                            @RequestParam(required = false) Long exitId,
                                            @RequestParam(required = false) String kw) {
        return R.ok(ipSegmentService.list(status, exitId, kw));
    }

    @PostMapping("/ip-segments")
    @PreAuthorize("hasAnyRole('ADMIN','OPS','TECH')")
    public R<Long> createIpSegment(@RequestBody ResIpSegment seg) {
        return R.ok(ipSegmentService.create(seg));
    }

    @PutMapping("/ip-segments/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OPS','TECH')")
    public R<Void> updateIpSegment(@PathVariable Long id, @RequestBody ResIpSegment seg) {
        seg.setId(id);
        ipSegmentService.update(seg);
        return R.ok();
    }

    // ---------- 设备 R4 ----------
    @GetMapping("/equipment")
    public R<List<ResEquipment>> equipment(@RequestParam(required = false) String category,
                                           @RequestParam(required = false) String kw) {
        return R.ok(equipmentService.list(category, kw));
    }

    @PostMapping("/equipment")
    @PreAuthorize("hasAnyRole('ADMIN','OPS','TECH')")
    public R<Long> createEquipment(@RequestBody ResEquipment equipment) {
        return R.ok(equipmentService.create(equipment));
    }

    @PutMapping("/equipment/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','OPS','TECH')")
    public R<Void> updateEquipment(@PathVariable Long id, @RequestBody ResEquipment equipment) {
        equipment.setId(id);
        equipmentService.update(equipment);
        return R.ok();
    }
}
