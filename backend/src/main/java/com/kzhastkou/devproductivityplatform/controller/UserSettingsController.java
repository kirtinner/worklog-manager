package com.kzhastkou.devproductivityplatform.controller;

import com.kzhastkou.devproductivityplatform.dto.FolderValidationRequest;
import com.kzhastkou.devproductivityplatform.dto.FolderValidationResponse;
import com.kzhastkou.devproductivityplatform.dto.ScheduledExportRunResponse;
import com.kzhastkou.devproductivityplatform.dto.UserSettingsRequest;
import com.kzhastkou.devproductivityplatform.dto.UserSettingsResponse;
import com.kzhastkou.devproductivityplatform.service.UserSettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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

    @PutMapping("/general")
    public UserSettingsResponse updateGeneralSettings(@Valid @RequestBody UserSettingsRequest request) {
        Long userId = resolveCurrentUserId();
        log.info(
                "PUT /api/user-settings/general resolved userId={}, currentOrganizationId={}, dailyHoursLimit={}",
                userId,
                request.getCurrentOrganizationId(),
                request.getDailyHoursLimit()
        );
        return userSettingsService.updateGeneralForUser(userId, request);
    }

    @PutMapping("/scheduled-export")
    public UserSettingsResponse updateScheduledExportSettings(@RequestBody UserSettingsRequest request) {
        Long userId = resolveCurrentUserId();
        log.info(
                "PUT /api/user-settings/scheduled-export resolved userId={}, scheduledExportEnabled={}",
                userId,
                request.getScheduledExportEnabled()
        );
        return userSettingsService.updateScheduledExportForUser(userId, request);
    }

    @PostMapping("/scheduled-export/run-now")
    public ScheduledExportRunResponse runScheduledExportNow() {
        Long userId = resolveCurrentUserId();
        log.info("POST /api/user-settings/scheduled-export/run-now resolved userId={}", userId);
        return userSettingsService.runScheduledExportNow(userId);
    }

    @PostMapping("/folders/validate")
    public FolderValidationResponse validateFolder(@RequestBody FolderValidationRequest request) {
        Long userId = resolveCurrentUserId();
        log.info("POST /api/user-settings/folders/validate resolved userId={}", userId);
        return userSettingsService.validateFolder(request.getPath());
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
