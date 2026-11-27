package com.dmt.erp.mdm.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.mdm.dto.CustomerQuery;
import com.dmt.erp.mdm.dto.CustomerSaveReq;
import com.dmt.erp.mdm.entity.MdmCustomer;
import com.dmt.erp.mdm.mapper.MdmCustomerMapper;
import com.dmt.erp.mdm.vo.CustomerVo;
import com.dmt.erp.security.DataScope;
import com.dmt.erp.security.LoginUser;
import com.dmt.erp.security.SecurityUtils;
import com.dmt.erp.sys.entity.SysUser;
import com.dmt.erp.sys.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CustomerService {

    private final MdmCustomerMapper customerMapper;
    private final SysUserMapper userMapper;

    @DataScope(ownerColumn = "sales_id", table = "mdm_customer")
    public PageResult<CustomerVo> page(CustomerQuery q) {
        Page<MdmCustomer> page = new Page<>(q.getPageNum(), Math.min(q.getPageSize(), 100));
        LambdaQueryWrapper<MdmCustomer> wrapper = new LambdaQueryWrapper<MdmCustomer>()
                .and(StringUtils.hasText(q.getKw()), x -> x.like(MdmCustomer::getName, q.getKw())
                        .or().like(MdmCustomer::getContact, q.getKw()))
                .eq(StringUtils.hasText(q.getLevel()), MdmCustomer::getLevel, q.getLevel())
                .eq(StringUtils.hasText(q.getStatus()), MdmCustomer::getStatus, q.getStatus())
                .orderByDesc(MdmCustomer::getId);
        Page<MdmCustomer> result = customerMapper.selectPage(page, wrapper);
        Map<Long, String> salesNames = new HashMap<>();
        if (!result.getRecords().isEmpty()) {
            List<Long> ids = result.getRecords().stream().map(MdmCustomer::getSalesId)
                    .filter(java.util.Objects::nonNull).distinct().collect(Collectors.toList());
            if (!ids.isEmpty()) {
                userMapper.selectBatchIds(ids).forEach(u -> salesNames.put(u.getId(), u.getName()));
            }
        }
        return PageResult.of(result.convert(c -> {
            CustomerVo vo = new CustomerVo();
            BeanUtils.copyProperties(c, vo);
            vo.setSalesName(salesNames.get(c.getSalesId()));
            return vo;
        }));
    }

    public CustomerVo detail(Long id) {
        MdmCustomer c = customerMapper.selectById(id);
        if (c == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "客户不存在");
        }
        CustomerVo vo = new CustomerVo();
        BeanUtils.copyProperties(c, vo);
        SysUser sales = c.getSalesId() == null ? null : userMapper.selectById(c.getSalesId());
        vo.setSalesName(sales == null ? null : sales.getName());
        return vo;
    }

    public Long create(CustomerSaveReq req) {
        MdmCustomer c = new MdmCustomer();
        BeanUtils.copyProperties(req, c);
        LoginUser me = SecurityUtils.currentUser().orElse(null);
        if (c.getSalesId() == null && me != null) {
            c.setSalesId(me.getUserId());
        }
        if (!StringUtils.hasText(c.getStatus())) {
            c.setStatus("正常");
        }
        customerMapper.insert(c);
        return c.getId();
    }

    public void update(CustomerSaveReq req) {
        MdmCustomer c = customerMapper.selectById(req.getId());
        if (c == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "客户不存在");
        }
        checkOwner(c.getSalesId());
        BeanUtils.copyProperties(req, c, "salesId");
        customerMapper.updateById(c);
    }

    private void checkOwner(Long salesId) {
        LoginUser me = SecurityUtils.currentUser().orElse(null);
        if (me == null || me.getDataScope() == LoginUser.DataScope.ALL) {
            return;
        }
        if (me.getDataScope() == LoginUser.DataScope.SELF
                && (salesId == null || !salesId.equals(me.getUserId()))) {
            throw new BizException(ResultCode.FORBIDDEN, "仅归属人可编辑该客户");
        }
    }
}
