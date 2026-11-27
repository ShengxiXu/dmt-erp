package com.dmt.erp.prd.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.prd.entity.ResEquipment;
import com.dmt.erp.prd.mapper.ResEquipmentMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EquipmentService {

    private final ResEquipmentMapper equipmentMapper;

    public List<ResEquipment> list(String category, String kw) {
        return equipmentMapper.selectList(new LambdaQueryWrapper<ResEquipment>()
                .eq(StringUtils.hasText(category), ResEquipment::getCategory, category)
                .and(StringUtils.hasText(kw), x -> x.like(ResEquipment::getName, kw).or().like(ResEquipment::getSupplier, kw))
                .orderByAsc(ResEquipment::getId));
    }

    public Long create(ResEquipment equipment) {
        if (equipment.getStock() == null) {
            equipment.setStock(0);
        }
        if (equipment.getLocked() == null) {
            equipment.setLocked(0);
        }
        equipmentMapper.insert(equipment);
        return equipment.getId();
    }

    public void update(ResEquipment equipment) {
        ResEquipment exist = equipmentMapper.selectById(equipment.getId());
        if (exist == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "设备档案不存在");
        }
        equipmentMapper.updateById(equipment);
    }
}
