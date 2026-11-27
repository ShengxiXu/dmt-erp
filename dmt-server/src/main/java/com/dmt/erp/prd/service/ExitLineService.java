package com.dmt.erp.prd.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.prd.entity.ResExitLine;
import com.dmt.erp.prd.entity.ResExitLoad;
import com.dmt.erp.prd.mapper.ResExitLineMapper;
import com.dmt.erp.prd.mapper.ResExitLoadMapper;
import com.dmt.erp.security.LoginUser;
import com.dmt.erp.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ExitLineService {

    private final ResExitLineMapper exitMapper;
    private final ResExitLoadMapper loadMapper;
    private final com.dmt.erp.wo.mapper.ResAssignmentMapper assignmentMapper;

    public List<ResExitLine> list(String status, String kw) {
        List<ResExitLine> lines = exitMapper.selectList(new LambdaQueryWrapper<ResExitLine>()
                .eq(StringUtils.hasText(status), ResExitLine::getStatus, status)
                .and(StringUtils.hasText(kw), x -> x.like(ResExitLine::getCode, kw).or().like(ResExitLine::getName, kw))
                .orderByAsc(ResExitLine::getId));
        // ②层：已售带宽 = 资源分配（出口带宽）实时聚合
        for (ResExitLine line : lines) {
            java.math.BigDecimal sold = assignmentMapper.selectList(
                            new LambdaQueryWrapper<com.dmt.erp.wo.entity.ResAssignment>()
                                    .eq(com.dmt.erp.wo.entity.ResAssignment::getKind, "出口带宽")
                                    .eq(com.dmt.erp.wo.entity.ResAssignment::getRefId, line.getId()))
                    .stream().map(a -> a.getQty() == null ? java.math.BigDecimal.ZERO : java.math.BigDecimal.valueOf(a.getQty()))
                    .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
            line.setSoldM(sold);
        }
        return lines;
    }

    public Long create(ResExitLine line) {
        if (!StringUtils.hasText(line.getStatus())) {
            line.setStatus("启用");
        }
        try {
            exitMapper.insert(line);
        } catch (DuplicateKeyException e) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "出口编码已存在");
        }
        return line.getId();
    }

    public void update(ResExitLine line) {
        ResExitLine exist = exitMapper.selectById(line.getId());
        if (exist == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "出口线路不存在");
        }
        try {
            exitMapper.updateById(line);
        } catch (DuplicateKeyException e) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "出口编码已存在");
        }
    }

    public PageResult<ResExitLoad> loadRecords(Long exitId, long pageNum, long pageSize) {
        com.baomidou.mybatisplus.extension.plugins.pagination.Page<ResExitLoad> page =
                new com.baomidou.mybatisplus.extension.plugins.pagination.Page<>(pageNum, Math.min(pageSize, 100));
        return PageResult.of(loadMapper.selectPage(page, new LambdaQueryWrapper<ResExitLoad>()
                .eq(ResExitLoad::getExitId, exitId)
                .orderByDesc(ResExitLoad::getMeasuredAt)));
    }

    /** 负载人工实测录入：只增不改，系统不做流量预测 */
    public Long addLoadRecord(Long exitId, Integer usedM, LocalDateTime measuredAt) {
        ResExitLoad record = new ResExitLoad();
        record.setExitId(exitId);
        record.setUsedM(usedM);
        record.setMeasuredAt(measuredAt == null ? LocalDateTime.now() : measuredAt);
        LoginUser me = SecurityUtils.currentUser().orElse(null);
        record.setMeasuredBy(me == null ? null : me.getUserId());
        loadMapper.insert(record);
        return record.getId();
    }
}
