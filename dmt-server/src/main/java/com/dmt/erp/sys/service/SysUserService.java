package com.dmt.erp.sys.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.PageResult;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.sys.dto.ResetPasswordReq;
import com.dmt.erp.sys.dto.UserQuery;
import com.dmt.erp.sys.dto.UserSaveReq;
import com.dmt.erp.sys.entity.SysDept;
import com.dmt.erp.sys.entity.SysRole;
import com.dmt.erp.sys.entity.SysUser;
import com.dmt.erp.sys.entity.SysUserRole;
import com.dmt.erp.sys.mapper.SysDeptMapper;
import com.dmt.erp.sys.mapper.SysRoleMapper;
import com.dmt.erp.sys.mapper.SysUserMapper;
import com.dmt.erp.sys.mapper.SysUserRoleMapper;
import com.dmt.erp.sys.vo.UserVo;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SysUserService {

    private final SysUserMapper userMapper;
    private final SysUserRoleMapper userRoleMapper;
    private final SysRoleMapper roleMapper;
    private final SysDeptMapper deptMapper;
    private final PasswordEncoder passwordEncoder;

    public PageResult<UserVo> page(UserQuery q) {
        Page<SysUser> page = new Page<>(q.getPageNum(), Math.min(q.getPageSize(), 100));
        LambdaQueryWrapper<SysUser> wrapper = new LambdaQueryWrapper<SysUser>()
                .and(StringUtils.hasText(q.getKw()), x -> x.like(SysUser::getUsername, q.getKw())
                        .or().like(SysUser::getName, q.getKw()))
                .eq(q.getDeptId() != null, SysUser::getDeptId, q.getDeptId())
                .orderByDesc(SysUser::getId);
        Page<SysUser> result = userMapper.selectPage(page, wrapper);

        List<SysUser> records = result.getRecords();
        Map<Long, String> deptNames = new HashMap<>();
        if (!records.isEmpty()) {
            Set<Long> deptIds = records.stream().map(SysUser::getDeptId)
                    .filter(java.util.Objects::nonNull).collect(Collectors.toSet());
            if (!deptIds.isEmpty()) {
                deptMapper.selectBatchIds(deptIds).forEach(d -> deptNames.put(d.getId(), d.getName()));
            }
        }
        Map<Long, List<Long>> userRoleIds = new HashMap<>();
        Map<Long, String> roleNames = new HashMap<>();
        if (!records.isEmpty()) {
            List<Long> userIds = records.stream().map(SysUser::getId).collect(Collectors.toList());
            List<SysUserRole> links = userRoleMapper.selectList(new LambdaQueryWrapper<SysUserRole>()
                    .in(SysUserRole::getUserId, userIds));
            userRoleIds = links.stream().collect(Collectors.groupingBy(SysUserRole::getUserId,
                    Collectors.mapping(SysUserRole::getRoleId, Collectors.toList())));
            Set<Long> roleIds = links.stream().map(SysUserRole::getRoleId).collect(Collectors.toSet());
            if (!roleIds.isEmpty()) {
                roleMapper.selectBatchIds(roleIds).forEach(r -> roleNames.put(r.getId(), r.getName()));
            }
        }

        Map<Long, List<Long>> finalUserRoleIds = userRoleIds;
        Map<Long, String> finalRoleNames = roleNames;
        return PageResult.of(result.convert(u -> {
            UserVo vo = new UserVo();
            vo.setId(u.getId());
            vo.setUsername(u.getUsername());
            vo.setName(u.getName());
            vo.setMobile(u.getMobile());
            vo.setDeptId(u.getDeptId());
            vo.setDeptName(deptNames.get(u.getDeptId()));
            vo.setStatus(u.getStatus());
            vo.setRoleIds(finalUserRoleIds.getOrDefault(u.getId(), Collections.emptyList()));
            vo.setRoleNames(vo.getRoleIds().stream()
                    .map(id -> finalRoleNames.getOrDefault(id, ""))
                    .filter(StringUtils::hasText).collect(Collectors.toList()));
            return vo;
        }));
    }

    @Transactional
    public Long create(UserSaveReq req) {
        Long exists = userMapper.selectCount(new LambdaQueryWrapper<SysUser>()
                .eq(SysUser::getUsername, req.getUsername()));
        if (exists > 0) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "登录名已存在");
        }
        SysUser user = new SysUser();
        user.setUsername(req.getUsername());
        user.setName(req.getName());
        user.setMobile(req.getMobile());
        user.setDeptId(req.getDeptId());
        user.setStatus(StringUtils.hasText(req.getStatus()) ? req.getStatus() : "启用");
        String raw = StringUtils.hasText(req.getInitialPassword()) ? req.getInitialPassword() : "admin123";
        user.setPasswordHash(passwordEncoder.encode(raw));
        userMapper.insert(user);
        saveRoles(user.getId(), req.getRoleIds());
        return user.getId();
    }

    @Transactional
    public void update(UserSaveReq req) {
        SysUser user = userMapper.selectById(req.getId());
        if (user == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "用户不存在");
        }
        user.setName(req.getName());
        user.setMobile(req.getMobile());
        user.setDeptId(req.getDeptId());
        if (StringUtils.hasText(req.getStatus())) {
            user.setStatus(req.getStatus());
        }
        userMapper.updateById(user);
        saveRoles(user.getId(), req.getRoleIds());
    }

    public void resetPassword(Long id, ResetPasswordReq req) {
        SysUser user = userMapper.selectById(id);
        if (user == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "用户不存在");
        }
        user.setPasswordHash(passwordEncoder.encode(req.getPassword()));
        userMapper.updateById(user);
    }

    public void toggleStatus(Long id, String status) {
        SysUser user = userMapper.selectById(id);
        if (user == null) {
            throw new BizException(ResultCode.STATE_CONFLICT, "用户不存在");
        }
        user.setStatus(status);
        userMapper.updateById(user);
    }

    private void saveRoles(Long userId, List<Long> roleIds) {
        if (roleIds == null) {
            return;
        }
        userRoleMapper.delete(new LambdaQueryWrapper<SysUserRole>().eq(SysUserRole::getUserId, userId));
        if (roleIds.isEmpty()) {
            return;
        }
        Set<Long> valid = roleMapper.selectBatchIds(roleIds).stream()
                .map(SysRole::getId).collect(Collectors.toSet());
        List<SysUserRole> links = roleIds.stream().filter(valid::contains).distinct()
                .map(rid -> {
                    SysUserRole link = new SysUserRole();
                    link.setUserId(userId);
                    link.setRoleId(rid);
                    return link;
                }).collect(Collectors.toList());
        links.forEach(userRoleMapper::insert);
    }
}
