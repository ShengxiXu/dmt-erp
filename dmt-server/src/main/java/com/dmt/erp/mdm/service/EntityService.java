package com.dmt.erp.mdm.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.mdm.dto.EntitySaveReq;
import com.dmt.erp.mdm.entity.MdmEntity;
import com.dmt.erp.mdm.entity.MdmEntitySeal;
import com.dmt.erp.mdm.mapper.MdmContractMapper;
import com.dmt.erp.mdm.mapper.MdmEntityMapper;
import com.dmt.erp.mdm.mapper.MdmEntitySealMapper;
import com.dmt.erp.mdm.vo.EntityVo;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EntityService {

    private final MdmEntityMapper entityMapper;
    private final MdmEntitySealMapper sealMapper;
    private final MdmContractMapper contractMapper;

    public List<EntityVo> list() {
        List<MdmEntity> entities = entityMapper.selectList(new LambdaQueryWrapper<MdmEntity>()
                .orderByAsc(MdmEntity::getId));
        return entities.stream().map(e -> {
            EntityVo vo = new EntityVo();
            BeanUtils.copyProperties(e, vo);
            vo.setSeals(sealMapper.selectList(new LambdaQueryWrapper<MdmEntitySeal>()
                    .eq(MdmEntitySeal::getEntityId, e.getId())));
            return vo;
        }).collect(Collectors.toList());
    }

    public EntityVo detail(Long id) {
        MdmEntity e = entityMapper.selectById(id);
        if (e == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "主体不存在");
        }
        EntityVo vo = new EntityVo();
        BeanUtils.copyProperties(e, vo);
        vo.setSeals(sealMapper.selectList(new LambdaQueryWrapper<MdmEntitySeal>()
                .eq(MdmEntitySeal::getEntityId, id)));
        return vo;
    }

    @Transactional
    public Long create(EntitySaveReq req) {
        MdmEntity e = new MdmEntity();
        BeanUtils.copyProperties(req, e);
        if (!StringUtils.hasText(e.getStatus())) {
            e.setStatus("启用");
        }
        entityMapper.insert(e);
        saveSeals(e.getId(), req);
        return e.getId();
    }

    @Transactional
    public void update(EntitySaveReq req) {
        MdmEntity e = entityMapper.selectById(req.getId());
        if (e == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "主体不存在");
        }
        BeanUtils.copyProperties(req, e);
        entityMapper.updateById(e);
        saveSeals(e.getId(), req);
    }

    public void delete(Long id) {
        Long contracts = contractMapper.selectCount(new LambdaQueryWrapper<com.dmt.erp.mdm.entity.MdmContract>()
                .eq(com.dmt.erp.mdm.entity.MdmContract::getEntityId, id));
        if (contracts > 0) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "主体已被合同引用，只能停用");
        }
        entityMapper.deleteById(id);
        sealMapper.delete(new LambdaQueryWrapper<MdmEntitySeal>().eq(MdmEntitySeal::getEntityId, id));
    }

    private void saveSeals(Long entityId, EntitySaveReq req) {
        sealMapper.delete(new LambdaQueryWrapper<MdmEntitySeal>().eq(MdmEntitySeal::getEntityId, entityId));
        if (req.getSeals() == null) {
            return;
        }
        req.getSeals().stream().filter(s -> StringUtils.hasText(s.getName())).forEach(s -> {
            MdmEntitySeal seal = new MdmEntitySeal();
            seal.setEntityId(entityId);
            seal.setName(s.getName());
            seal.setType(s.getType());
            seal.setSealNo(s.getSealNo());
            sealMapper.insert(seal);
        });
    }
}
