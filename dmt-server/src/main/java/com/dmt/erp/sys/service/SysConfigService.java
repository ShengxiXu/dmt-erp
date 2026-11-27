package com.dmt.erp.sys.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.sys.entity.SysConfig;
import com.dmt.erp.sys.mapper.SysConfigMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SysConfigService {

    private final SysConfigMapper configMapper;

    public List<SysConfig> list() {
        return configMapper.selectList(new LambdaQueryWrapper<SysConfig>().orderByAsc(SysConfig::getId));
    }

    public void upsert(String key, String value, String remark) {
        if (!StringUtils.hasText(key)) {
            throw new BizException(ResultCode.PARAM_INVALID, "cfgKey 不能为空");
        }
        SysConfig cfg = configMapper.selectOne(new LambdaQueryWrapper<SysConfig>()
                .eq(SysConfig::getCfgKey, key));
        if (cfg == null) {
            cfg = new SysConfig();
            cfg.setCfgKey(key);
            cfg.setCfgValue(value);
            cfg.setRemark(remark);
            configMapper.insert(cfg);
        } else {
            cfg.setCfgValue(value);
            if (StringUtils.hasText(remark)) {
                cfg.setRemark(remark);
            }
            configMapper.updateById(cfg);
        }
    }
}
