package com.dmt.erp.mdm.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.dmt.erp.approval.service.ApprovalEngineService;
import com.dmt.erp.approval.service.WritebackRegistry;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.CodeGen;
import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.mdm.dto.SpecialSaveReq;
import com.dmt.erp.mdm.entity.MdmContract;
import com.dmt.erp.mdm.entity.MdmCustomer;
import com.dmt.erp.mdm.entity.MdmOpportunity;
import com.dmt.erp.mdm.entity.MdmSpecial;
import com.dmt.erp.mdm.mapper.MdmContractMapper;
import com.dmt.erp.mdm.mapper.MdmCustomerMapper;
import com.dmt.erp.mdm.mapper.MdmOpportunityMapper;
import com.dmt.erp.mdm.mapper.MdmSpecialMapper;
import com.dmt.erp.mdm.vo.SpecialVo;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SpecialService {

    private final MdmSpecialMapper specialMapper;
    private final MdmOpportunityMapper opportunityMapper;
    private final MdmCustomerMapper customerMapper;
    private final MdmContractMapper contractMapper;
    private final ApprovalEngineService approvalEngine;
    private final WritebackRegistry writebackRegistry;

    @PostConstruct
    void registerWriteback() {
        writebackRegistry.register("特批申请单",
                this::onApproval,
                specialId -> {
                    Map<String, Object> form = new HashMap<>();
                    MdmSpecial sp = specialMapper.selectById(specialId);
                    if (sp != null) {
                        form.put("discount", sp.getDiscount());
                        form.put("amount", sp.getExpectAmount());
                    }
                    return form;
                },
                id -> {
                    MdmSpecial sp = specialMapper.selectById(id);
                    return sp == null ? String.valueOf(id) : sp.getCode();
                });
    }

    /** 审批写回：特批通过 → 合同可引用；驳回 → 可重新发起 */
    public void onApproval(Long specialId, boolean pass) {
        MdmSpecial sp = specialMapper.selectById(specialId);
        if (sp == null) {
            return;
        }
        sp.setStatus(pass ? "已通过" : "已驳回");
        specialMapper.updateById(sp);
    }

    public PageResult<SpecialVo> page(long pageNum, long pageSize, String status, Long opportunityId) {
        Page<MdmSpecial> page = new Page<>(pageNum, Math.min(pageSize, 100));
        LambdaQueryWrapper<MdmSpecial> wrapper = new LambdaQueryWrapper<MdmSpecial>()
                .eq(org.springframework.util.StringUtils.hasText(status), MdmSpecial::getStatus, status)
                .eq(opportunityId != null, MdmSpecial::getOpportunityId, opportunityId)
                .orderByDesc(MdmSpecial::getId);
        Page<MdmSpecial> result = specialMapper.selectPage(page, wrapper);
        Map<Long, String> oppNames = new HashMap<>();
        Map<Long, String> custNames = new HashMap<>();
        List<Long> oppIds = result.getRecords().stream().map(MdmSpecial::getOpportunityId).filter(Objects::nonNull).distinct().collect(Collectors.toList());
        List<Long> custIds = result.getRecords().stream().map(MdmSpecial::getCustomerId).filter(Objects::nonNull).distinct().collect(Collectors.toList());
        if (!oppIds.isEmpty()) opportunityMapper.selectBatchIds(oppIds).forEach(o -> oppNames.put(o.getId(), o.getName()));
        if (!custIds.isEmpty()) customerMapper.selectBatchIds(custIds).forEach(c -> custNames.put(c.getId(), c.getName()));
        return PageResult.of(result.convert(s -> {
            SpecialVo vo = new SpecialVo();
            BeanUtils.copyProperties(s, vo);
            vo.setOpportunityName(oppNames.get(s.getOpportunityId()));
            vo.setCustomerName(custNames.get(s.getCustomerId()));
            return vo;
        }));
    }

    public SpecialVo detail(Long id) {
        MdmSpecial s = specialMapper.selectById(id);
        if (s == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "特批申请不存在");
        }
        SpecialVo vo = new SpecialVo();
        BeanUtils.copyProperties(s, vo);
        MdmOpportunity opp = opportunityMapper.selectById(s.getOpportunityId());
        vo.setOpportunityName(opp == null ? null : opp.getName());
        MdmCustomer customer = customerMapper.selectById(s.getCustomerId());
        vo.setCustomerName(customer == null ? null : customer.getName());
        return vo;
    }

    /** 发起特批：必须挂商机，同商机在途唯一（应用层预检 + 生成列唯一索引兜底） */
    public Long create(SpecialSaveReq req) {
        Long inFlight = specialMapper.selectCount(new LambdaQueryWrapper<MdmSpecial>()
                .eq(MdmSpecial::getOpportunityId, req.getOpportunityId())
                .eq(MdmSpecial::getStatus, "审批中"));
        if (inFlight > 0) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "该商机已有在途特批申请");
        }
        MdmSpecial s = new MdmSpecial();
        BeanUtils.copyProperties(req, s);
        s.setStatus("审批中");
        String prefix = "SP-" + LocalDate.now().getYear() + "-";
        s.setCode(CodeGen.next(() -> {
            List<Object> objs = specialMapper.selectObjs(new LambdaQueryWrapper<MdmSpecial>()
                    .select(MdmSpecial::getCode).orderByDesc(MdmSpecial::getId).last("LIMIT 1"));
            return objs.isEmpty() ? null : (String) objs.get(0);
        }, prefix));
        try {
            specialMapper.insert(s);
        } catch (DuplicateKeyException e) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "该商机已有在途特批申请");
        }
        Map<String, Object> form = new HashMap<>();
        form.put("discount", s.getDiscount());
        form.put("amount", s.getExpectAmount());
        approvalEngine.submit("特批申请单", "提交", s.getId(), form);
        return s.getId();
    }
}
