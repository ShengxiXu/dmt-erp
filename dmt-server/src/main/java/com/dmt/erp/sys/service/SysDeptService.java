package com.dmt.erp.sys.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.sys.dto.DeptSaveReq;
import com.dmt.erp.sys.entity.SysDept;
import com.dmt.erp.sys.entity.SysUser;
import com.dmt.erp.sys.mapper.SysDeptMapper;
import com.dmt.erp.sys.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SysDeptService {

    private final SysDeptMapper deptMapper;
    private final SysUserMapper userMapper;

    public List<SysDept> list() {
        return deptMapper.selectList(new LambdaQueryWrapper<SysDept>().orderByAsc(SysDept::getId));
    }

    public Long create(DeptSaveReq req) {
        SysDept dept = new SysDept();
        dept.setName(req.getName());
        dept.setParentId(req.getParentId());
        deptMapper.insert(dept);
        return dept.getId();
    }

    public void update(DeptSaveReq req) {
        SysDept dept = deptMapper.selectById(req.getId());
        if (dept == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "部门不存在");
        }
        dept.setName(req.getName());
        dept.setParentId(req.getParentId());
        deptMapper.updateById(dept);
    }

    public void delete(Long id) {
        Long children = deptMapper.selectCount(new LambdaQueryWrapper<SysDept>()
                .eq(SysDept::getParentId, id));
        if (children > 0) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "存在下级部门，不能删除");
        }
        Long users = userMapper.selectCount(new LambdaQueryWrapper<SysUser>()
                .eq(SysUser::getDeptId, id));
        if (users > 0) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "部门下存在用户，不能删除");
        }
        deptMapper.deleteById(id);
    }
}
