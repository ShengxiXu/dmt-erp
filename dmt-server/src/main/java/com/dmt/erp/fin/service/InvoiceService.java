package com.dmt.erp.fin.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.CodeGen;
import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.fin.entity.FinInvoiceApp;
import com.dmt.erp.fin.entity.FinPayRequest;
import com.dmt.erp.fin.mapper.FinInvoiceAppMapper;
import com.dmt.erp.fin.mapper.FinPayRequestMapper;
import com.dmt.erp.mdm.entity.MdmCustomer;
import com.dmt.erp.mdm.entity.MdmEntity;
import com.dmt.erp.mdm.mapper.MdmCustomerMapper;
import com.dmt.erp.mdm.mapper.MdmEntityMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/** 开票申请（抬头/税号自动带客户主数据）与付款申请 */
@Service
@RequiredArgsConstructor
public class InvoiceService {

    private final FinInvoiceAppMapper invoiceMapper;
    private final FinPayRequestMapper payRequestMapper;
    private final MdmCustomerMapper customerMapper;
    private final MdmEntityMapper entityMapper;

    // ---------- 开票申请 ----------

    public PageResult<FinInvoiceApp> invoicePage(String status, long pageNum, long pageSize) {
        Page<FinInvoiceApp> page = new Page<>(pageNum, Math.min(pageSize, 100));
        return PageResult.of(invoiceMapper.selectPage(page, new LambdaQueryWrapper<FinInvoiceApp>()
                .eq(status != null && !status.isBlank(), FinInvoiceApp::getStatus, status)
                .orderByDesc(FinInvoiceApp::getId)));
    }

    public Long createInvoice(FinInvoiceApp app) {
        if (app.getCustomerId() == null || app.getAmount() == null) {
            throw new BizException(ResultCode.PARAM_INVALID, "客户与金额必填");
        }
        MdmCustomer customer = customerMapper.selectById(app.getCustomerId());
        if (customer == null) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "客户不存在");
        }
        if (app.getEntityId() == null) {
            List<MdmEntity> entities = entityMapper.selectList(new LambdaQueryWrapper<MdmEntity>()
                    .eq(MdmEntity::getStatus, "启用").orderByAsc(MdmEntity::getId).last("LIMIT 1"));
            app.setEntityId(entities.isEmpty() ? null : entities.get(0).getId());
        }
        // 抬头/税号取客户主数据（专票必须维护税号）
        if (app.getTitle() == null || app.getTitle().isBlank()) {
            app.setTitle(customer.getInvoiceTitle() != null && !customer.getInvoiceTitle().isBlank()
                    ? customer.getInvoiceTitle() : customer.getName());
        }
        if (app.getTaxNo() == null || app.getTaxNo().isBlank()) {
            app.setTaxNo(customer.getTaxNo());
        }
        app.setAppNo(CodeGen.next(() -> {
            List<Object> objs = invoiceMapper.selectObjs(new LambdaQueryWrapper<FinInvoiceApp>()
                    .select(FinInvoiceApp::getAppNo).orderByDesc(FinInvoiceApp::getId).last("LIMIT 1"));
            return objs.isEmpty() ? null : (String) objs.get(0);
        }, "INVAPP-2026-"));
        app.setStatus("待开票");
        invoiceMapper.insert(app);
        return app.getId();
    }

    public void invoiceAction(Long id, String action) {
        FinInvoiceApp app = invoiceMapper.selectById(id);
        if (app == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "开票申请不存在");
        }
        if ("issue".equals(action) && "待开票".equals(app.getStatus())) {
            app.setStatus("已开票");
        } else if ("void".equals(action) && !"已作废".equals(app.getStatus())) {
            app.setStatus("已作废");
        } else {
            throw new BizException(ResultCode.STATE_CONFLICT, "当前状态不允许该操作");
        }
        invoiceMapper.updateById(app);
    }

    // ---------- 付款申请 ----------

    public PageResult<FinPayRequest> payPage(String status, long pageNum, long pageSize) {
        Page<FinPayRequest> page = new Page<>(pageNum, Math.min(pageSize, 100));
        return PageResult.of(payRequestMapper.selectPage(page, new LambdaQueryWrapper<FinPayRequest>()
                .eq(status != null && !status.isBlank(), FinPayRequest::getStatus, status)
                .orderByDesc(FinPayRequest::getId)));
    }

    public Long createPay(FinPayRequest req) {
        if (req.getPayee() == null || req.getPayee().isBlank() || req.getAmount() == null) {
            throw new BizException(ResultCode.PARAM_INVALID, "收款方与金额必填");
        }
        req.setReqNo(CodeGen.next(() -> {
            List<Object> objs = payRequestMapper.selectObjs(new LambdaQueryWrapper<FinPayRequest>()
                    .select(FinPayRequest::getReqNo).orderByDesc(FinPayRequest::getId).last("LIMIT 1"));
            return objs.isEmpty() ? null : (String) objs.get(0);
        }, "PAYREQ-2026-"));
        req.setStatus("待审批");
        payRequestMapper.insert(req);
        return req.getId();
    }

    public void payAction(Long id, String action) {
        FinPayRequest req = payRequestMapper.selectById(id);
        if (req == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "付款申请不存在");
        }
        if ("approve".equals(action) && "待审批".equals(req.getStatus())) {
            req.setStatus("已审批");
        } else if ("pay".equals(action) && "已审批".equals(req.getStatus())) {
            req.setStatus("已付款");
        } else {
            throw new BizException(ResultCode.STATE_CONFLICT, "当前状态不允许该操作");
        }
        payRequestMapper.updateById(req);
    }
}
