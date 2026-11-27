package com.dmt.erp.sys.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.sys.dto.RoleSaveReq;
import com.dmt.erp.sys.entity.SysRole;
import com.dmt.erp.sys.entity.SysRoleMenu;
import com.dmt.erp.sys.mapper.SysRoleMapper;
import com.dmt.erp.sys.mapper.SysRoleMenuMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SysRoleService {

    private final SysRoleMapper roleMapper;
    private final SysRoleMenuMapper roleMenuMapper;

    public List<SysRole> list() {
        return roleMapper.selectList(new LambdaQueryWrapper<SysRole>().orderByAsc(SysRole::getId));
    }

    public List<Long> menuIds(Long roleId) {
        return roleMenuMapper.selectList(new LambdaQueryWrapper<SysRoleMenu>()
                        .eq(SysRoleMenu::getRoleId, roleId))
                .stream().map(SysRoleMenu::getMenuId).collect(Collectors.toList());
    }

    @Transactional
    public Long create(RoleSaveReq req) {
        Long exists = roleMapper.selectCount(new LambdaQueryWrapper<SysRole>()
                .eq(SysRole::getCode, req.getCode()));
        if (exists > 0) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "角色编码已存在");
        }
        SysRole role = new SysRole();
        role.setCode(req.getCode());
        role.setName(req.getName());
        role.setDataScope(req.getDataScope());
        roleMapper.insert(role);
        saveMenus(role.getId(), req.getMenuIds());
        return role.getId();
    }

    @Transactional
    public void update(RoleSaveReq req) {
        SysRole role = roleMapper.selectById(req.getId());
        if (role == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "角色不存在");
        }
        role.setName(req.getName());
        role.setDataScope(req.getDataScope());
        roleMapper.updateById(role);
        saveMenus(role.getId(), req.getMenuIds());
    }

    public void delete(Long id) {
        roleMapper.deleteById(id);
        roleMenuMapper.delete(new LambdaQueryWrapper<SysRoleMenu>().eq(SysRoleMenu::getRoleId, id));
    }

    private void saveMenus(Long roleId, List<Long> menuIds) {
        if (menuIds == null) {
            return;
        }
        roleMenuMapper.delete(new LambdaQueryWrapper<SysRoleMenu>().eq(SysRoleMenu::getRoleId, roleId));
        if (menuIds.isEmpty()) {
            return;
        }
        List<SysRoleMenu> links = menuIds.stream().distinct().map(mid -> {
            SysRoleMenu link = new SysRoleMenu();
            link.setRoleId(roleId);
            link.setMenuId(mid);
            return link;
        }).collect(Collectors.toList());
        links.forEach(roleMenuMapper::insert);
    }
}
