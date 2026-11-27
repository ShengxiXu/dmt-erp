package com.dmt.erp.prd.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.prd.entity.ResBaseLine;
import com.dmt.erp.prd.mapper.ResBaseLineMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BaseLineService {

    private final ResBaseLineMapper baseLineMapper;

    public List<ResBaseLine> list(String status, String kw) {
        return baseLineMapper.selectList(new LambdaQueryWrapper<ResBaseLine>()
                .eq(StringUtils.hasText(status), ResBaseLine::getStatus, status)
                .and(StringUtils.hasText(kw), q -> q.like(ResBaseLine::getName, kw).or().like(ResBaseLine::getCode, kw))
                .orderByAsc(ResBaseLine::getId));
    }

    public Long create(ResBaseLine line) {
        if (!StringUtils.hasText(line.getCode()) || !StringUtils.hasText(line.getName())) {
            throw new BizException(ResultCode.PARAM_INVALID, "线路编码与名称必填");
        }
        if (!StringUtils.hasText(line.getStatus())) {
            line.setStatus("生效");
        }
        try {
            baseLineMapper.insert(line);
        } catch (DuplicateKeyException e) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "线路编码已存在");
        }
        return line.getId();
    }

    public void update(ResBaseLine line) {
        ResBaseLine exist = baseLineMapper.selectById(line.getId());
        if (exist == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "基础线路不存在");
        }
        try {
            baseLineMapper.updateById(line);
        } catch (DuplicateKeyException e) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "线路编码已存在");
        }
    }
}
