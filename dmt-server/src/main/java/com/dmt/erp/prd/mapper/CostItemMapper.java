package com.dmt.erp.prd.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.dmt.erp.prd.entity.CostItem;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface CostItemMapper extends BaseMapper<CostItem> {

    /** 编码序号：取物理最大 id+1（含逻辑删除行，唯一键仍被占用，必须绕过逻辑删除过滤） */
    @Select("SELECT COALESCE(MAX(id), 0) + 1 FROM cost_item")
    Long nextItemSeq();
}
