package com.dmt.erp.sys.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.dmt.erp.common.BizException;
import com.dmt.erp.common.ResultCode;
import com.dmt.erp.security.JwtService;
import com.dmt.erp.security.LoginUser;
import com.dmt.erp.security.SecurityUtils;
import com.dmt.erp.sys.dto.ChangePasswordReq;
import com.dmt.erp.sys.dto.LoginReq;
import com.dmt.erp.sys.dto.SmsCodeReq;
import com.dmt.erp.sys.dto.SmsLoginReq;
import com.dmt.erp.sys.entity.SysMenu;
import com.dmt.erp.sys.entity.SysRole;
import com.dmt.erp.sys.entity.SysSmsCode;
import com.dmt.erp.sys.entity.SysUser;
import com.dmt.erp.sys.mapper.SysMenuMapper;
import com.dmt.erp.sys.mapper.SysRoleMapper;
import com.dmt.erp.sys.mapper.SysSmsCodeMapper;
import com.dmt.erp.sys.mapper.SysUserMapper;
import com.dmt.erp.sys.vo.LoginVo;
import com.dmt.erp.sys.vo.ProfileVo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final SysUserMapper userMapper;
    private final SysRoleMapper roleMapper;
    private final SysMenuMapper menuMapper;
    private final SysSmsCodeMapper smsCodeMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public LoginVo login(LoginReq req) {
        SysUser user = userMapper.selectOne(new LambdaQueryWrapper<SysUser>()
                .eq(SysUser::getUsername, req.getUsername()));
        if (user == null || !passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw new BizException(ResultCode.UNAUTHENTICATED, "用户名或密码错误");
        }
        return issue(user);
    }

    /** 发送登录验证码：6 位、10 分钟有效、单次作废；内网演示随响应回显（契约 §9） */
    public Map<String, String> sendSmsCode(SmsCodeReq req) {
        SysSmsCode latest = smsCodeMapper.selectOne(new LambdaQueryWrapper<SysSmsCode>()
                .eq(SysSmsCode::getMobile, req.getMobile())
                .eq(SysSmsCode::getScene, "LOGIN")
                .orderByDesc(SysSmsCode::getId)
                .last("LIMIT 1"));
        if (latest != null && latest.getCreatedAt().isAfter(LocalDateTime.now().minusSeconds(60))) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "发送过于频繁，请 60 秒后再试");
        }
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        SysSmsCode row = new SysSmsCode();
        row.setMobile(req.getMobile());
        row.setCode(code);
        row.setScene("LOGIN");
        row.setExpireAt(LocalDateTime.now().plusMinutes(10));
        row.setUsed(0);
        smsCodeMapper.insert(row);
        log.info("sms code issued: mobile={} code={}", req.getMobile(), code);
        return Map.of("demoCode", code);
    }

    public LoginVo smsLogin(SmsLoginReq req) {
        SysSmsCode row = smsCodeMapper.selectOne(new LambdaQueryWrapper<SysSmsCode>()
                .eq(SysSmsCode::getMobile, req.getMobile())
                .eq(SysSmsCode::getScene, "LOGIN")
                .orderByDesc(SysSmsCode::getId)
                .last("LIMIT 1"));
        if (row == null || row.getUsed() == 1
                || row.getExpireAt().isBefore(LocalDateTime.now())
                || !row.getCode().equals(req.getCode())) {
            throw new BizException(ResultCode.UNAUTHENTICATED, "验证码错误或已过期");
        }
        row.setUsed(1);
        smsCodeMapper.updateById(row);
        SysUser user = userMapper.selectOne(new LambdaQueryWrapper<SysUser>()
                .eq(SysUser::getMobile, req.getMobile()));
        if (user == null) {
            throw new BizException(ResultCode.UNAUTHENTICATED, "该手机号未绑定系统用户");
        }
        return issue(user);
    }

    public void logout() {
        // 无状态 JWT，退出依赖令牌过期（契约 6.1：令牌拉黑为可选项）
    }

    public ProfileVo profile() {
        LoginUser me = SecurityUtils.requireUser();
        SysUser user = userMapper.selectById(me.getUserId());
        List<SysRole> roles = roleMapper.selectByUserId(me.getUserId());
        List<SysMenu> menus = menuMapper.selectByUserId(me.getUserId());
        List<String> perms = menus.stream().map(SysMenu::getPermCode)
                .filter(Objects::nonNull).distinct().collect(Collectors.toList());
        Map<String, Object> info = new HashMap<>();
        info.put("id", user.getId());
        info.put("username", user.getUsername());
        info.put("name", user.getName());
        info.put("mobile", user.getMobile());
        info.put("deptId", user.getDeptId());
        info.put("status", user.getStatus());
        ProfileVo vo = new ProfileVo();
        vo.setUser(info);
        vo.setRoles(roles.stream().map(SysRole::getCode).collect(Collectors.toList()));
        vo.setPerms(perms);
        return vo;
    }

    public void changePassword(ChangePasswordReq req) {
        LoginUser me = SecurityUtils.requireUser();
        SysUser user = userMapper.selectById(me.getUserId());
        if (!passwordEncoder.matches(req.getOldPassword(), user.getPasswordHash())) {
            throw new BizException(ResultCode.BIZ_RULE_VIOLATION, "原密码错误");
        }
        user.setPasswordHash(passwordEncoder.encode(req.getNewPassword()));
        userMapper.updateById(user);
    }

    private LoginVo issue(SysUser user) {
        if (!"启用".equals(user.getStatus())) {
            throw new BizException(ResultCode.UNAUTHENTICATED, "账号已停用，请联系管理员");
        }
        List<SysRole> roles = roleMapper.selectByUserId(user.getId());
        String scope = roles.stream().anyMatch(r -> "ALL".equals(r.getDataScope())) ? "ALL"
                : roles.stream().anyMatch(r -> "DEPT".equals(r.getDataScope())) ? "DEPT" : "SELF";
        Map<String, Object> claims = new HashMap<>();
        if (user.getDeptId() != null) {
            claims.put("deptId", user.getDeptId());
        }
        claims.put("dataScope", scope);
        claims.put("roles", roles.stream().map(SysRole::getCode).collect(Collectors.toList()));
        String token = jwtService.issue(user.getId(), user.getUsername(), claims);
        Map<String, Object> info = new HashMap<>();
        info.put("id", user.getId());
        info.put("username", user.getUsername());
        info.put("name", user.getName());
        info.put("deptId", user.getDeptId());
        return new LoginVo(token, info);
    }
}
