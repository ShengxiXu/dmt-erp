package com.dmt.erp.prd.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.prd.dto.PoolSaveReq;
import com.dmt.erp.prd.entity.ResExitPool;
import com.dmt.erp.prd.entity.ResPoolExit;
import com.dmt.erp.prd.mapper.ResExitPoolMapper;
import com.dmt.erp.prd.mapper.ResPoolExitMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PoolService {

    private final ResExitPoolMapper poolMapper;
    private final ResPoolExitMapper memberMapper;

    public List<ResExitPool> list(String status, String kw) {
        return poolMapper.selectList(new LambdaQueryWrapper<ResExitPool>()
                .eq(StringUtils.hasText(status), ResExitPool::getStatus, status)
                .and(StringUtils.hasText(kw), x -> x.like(ResExitPool::getCode, kw).or().like(ResExitPool::getName, kw))
                .orderByAsc(ResExitPool::getId));
    }

    public List<ResPoolExit> members(Long poolId) {
        return memberMapper.selectList(new LambdaQueryWrapper<ResPoolExit>()
                .eq(ResPoolExit::getPoolId, poolId));
    }

    @Transactional
    public Long create(PoolSaveReq req) {
        ResExitPool p = toPool(req);
        try {
            poolMapper.insert(p);
        } catch (DuplicateKeyException e) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "池编码已存在");
        }
        saveMembers(p.getId(), req);
        return p.getId();
    }

    @Transactional
    public void update(PoolSaveReq req) {
        ResExitPool p = poolMapper.selectById(req.getId());
        if (p == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "出口池不存在");
        }
        ResExitPool patch = toPool(req);
        patch.setId(p.getId());
        patch.setUsedM(p.getUsedM());
        try {
            poolMapper.updateById(patch);
        } catch (DuplicateKeyException e) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "池编码已存在");
        }
        saveMembers(p.getId(), req);
    }

    private ResExitPool toPool(PoolSaveReq req) {
        ResExitPool p = new ResExitPool();
        p.setCode(req.getCode());
        p.setName(req.getName());
        p.setProduct(req.getProduct());
        p.setCapacityM(req.getCapacityM() == null ? 0 : req.getCapacityM());
        p.setUsedM(req.getUsedM() == null ? 0 : req.getUsedM());
        p.setRentMonth(req.getRentMonth());
        p.setStatus(StringUtils.hasText(req.getStatus()) ? req.getStatus() : "启用");
        return p;
    }

    private void saveMembers(Long poolId, PoolSaveReq req) {
        if (req.getMembers() == null) {
            return;
        }
        memberMapper.delete(new LambdaQueryWrapper<ResPoolExit>().eq(ResPoolExit::getPoolId, poolId));
        List<ResPoolExit> members = req.getMembers().stream()
                .filter(m -> m.getExitId() != null)
                .map(m -> {
                    ResPoolExit row = new ResPoolExit();
                    row.setPoolId(poolId);
                    row.setExitId(m.getExitId());
                    row.setWeight(m.getWeight() == null ? 1 : m.getWeight());
                    return row;
                }).collect(Collectors.toList());
        members.forEach(memberMapper::insert);
    }
}
