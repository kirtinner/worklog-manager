package com.kzhastkou.devproductivityplatform.service;

import com.kzhastkou.devproductivityplatform.dto.ScheduledExportRunResponse;
import com.kzhastkou.devproductivityplatform.dto.FullDataExportSavedFile;
import com.kzhastkou.devproductivityplatform.dto.FolderValidationResponse;
import com.kzhastkou.devproductivityplatform.dto.UserSettingsRequest;
import com.kzhastkou.devproductivityplatform.dto.UserSettingsResponse;
import com.kzhastkou.devproductivityplatform.entity.Developer;
import com.kzhastkou.devproductivityplatform.entity.Organization;
import com.kzhastkou.devproductivityplatform.entity.UserSettings;
import com.kzhastkou.devproductivityplatform.exception.NotFoundException;
import com.kzhastkou.devproductivityplatform.repository.DeveloperRepository;
import com.kzhastkou.devproductivityplatform.repository.OrganizationRepository;
import com.kzhastkou.devproductivityplatform.repository.UserSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Service
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class UserSettingsService {

    private static final double DEFAULT_DAILY_HOURS_LIMIT = 8.0;
    private static final String DEFAULT_SCHEDULED_EXPORT_TIME = "02:00";
    private static final int DEFAULT_SCHEDULED_EXPORT_RETENTION_DAYS = 30;

    private final UserSettingsRepository userSettingsRepository;
    private final DeveloperRepository developerRepository;
    private final OrganizationRepository organizationRepository;
    private final FullDataExportService fullDataExportService;
    private final FolderValidationService folderValidationService;

    @Transactional
    public UserSettingsResponse getForUser(Long developerId) {
        return toResponse(getOrCreateSettings(resolveDeveloper(developerId)));
    }

    @Transactional
    public UserSettingsResponse updateForUser(Long developerId, UserSettingsRequest request) {
        Developer developer = resolveDeveloper(developerId);
        Organization organization = request.getCurrentOrganizationId() != null
                ? resolveOrganization(request.getCurrentOrganizationId(), developer.getId())
                : null;
        UserSettings settings = getOrCreateSettings(developer);
        validateSettingsFolders(request);

        settings.setCurrentOrganization(organization);
        settings.setDailyHoursLimit(request.getDailyHoursLimit());
        settings.setReportsSaveDirectory(request.getReportsSaveDirectory());
        settings.setScheduledExportEnabled(Boolean.TRUE.equals(request.getScheduledExportEnabled()));
        settings.setScheduledExportFolder(normalizeText(request.getScheduledExportFolder()));
        settings.setScheduledExportTime(normalizeScheduledExportTime(request.getScheduledExportTime()));
        settings.setScheduledExportRetentionDays(normalizeRetentionDays(request.getScheduledExportRetentionDays()));

        UserSettings savedSettings = userSettingsRepository.save(settings);
        log.info("Settings saved: developerId={}, scheduledExportEnabled={}", developerId, savedSettings.getScheduledExportEnabled());
        return toResponse(savedSettings);
    }

    @Transactional
    public UserSettingsResponse updateGeneralForUser(Long developerId, UserSettingsRequest request) {
        Developer developer = resolveDeveloper(developerId);
        Organization organization = request.getCurrentOrganizationId() != null
                ? resolveOrganization(request.getCurrentOrganizationId(), developer.getId())
                : null;
        UserSettings settings = getOrCreateSettings(developer);
        validateOptionalFolder("Reports Save Directory", request.getReportsSaveDirectory());

        settings.setCurrentOrganization(organization);
        settings.setDailyHoursLimit(request.getDailyHoursLimit());
        settings.setReportsSaveDirectory(normalizeText(request.getReportsSaveDirectory()));

        UserSettings savedSettings = userSettingsRepository.save(settings);
        log.info("General settings saved: developerId={}", developerId);
        return toResponse(savedSettings);
    }

    @Transactional
    public UserSettingsResponse updateScheduledExportForUser(Long developerId, UserSettingsRequest request) {
        UserSettings settings = getOrCreateSettings(resolveDeveloper(developerId));
        validateScheduledExportSettings(request);

        settings.setScheduledExportEnabled(Boolean.TRUE.equals(request.getScheduledExportEnabled()));
        settings.setScheduledExportFolder(normalizeText(request.getScheduledExportFolder()));
        settings.setScheduledExportTime(normalizeScheduledExportTime(request.getScheduledExportTime()));
        settings.setScheduledExportRetentionDays(normalizeRetentionDays(request.getScheduledExportRetentionDays()));

        UserSettings savedSettings = userSettingsRepository.save(settings);
        log.info("Scheduled export settings saved: developerId={}, scheduledExportEnabled={}", developerId, savedSettings.getScheduledExportEnabled());
        return toResponse(savedSettings);
    }

    @Transactional
    public ScheduledExportRunResponse runScheduledExportNow(Long developerId) {
        UserSettings settings = getOrCreateSettings(resolveDeveloper(developerId));
        log.info("Run Export Now executed: developerId={}", developerId);
        return executeScheduledExport(settings);
    }

    public FolderValidationResponse validateFolder(String folder) {
        return folderValidationService.validateFolder(folder);
    }

    @Transactional
    public void runDueScheduledExports(LocalDateTime now) {
        LocalTime currentMinute = now.toLocalTime().withSecond(0).withNano(0);
        LocalDate today = now.toLocalDate();

        for (UserSettings settings : userSettingsRepository.findByScheduledExportEnabledTrue()) {
            if (settings.getDeveloper() == null) {
                continue;
            }

            Long developerId = settings.getDeveloper().getId();
            String scheduledTime = normalizeScheduledExportTime(settings.getScheduledExportTime());
            LocalTime scheduledLocalTime;
            try {
                scheduledLocalTime = LocalTime.parse(scheduledTime);
            } catch (Exception error) {
                settings.setScheduledExportLastErrorMessage("Invalid scheduled export time.");
                userSettingsRepository.save(settings);
                log.error("Scheduled Full Data Export failed: developerId={}, error={}", developerId, "Invalid scheduled export time.");
                continue;
            }

            if (!currentMinute.equals(scheduledLocalTime)) {
                continue;
            }

            LocalDateTime lastRunAt = settings.getScheduledExportLastRunAt();
            if (lastRunAt != null && lastRunAt.toLocalDate().equals(today)) {
                continue;
            }

            log.info("Scheduled Full Data Export started: developerId={}", developerId);
            ScheduledExportRunResponse result = executeScheduledExport(settings);
            if (result.isSuccess()) {
                log.info("Scheduled Full Data Export finished: developerId={}, fileName={}", developerId, result.getFileName());
            } else {
                log.error("Scheduled Full Data Export failed: developerId={}, error={}", developerId, result.getMessage());
            }
        }
    }

    private UserSettings getOrCreateSettings(Developer developer) {
        return userSettingsRepository.findByDeveloperId(developer.getId())
                .orElseGet(() -> userSettingsRepository.save(UserSettings.builder()
                        .developer(developer)
                        .currentOrganization(resolveDefaultOrganization(developer))
                        .dailyHoursLimit(DEFAULT_DAILY_HOURS_LIMIT)
                        .reportsSaveDirectory("")
                        .scheduledExportEnabled(false)
                        .scheduledExportFolder("")
                        .scheduledExportTime(DEFAULT_SCHEDULED_EXPORT_TIME)
                        .scheduledExportRetentionDays(DEFAULT_SCHEDULED_EXPORT_RETENTION_DAYS)
                        .build()));
    }

    private ScheduledExportRunResponse executeScheduledExport(UserSettings settings) {
        LocalDateTime runStartedAt = LocalDateTime.now();
        settings.setScheduledExportLastRunAt(runStartedAt);
        userSettingsRepository.saveAndFlush(settings);

        try {
            String folder = normalizeText(settings.getScheduledExportFolder());
            if (folder.isBlank()) {
                throw new IllegalArgumentException("Export Folder is required.");
            }

            Long developerId = settings.getDeveloper().getId();
            FullDataExportSavedFile file = fullDataExportService.exportToFolder(developerId, folder);
            fullDataExportService.cleanupOldExports(folder, normalizeRetentionDays(settings.getScheduledExportRetentionDays()));

            settings.setScheduledExportLastSuccessAt(LocalDateTime.now());
            settings.setScheduledExportLastErrorMessage("");
            UserSettings savedSettings = userSettingsRepository.save(settings);
            log.info(
                    "Run Export Now verification completed: developerId={}, scheduled_export_folder={}, finalFullFilePath={}, sizeBytes={}",
                    developerId,
                    folder,
                    file.path(),
                    file.sizeBytes()
            );

            return ScheduledExportRunResponse.builder()
                    .success(true)
                    .message("Export completed successfully.")
                    .fileName(file.path().getFileName().toString())
                    .filePath(file.path().toString())
                    .fileSizeBytes(file.sizeBytes())
                    .settings(toResponse(savedSettings))
                    .build();
        } catch (Exception error) {
            String message = error.getMessage() == null || error.getMessage().isBlank()
                    ? "Scheduled Full Data Export failed."
                    : error.getMessage();
            settings.setScheduledExportLastErrorMessage(message);
            UserSettings savedSettings = userSettingsRepository.save(settings);

            return ScheduledExportRunResponse.builder()
                    .success(false)
                    .message(message)
                    .technicalDetails(error.getClass().getSimpleName() + ": " + message)
                    .settings(toResponse(savedSettings))
                    .build();
        }
    }

    private Developer resolveDeveloper(Long developerId) {
        return developerRepository.findById(developerId)
                .orElseThrow(() -> new NotFoundException("Developer not found"));
    }

    private Organization resolveOrganization(Long organizationId, Long developerId) {
        return organizationRepository.findByIdAndDeveloperId(organizationId, developerId)
                .orElseThrow(() -> new NotFoundException("Organization not found"));
    }

    private Organization resolveDefaultOrganization(Developer developer) {
        if (developer.getOrganization() != null
                && developer.getOrganization().getDeveloper() != null
                && developer.getOrganization().getDeveloper().getId().equals(developer.getId())) {
            return developer.getOrganization();
        }

        return organizationRepository.findByDeveloperIdOrderByIdAsc(developer.getId()).stream()
                .findFirst()
                .orElse(null);
    }

    private void validateSettingsFolders(UserSettingsRequest request) {
        validateOptionalFolder("Reports Save Directory", request.getReportsSaveDirectory());
        validateScheduledExportSettings(request);
    }

    private void validateScheduledExportSettings(UserSettingsRequest request) {
        String scheduledTime = normalizeScheduledExportTime(request.getScheduledExportTime());
        if (!scheduledTime.matches("^([01]\\d|2[0-3]):[0-5]\\d$")) {
            throw new IllegalArgumentException("Run Daily At must use HH:mm format.");
        }

        Integer retentionDays = request.getScheduledExportRetentionDays();
        if (retentionDays != null && retentionDays < 0) {
            throw new IllegalArgumentException("Retention Days must be 0 or greater.");
        }

        String exportFolder = normalizeText(request.getScheduledExportFolder());
        if (Boolean.TRUE.equals(request.getScheduledExportEnabled()) && exportFolder.isBlank()) {
            throw new IllegalArgumentException("Export Folder is required.");
        }

        validateOptionalFolder("Export Folder", exportFolder);
    }

    private void validateOptionalFolder(String fieldLabel, String folder) {
        String normalizedFolder = normalizeText(folder);
        if (normalizedFolder.isBlank()) {
            return;
        }

        try {
            folderValidationService.validateFolderOrThrow(normalizedFolder);
        } catch (Exception error) {
            String validationMessage = error.getMessage() == null || error.getMessage().isBlank()
                    ? "Folder validation failed."
                    : error.getMessage();
            if ("Path is not absolute.".equals(validationMessage)) {
                throw new IllegalArgumentException(fieldLabel + " must be an absolute path.", error);
            }
            throw new IllegalArgumentException(fieldLabel + " is not a valid writable folder. " + validationMessage, error);
        }
    }

    private UserSettingsResponse toResponse(UserSettings settings) {
        Organization currentOrganization = settings.getCurrentOrganization();

        return UserSettingsResponse.builder()
                .id(settings.getId())
                .developerId(settings.getDeveloper().getId())
                .currentOrganizationId(currentOrganization != null ? currentOrganization.getId() : null)
                .currentOrganizationName(currentOrganization != null ? currentOrganization.getShortName() : "")
                .dailyHoursLimit(settings.getDailyHoursLimit())
                .reportsSaveDirectory(settings.getReportsSaveDirectory())
                .scheduledExportEnabled(Boolean.TRUE.equals(settings.getScheduledExportEnabled()))
                .scheduledExportFolder(settings.getScheduledExportFolder() == null ? "" : settings.getScheduledExportFolder())
                .scheduledExportTime(normalizeScheduledExportTime(settings.getScheduledExportTime()))
                .scheduledExportRetentionDays(normalizeRetentionDays(settings.getScheduledExportRetentionDays()))
                .scheduledExportLastRunAt(settings.getScheduledExportLastRunAt())
                .scheduledExportLastSuccessAt(settings.getScheduledExportLastSuccessAt())
                .scheduledExportLastErrorMessage(settings.getScheduledExportLastErrorMessage() == null ? "" : settings.getScheduledExportLastErrorMessage())
                .build();
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalizeScheduledExportTime(String value) {
        String normalized = normalizeText(value);
        return normalized.isBlank() ? DEFAULT_SCHEDULED_EXPORT_TIME : normalized;
    }

    private int normalizeRetentionDays(Integer value) {
        return value == null || value < 0 ? DEFAULT_SCHEDULED_EXPORT_RETENTION_DAYS : value;
    }
}
