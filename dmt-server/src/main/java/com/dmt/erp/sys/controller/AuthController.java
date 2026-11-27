package com.dmt.erp.sys.controller;

import com.dmt.erp.common.R;
import com.dmt.erp.sys.dto.ChangePasswordReq;
import com.dmt.erp.sys.dto.LoginReq;
import com.dmt.erp.sys.dto.SmsCodeReq;
import com.dmt.erp.sys.dto.SmsLoginReq;
import com.dmt.erp.sys.service.AuthService;
import com.dmt.erp.sys.vo.LoginVo;
import com.dmt.erp.sys.vo.ProfileVo;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Validated
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public R<LoginVo> login(@Valid @RequestBody LoginReq req) {
        return R.ok(authService.login(req));
    }

    @PostMapping("/sms-code")
    public R<Map<String, String>> smsCode(@Valid @RequestBody SmsCodeReq req) {
        return R.ok(authService.sendSmsCode(req));
    }

    @PostMapping("/sms-login")
    public R<LoginVo> smsLogin(@Valid @RequestBody SmsLoginReq req) {
        return R.ok(authService.smsLogin(req));
    }

    @PostMapping("/logout")
    public R<Void> logout() {
        authService.logout();
        return R.ok();
    }

    @GetMapping("/profile")
    public R<ProfileVo> profile() {
        return R.ok(authService.profile());
    }

    @PutMapping("/password")
    public R<Void> changePassword(@Valid @RequestBody ChangePasswordReq req) {
        authService.changePassword(req);
        return R.ok();
    }
}
