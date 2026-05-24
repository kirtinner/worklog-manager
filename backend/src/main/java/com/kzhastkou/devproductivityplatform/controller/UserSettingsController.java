package com.kzhastkou.devproductivityplatform.controller;

import com.kzhastkou.devproductivityplatform.dto.UserSettingsRequest;
import com.kzhastkou.devproductivityplatform.dto.UserSettingsResponse;
import com.kzhastkou.devproductivityplatform.service.UserSettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/user-settings")
@RequiredArgsConstructor
@Slf4j
public class UserSettingsController {

    private final UserSettingsService userSettingsService;

    @GetMapping
    public UserSettingsResponse getSettings() {
        Long userId = resolveCurrentUserId();
        log.info("GET /api/user-settings resolved userId={}", userId);
        return userSettingsService.getForUser(userId);
    }

    @PutMapping
    public UserSettingsResponse updateSettings(@Valid @RequestBody UserSettingsRequest request) {
        Long userId = resolveCurrentUserId();
        log.info(
                "PUT /api/user-settings resolved userId={}, currentOrganizationId={}, dailyHoursLimit={}",
                userId,
                request.getCurrentOrganizationId(),
                request.getDailyHoursLimit()
        );
        return userSettingsService.updateForUser(userId, request);
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
