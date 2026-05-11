package com.kzhastkou.devproductivityplatform.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @GetMapping("/me")
    public Map<String, Long> me() {
        Long userId = (Long) SecurityContextHolder.getContext()
                .getAuthentication()
                .getPrincipal();

        return Map.of("userId", userId);
    }
}
