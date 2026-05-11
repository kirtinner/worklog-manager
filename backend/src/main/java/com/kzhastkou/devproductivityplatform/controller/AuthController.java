package com.kzhastkou.devproductivityplatform.controller;

import com.kzhastkou.devproductivityplatform.dto.AuthResponse;
import com.kzhastkou.devproductivityplatform.dto.LoginRequest;
import com.kzhastkou.devproductivityplatform.service.AuthService;
import lombok.RequiredArgsConstructor;
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
}
