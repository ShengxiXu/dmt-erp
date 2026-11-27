package com.dmt.erp.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

public final class SecurityUtils {

    private SecurityUtils() {
    }

    public static Optional<LoginUser> currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof LoginUser loginUser) {
            return Optional.of(loginUser);
        }
        return Optional.empty();
    }

    public static LoginUser requireUser() {
        return currentUser().orElseThrow(() -> new IllegalStateException("no authenticated user"));
    }
}
