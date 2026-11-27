package com.dmt.erp.pur.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.dmt.erp.approval.service.ApprovalEngineService;
import com.dmt.erp.approval.service.WritebackRegistry;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.CodeGen;
import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.prd.entity.ResEquipment;
import com.dmt.erp.prd.entity.ResIpSegment;
import com.dmt.erp.prd.mapper.ResEquipmentMapper;
import com.dmt.erp.prd.mapper.ResIpSegmentMapper;
import com.dmt.erp.pur.entity.*;
import com.dmt.erp.pur.mapper.*;
import com.dmt.erp.sys.entity.SysNotification;
import com.dmt.erp.sys.entity.SysUser;
import com.dmt.erp.sys.mapper.SysNotificationMapper;
import com.dmt.erp.sys.mapper.SysUserMapper;
import com.dmt.erp.wo.entity.WoWorkOrder;
import com.dmt.erp.wo.mapper.WoWorkOrderMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 采购域：需求单（含工单资源不足联动）→ 采购合同（价格事实出处）→ 采购单（走审批引擎）
 * → 到货验收 → 入库建档（设备写 R4 库存并溯源采购单；反向通知挂起工单）。
 */
@Service
@RequiredArgsConstructor
public class PurService {

    private final PurReqMapper reqMapper;
    private final PurContractMapper contractMapper;
    private final PurOrderMapper orderMapper;
    private final PurOrderLineMapper lineMapper;
    private final PurOrderReqMapper orderReqMapper;
    private final PurReceiptMapper receiptMapper;
    private final PurInboundDeviceMapper inboundMapper;
    private final ResEquipmentMapper equipmentMapper;
    private final ResIpSegmentMapper ipSegmentMapper;
    private final WoWorkOrderMapper woMapper;
    private final SysUserMapper userMapper;
    private final SysNotificationMapper notificationMapper;
    private final ApprovalEngineService approvalEngine;
    private final WritebackRegistry writebackRegistry;

    @PostConstruct
    void registerWriteback() {
        writebackRegistry.register("采购单",
                this::onOrderApproval,
                poId -> Map.of("poId", poId),
                id -> {
                    PurOrder po = orderMapper.selectById(id);
                    return po == null ? String.valueOf(id) : po.getPoNo();
                });
    }

    /** 采购单审批写回：通过 → 已下单；驳回 → 回草稿留痕 */
    public void onOrderApproval(Long poId, boolean pass) {
        PurOrder po = orderMapper.selectById(poId);
        if (po == null) {
            return;
        }
        if (pass) {
            po.setStatus("已下单");
        } else {
            po.setStatus("草稿");
            po.setRejectReason("采购单审批被驳回（见审批中心意见）");
        }
        orderMapper.updateById(po);
    }

    // ---------- 需求单 ----------

    public PageResult<PurReq> reqPage(String status, Long woId, long pageNum, long pageSize) {
        Page<PurReq> page = new Page<>(pageNum, Math.min(pageSize, 100));
        return PageResult.of(reqMapper.selectPage(page, new LambdaQueryWrapper<PurReq>()
                .eq(status != null && !status.isBlank(), PurReq::getStatus, status)
                .eq(woId != null, PurReq::getLinkedWoId, woId)
                .orderByDesc(PurReq::getId)));
    }

    public Long createReq(PurReq req) {
        if (req.getSpec() == null || req.getSpec().isBlank()) {
            throw new BizException(ResultCode.PARAM_INVALID, "规格与数量必填");
        }
        req.setReqNo(CodeGen.next(() -> {
            List<Object> objs = reqMapper.selectObjs(new LambdaQueryWrapper<PurReq>()
                    .select(PurReq::getReqNo).orderByDesc(PurReq::getId).last("LIMIT 1"));
            return objs.isEmpty() ? null : (String) objs.get(0);
        }, "PR-2026-"));
        if (req.getSource() == null) {
            req.setSource(req.getLinkedWoId() != null ? "资源不足联动" : "手工提报");
        }
        req.setStatus("待处理");
        reqMapper.insert(req);
        return req.getId();
    }

    public void closeReq(Long id) {
        PurReq req = reqMapper.selectById(id);
        if (req == null || !"待处理".equals(req.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "仅待处理需求单可关闭");
        }
        req.setStatus("已关闭");
        reqMapper.updateById(req);
    }

    /** 转采购单：带宽扩容类转原采购合同补充协议（记需求状态），其余转采购单 */
    @Transactional
    public Map<String, Object> convertReq(Long id, Long poId, String kind) {
        PurReq req = reqMapper.selectById(id);
        if (req == null || !"待处理".equals(req.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "仅待处理需求单可转单");
        }
        Map<String, Object> result = new HashMap<>();
        if ("contract_change".equals(kind)) {
            req.setStatus("已转合同变更");
            result.put("kind", "contract_change");
            result.put("note", "带宽扩容转采购合同补充协议（不新建采购单）");
        } else {
            if (poId == null) {
                throw new BizException(ResultCode.PARAM_INVALID, "请指定目标采购单");
            }
            PurOrder po = orderMapper.selectById(poId);
            if (po == null) {
                throw new BizException(ResultCode.STATE_CONFLICT, "采购单不存在");
            }
            req.setStatus("已转采购单");
            req.setPoId(poId);
            PurOrderReq link = new PurOrderReq();
            link.setPoId(poId);
            link.setReqId(id);
            orderReqMapper.insert(link);
            result.put("kind", "po");
        }
        reqMapper.updateById(req);
        return result;
    }

    // ---------- 采购合同 ----------

    public List<PurContract> contractList(String kw) {
        return contractMapper.selectList(new LambdaQueryWrapper<PurContract>()
                .like(kw != null && !kw.isBlank(), PurContract::getName, kw)
                .orderByAsc(PurContract::getId));
    }

    public Long saveContract(PurContract contract) {
        if (contract.getCode() == null || contract.getCode().isBlank()
                || contract.getName() == null || contract.getName().isBlank()) {
            throw new BizException(ResultCode.PARAM_INVALID, "合同编码与名称必填");
        }
        if (contract.getId() == null) {
            contract.setStatus("履行中");
            contractMapper.insert(contract);
            return contract.getId();
        }
        PurContract exist = contractMapper.selectById(contract.getId());
        if (exist == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "采购合同不存在");
        }
        contractMapper.updateById(contract);
        return contract.getId();
    }

    // ---------- 采购单 ----------

    /** 采购单详情聚合：单据+明细+验收批次+入库设备+关联需求+在途审批实例 */
    public Map<String, Object> orderDetail(Long id) {
        PurOrder po = orderMapper.selectById(id);
        if (po == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "采购单不存在");
        }
        Map<String, Object> m = new HashMap<>();
        m.put("order", po);
        m.put("contractCode", po.getContractId() == null ? null
                : contractMapper.selectById(po.getContractId()) == null ? null
                : contractMapper.selectById(po.getContractId()).getCode());
        m.put("lines", lineMapper.selectList(new LambdaQueryWrapper<PurOrderLine>()
                .eq(PurOrderLine::getPoId, id).orderByAsc(PurOrderLine::getId)));
        m.put("receipts", receiptMapper.selectList(new LambdaQueryWrapper<PurReceipt>()
                .eq(PurReceipt::getPoId, id).orderByAsc(PurReceipt::getBatchNo)));
        m.put("devices", inboundMapper.selectList(new LambdaQueryWrapper<PurInboundDevice>()
                .eq(PurInboundDevice::getPoId, id).orderByAsc(PurInboundDevice::getId)));
        List<PurOrderReq> links = orderReqMapper.selectList(new LambdaQueryWrapper<PurOrderReq>()
                .eq(PurOrderReq::getPoId, id));
        List<PurReq> reqs = new java.util.ArrayList<>();
        for (PurOrderReq link : links) {
            PurReq req = reqMapper.selectById(link.getReqId());
            if (req != null) {
                reqs.add(req);
            }
        }
        m.put("reqs", reqs);
        var inst = approvalEngine.activeInstance("采购单", id);
        m.put("activeInstanceId", inst == null ? null : inst.getId());
        return m;
    }

    public PageResult<Map<String, Object>> orderPage(String status, long pageNum, long pageSize) {
        Page<PurOrder> page = new Page<>(pageNum, Math.min(pageSize, 100));
        Map<Long, String> contracts = new HashMap<>();
        contractMapper.selectList(null).forEach(c -> contracts.put(c.getId(), c.getCode()));
        return PageResult.of(orderMapper.selectPage(page, new LambdaQueryWrapper<PurOrder>()
                .eq(status != null && !status.isBlank(), PurOrder::getStatus, status)
                .orderByDesc(PurOrder::getId))
                .convert(po -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("order", po);
                    m.put("contractCode", po.getContractId() == null ? null : contracts.get(po.getContractId()));
                    m.put("lines", lineMapper.selectList(new LambdaQueryWrapper<PurOrderLine>()
                            .eq(PurOrderLine::getPoId, po.getId())));
                    return m;
                }));
    }

    @Transactional
    public Long createOrder(PurOrder order, List<PurOrderLine> lines) {
        if (order.getSupplier() == null || order.getSupplier().isBlank()) {
            throw new BizException(ResultCode.PARAM_INVALID, "供应商必填");
        }
        order.setPoNo(CodeGen.next(() -> {
            List<Object> objs = orderMapper.selectObjs(new LambdaQueryWrapper<PurOrder>()
                    .select(PurOrder::getPoNo).orderByDesc(PurOrder::getId).last("LIMIT 1"));
            return objs.isEmpty() ? null : (String) objs.get(0);
        }, "PO-2026-"));
        order.setStatus("草稿");
        orderMapper.insert(order);
        if (lines != null) {
            for (PurOrderLine line : lines) {
                line.setPoId(order.getId());
                if (line.getReceivedQty() == null) {
                    line.setReceivedQty(0);
                }
                if (line.getAcceptedQty() == null) {
                    line.setAcceptedQty(0);
                }
                lineMapper.insert(line);
            }
        }
        return order.getId();
    }

    /** 提交审批（走引擎「采购单 · 提交」）；未命中流则提示 */
    public void submitOrder(Long id) {
        PurOrder po = orderMapper.selectById(id);
        if (po == null || !"草稿".equals(po.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "仅草稿采购单可提交审批");
        }
        var inst = approvalEngine.submit("采购单", "提交", id, Map.of("poId", id));
        if (inst == null) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "未命中采购单审批流，请先在审批流配置挂接「采购单 · 提交」");
        }
        po.setStatus("待审批");
        orderMapper.updateById(po);
    }

    /** 到货验收批次：回写明细 received/accepted */
    @Transactional
    public void receipt(Long poId, String itemsJson) {
        PurOrder po = orderMapper.selectById(poId);
        if (po == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "采购单不存在");
        }
        if (!"已下单".equals(po.getStatus()) && !"部分到货".equals(po.getStatus())) {
            throw new BizException(ResultCode.STATE_CONFLICT, "当前状态不能到货验收");
        }
        Long batchNo = receiptMapper.selectCount(new LambdaQueryWrapper<PurReceipt>()
                .eq(PurReceipt::getPoId, poId)) + 1;
        PurReceipt receipt = new PurReceipt();
        receipt.setPoId(poId);
        receipt.setBatchNo(batchNo.intValue());
        receipt.setItemsJson(itemsJson);
        receiptMapper.insert(receipt);

        List<Map<String, Object>> items;
        try {
            items = new com.fasterxml.jackson.databind.ObjectMapper().readValue(itemsJson, List.class);
        } catch (Exception e) {
            throw new BizException(ResultCode.PARAM_INVALID, "验收明细格式错误");
        }
        boolean allAccepted = true;
        for (Map<String, Object> item : items) {
            Long lineId = Long.valueOf(String.valueOf(item.get("lineId")));
            int arrived = Integer.parseInt(String.valueOf(item.get("arrived")));
            PurOrderLine line = lineMapper.selectById(lineId);
            if (line == null || !line.getPoId().equals(poId)) {
                continue;
            }
            line.setReceivedQty(line.getReceivedQty() + arrived);
            if ("合格".equals(String.valueOf(item.get("result")))) {
                line.setAcceptedQty(line.getAcceptedQty() + arrived);
            }
            lineMapper.updateById(line);
            if (line.getAcceptedQty() < line.getQuantity()) {
                allAccepted = false;
            }
        }
        po.setStatus(allAccepted && allLinesAccepted(poId) ? "验收完成" : "部分到货");
        orderMapper.updateById(po);
    }

    private boolean allLinesAccepted(Long poId) {
        List<PurOrderLine> lines = lineMapper.selectList(new LambdaQueryWrapper<PurOrderLine>()
                .eq(PurOrderLine::getPoId, poId));
        return !lines.isEmpty() && lines.stream().allMatch(l -> l.getAcceptedQty() >= l.getQuantity());
    }

    /** 入库建档：设备写 R4 库存并溯源采购单；完成后反向通知挂起工单 */
    @Transactional
    public void inbound(Long poId, List<PurInboundDevice> devices, List<ResIpSegment> segments) {
        PurOrder po = orderMapper.selectById(poId);
        if (po == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "采购单不存在");
        }
        if (devices != null) {
            Set<String> seenAssetNos = new HashSet<>();
            for (PurInboundDevice d : devices) {
                if (d.getAssetNo() != null && !d.getAssetNo().isBlank() && !seenAssetNos.add(d.getAssetNo())) {
                    throw new BizException(ResultCode.PARAM_INVALID, "同一入库单内资产编号重复：" + d.getAssetNo());
                }
                if (d.getAssetNo() != null && !d.getAssetNo().isBlank()) {
                    Long dup = inboundMapper.selectCount(new LambdaQueryWrapper<PurInboundDevice>()
                            .eq(PurInboundDevice::getPoId, poId)
                            .eq(PurInboundDevice::getAssetNo, d.getAssetNo()));
                    if (dup > 0) {
                        throw new BizException(ResultCode.STATE_CONFLICT, "资产编号 " + d.getAssetNo() + " 已在该采购单下入库，请勿重复提交");
                    }
                }
                d.setPoId(poId);
                inboundMapper.insert(d);
                String keyword = d.getModel() == null ? d.getBrand() : d.getModel();
                ResEquipment equipment = keyword == null ? null : equipmentMapper.selectOne(new LambdaQueryWrapper<ResEquipment>()
                        .like(ResEquipment::getName, keyword)
                        .orderByAsc(ResEquipment::getId)
                        .last("LIMIT 1"));
                if (equipment != null) {
                    equipment.setStock(equipment.getStock() + 1);
                    equipmentMapper.updateById(equipment);
                }
            }
        }
        if (segments != null) {
            for (ResIpSegment seg : segments) {
                seg.setStatus("可用");
                ipSegmentMapper.insert(seg);
            }
        }
        notifyLinkedWo(poId);
    }

    /** 反向通知：关联需求单携带的挂起工单 → 通知工单创建人恢复开通 */
    private void notifyLinkedWo(Long poId) {
        List<PurOrderReq> links = orderReqMapper.selectList(new LambdaQueryWrapper<PurOrderReq>()
                .eq(PurOrderReq::getPoId, poId));
        for (PurOrderReq link : links) {
            PurReq req = reqMapper.selectById(link.getReqId());
            if (req == null || req.getLinkedWoId() == null) {
                continue;
            }
            WoWorkOrder wo = woMapper.selectById(req.getLinkedWoId());
            if (wo == null) {
                continue;
            }
            SysUser creator = wo.getCreatedBy() == null ? null : userMapper.selectById(wo.getCreatedBy());
            if (creator != null) {
                SysNotification n = new SysNotification();
                n.setUserId(creator.getId());
                n.setType("PUR_INBOUND");
                n.setTitle("采购入库完成，工单可恢复");
                n.setContent("采购单资源已入库（需求 " + req.getReqNo() + "），工单 " + wo.getCode() + " 可继续开通流程");
                n.setIsRead(0);
                n.setRefType("work_order");
                n.setRefId(wo.getId());
                notificationMapper.insert(n);
            }
        }
    }
}
