package com.dmt.erp.mdm.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.CodeGen;
import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.mdm.dto.OpportunityQuery;
import com.dmt.erp.mdm.dto.OpportunitySaveReq;
import com.dmt.erp.mdm.entity.MdmContract;
import com.dmt.erp.mdm.entity.MdmCustomer;
import com.dmt.erp.mdm.entity.MdmOpportunity;
import com.dmt.erp.mdm.entity.MdmSpecial;
import com.dmt.erp.mdm.mapper.MdmContractMapper;
import com.dmt.erp.mdm.mapper.MdmCustomerMapper;
import com.dmt.erp.mdm.mapper.MdmOpportunityMapper;
import com.dmt.erp.mdm.mapper.MdmSpecialMapper;
import com.dmt.erp.mdm.vo.OpportunityVo;
import com.dmt.erp.security.DataScope;
import com.dmt.erp.security.LoginUser;
import com.dmt.erp.security.SecurityUtils;
import com.dmt.erp.sys.entity.SysUser;
import com.dmt.erp.sys.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OpportunityService {

    public static final Set<String> IN_FLIGHT_CONTRACT = Set.of("审批中", "待出合同", "待用章", "签署中", "待修订");

    private final MdmOpportunityMapper opportunityMapper;
    private final MdmCustomerMapper customerMapper;
    private final MdmContractMapper contractMapper;
    private final MdmSpecialMapper specialMapper;
    private final SysUserMapper userMapper;

    @DataScope(ownerColumn = "sales_id", table = "mdm_opportunity")
    public PageResult<OpportunityVo> page(OpportunityQuery q) {
        Page<MdmOpportunity> page = new Page<>(q.getPageNum(), Math.min(q.getPageSize(), 100));
        LambdaQueryWrapper<MdmOpportunity> wrapper = new LambdaQueryWrapper<MdmOpportunity>()
                .and(StringUtils.hasText(q.getKw()), x -> x.like(MdmOpportunity::getName, q.getKw())
                        .or().like(MdmOpportunity::getCode, q.getKw()))
                .eq(StringUtils.hasText(q.getStage()), MdmOpportunity::getStage, q.getStage())
                .eq(q.getCustomerId() != null, MdmOpportunity::getCustomerId, q.getCustomerId())
                .orderByDesc(MdmOpportunity::getId);
        Page<MdmOpportunity> result = opportunityMapper.selectPage(page, wrapper);
        Map<Long, String> customerNames = new HashMap<>();
        Map<Long, String> salesNames = new HashMap<>();
        List<Long> custIds = result.getRecords().stream().map(MdmOpportunity::getCustomerId)
                .filter(java.util.Objects::nonNull).distinct().collect(Collectors.toList());
        List<Long> salesIds = result.getRecords().stream().map(MdmOpportunity::getSalesId)
                .filter(java.util.Objects::nonNull).distinct().collect(Collectors.toList());
        if (!custIds.isEmpty()) {
            customerMapper.selectBatchIds(custIds).forEach(c -> customerNames.put(c.getId(), c.getName()));
        }
        if (!salesIds.isEmpty()) {
            userMapper.selectBatchIds(salesIds).forEach(u -> salesNames.put(u.getId(), u.getName()));
        }
        return PageResult.of(result.convert(o -> toVo(o, customerNames, salesNames)));
    }

    private OpportunityVo toVo(MdmOpportunity o, Map<Long, String> customerNames, Map<Long, String> salesNames) {
        OpportunityVo vo = new OpportunityVo();
        BeanUtils.copyProperties(o, vo);
        vo.setCustomerName(customerNames.get(o.getCustomerId()));
        vo.setSalesName(salesNames.get(o.getSalesId()));
        vo.setProducts(parseProducts(o.getProductsJson()));
        return vo;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseProducts(String json) {
        if (!StringUtils.hasText(json)) {
            return List.of();
        }
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().readValue(json, List.class);
        } catch (Exception e) {
            return List.of();
        }
    }

    private String writeProducts(List<OpportunitySaveReq.ProductReq> products) {
        if (products == null) {
            return null;
        }
        List<Map<String, Object>> list = products.stream()
                .filter(p -> StringUtils.hasText(p.getPtype()))
                .map(p -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("cat", p.getCat());
                    m.put("ptype", p.getPtype());
                    return m;
                }).collect(Collectors.toList());
        if (list.isEmpty()) {
            return null;
        }
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(list);
        } catch (Exception e) {
            return null;
        }
    }

    public Long create(OpportunitySaveReq req) {
        MdmCustomer customer = customerMapper.selectById(req.getCustomerId());
        if (customer == null) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "客户不存在");
        }
        MdmOpportunity o = new MdmOpportunity();
        BeanUtils.copyProperties(req, o);
        o.setProductsJson(writeProducts(req.getProducts()));
        LoginUser me = SecurityUtils.currentUser().orElse(null);
        o.setSalesId(me == null ? customer.getSalesId() : me.getUserId());
        o.setStage("跟进中");
        String prefix = "OPP-" + LocalDate.now().getYear() + "-";
        o.setCode(CodeGen.next(() -> {
            List<Object> objs = opportunityMapper.selectObjs(new LambdaQueryWrapper<MdmOpportunity>()
                    .select(MdmOpportunity::getCode).orderByDesc(MdmOpportunity::getId).last("LIMIT 1"));
            return objs.isEmpty() ? null : (String) objs.get(0);
        }, prefix));
        opportunityMapper.insert(o);
        return o.getId();
    }

    public OpportunityVo detail(Long id) {
        MdmOpportunity o = opportunityMapper.selectById(id);
        if (o == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "商机不存在");
        }
        Map<Long, String> customerNames = new HashMap<>();
        Map<Long, String> salesNames = new HashMap<>();
        if (o.getCustomerId() != null) {
            MdmCustomer c = customerMapper.selectById(o.getCustomerId());
            customerNames.put(o.getCustomerId(), c == null ? null : c.getName());
        }
        if (o.getSalesId() != null) {
            SysUser u = userMapper.selectById(o.getSalesId());
            salesNames.put(o.getSalesId(), u == null ? null : u.getName());
        }
        return toVo(o, customerNames, salesNames);
    }

    public void update(OpportunitySaveReq req) {        MdmOpportunity o = opportunityMapper.selectById(req.getId());
        if (o == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "商机不存在");
        }
        BeanUtils.copyProperties(req, o, "salesId", "stage", "code", "products");
        o.setProductsJson(writeProducts(req.getProducts()));
        opportunityMapper.updateById(o);
    }

    public void changeStage(Long id, String stage) {
        MdmOpportunity o = opportunityMapper.selectById(id);
        if (o == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "商机不存在");
        }
        if ("输单".equals(stage)) {
            Long inFlight = contractMapper.selectCount(new LambdaQueryWrapper<MdmContract>()
                    .eq(MdmContract::getOpportunityId, id).in(MdmContract::getStatus, IN_FLIGHT_CONTRACT));
            Long inFlightSpecial = specialMapper.selectCount(new LambdaQueryWrapper<MdmSpecial>()
                    .eq(MdmSpecial::getOpportunityId, id).eq(MdmSpecial::getStatus, "审批中"));
            if (inFlight > 0 || inFlightSpecial > 0) {
                throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "该商机存在在途合同/特批，不能输单");
            }
        }
        o.setStage(stage);
        opportunityMapper.updateById(o);
    }
}
