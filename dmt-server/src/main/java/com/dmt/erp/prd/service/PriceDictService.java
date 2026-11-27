package com.dmt.erp.prd.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.prd.entity.PrdPriceDict;
import com.dmt.erp.prd.mapper.PrdPriceDictMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PriceDictService {

    private final PrdPriceDictMapper priceDictMapper;

    public List<PrdPriceDict> list(String dictKey) {
        return priceDictMapper.selectList(new LambdaQueryWrapper<PrdPriceDict>()
                .eq(StringUtils.hasText(dictKey), PrdPriceDict::getDictKey, dictKey)
                .orderByAsc(PrdPriceDict::getId));
    }

    /** 当前生效值：取第一条启用记录（字典为空返回 null），供条目试算/核算填报取数 */
    public PrdPriceDict current(String dictKey) {
        return priceDictMapper.selectOne(new LambdaQueryWrapper<PrdPriceDict>()
                .eq(PrdPriceDict::getDictKey, dictKey)
                .eq(PrdPriceDict::getStatus, "启用")
                .orderByAsc(PrdPriceDict::getId)
                .last("LIMIT 1"));
    }

    public Long create(PrdPriceDict dict) {
        if (!StringUtils.hasText(dict.getStatus())) {
            dict.setStatus("启用");
        }
        priceDictMapper.insert(dict);
        return dict.getId();
    }

    public void update(PrdPriceDict dict) {
        PrdPriceDict exist = priceDictMapper.selectById(dict.getId());
        if (exist == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "字典记录不存在");
        }
        priceDictMapper.updateById(dict);
    }
}
