package com.dmt.erp.prd.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.prd.entity.ResIpSegment;
import com.dmt.erp.prd.mapper.ResIpSegmentMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
@RequiredArgsConstructor
public class IpSegmentService {

    private final ResIpSegmentMapper segmentMapper;

    public List<ResIpSegment> list(String status, Long exitId, String kw) {
        return segmentMapper.selectList(new LambdaQueryWrapper<ResIpSegment>()
                .eq(StringUtils.hasText(status), ResIpSegment::getStatus, status)
                .eq(exitId != null, ResIpSegment::getExitId, exitId)
                .like(StringUtils.hasText(kw), ResIpSegment::getSeg, kw)
                .orderByAsc(ResIpSegment::getId));
    }

    public Long create(ResIpSegment seg) {
        if (!StringUtils.hasText(seg.getStatus())) {
            seg.setStatus("可用");
        }
        try {
            segmentMapper.insert(seg);
        } catch (DuplicateKeyException e) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "IP 段已存在");
        }
        return seg.getId();
    }

    public void update(ResIpSegment seg) {
        ResIpSegment exist = segmentMapper.selectById(seg.getId());
        if (exist == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "IP 段不存在");
        }
        try {
            segmentMapper.updateById(seg);
        } catch (DuplicateKeyException e) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "IP 段已存在");
        }
    }
}
