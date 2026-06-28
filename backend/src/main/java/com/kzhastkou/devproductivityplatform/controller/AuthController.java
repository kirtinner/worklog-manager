package com.kzhastkou.devproductivityplatform.controller;

import com.kzhastkou.devproductivityplatform.dto.AuthResponse;
import com.kzhastkou.devproductivityplatform.dto.AuthUserResponse;
import com.kzhastkou.devproductivityplatform.dto.ChangePasswordRequest;
import com.kzhastkou.devproductivityplatform.dto.LoginRequest;
import com.kzhastkou.devproductivityplatform.dto.RegisterRequest;
import com.kzhastkou.devproductivityplatform.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService service;

    @PostMapping("/login")
    public AuthResponse login(@RequestBody LoginRequest request) {
        return service.login(request);
    }

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return service.register(request);
    }

    @GetMapping("/me")
    public AuthUserResponse me() {
        return service.getCurrentUser(resolveCurrentUserId());
    }

    @PostMapping("/change-password")
    public AuthUserResponse changePassword(@RequestBody ChangePasswordRequest request) {
        return service.changePassword(resolveCurrentUserId(), request);
    }

    private Long resolveCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        Object principal = authentication != null ? authentication.getPrincipal() : null;

        if (principal instanceof Long userId) {
            return userId;
        }

        throw new IllegalStateException("Unable to resolve current user");
    }
}
