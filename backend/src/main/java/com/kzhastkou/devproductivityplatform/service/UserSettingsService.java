package com.kzhastkou.devproductivityplatform.service;

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

@Service
@RequiredArgsConstructor
public class UserSettingsService {

    private static final double DEFAULT_DAILY_HOURS_LIMIT = 8.0;

    private final UserSettingsRepository userSettingsRepository;
    private final DeveloperRepository developerRepository;
    private final OrganizationRepository organizationRepository;

    @Transactional
    public UserSettingsResponse getForUser(Long developerId) {
        return toResponse(getOrCreateSettings(resolveDeveloper(developerId)));
    }

    @Transactional
    public UserSettingsResponse updateForUser(Long developerId, UserSettingsRequest request) {
        Developer developer = resolveDeveloper(developerId);
        Organization organization = request.getCurrentOrganizationId() != null
                ? resolveOrganization(request.getCurrentOrganizationId())
                : null;
        UserSettings settings = getOrCreateSettings(developer);

        settings.setCurrentOrganization(organization);
        settings.setDailyHoursLimit(request.getDailyHoursLimit());
        settings.setReportsSaveDirectory(request.getReportsSaveDirectory());

        return toResponse(userSettingsRepository.save(settings));
    }

    private UserSettings getOrCreateSettings(Developer developer) {
        return userSettingsRepository.findByDeveloperId(developer.getId())
                .orElseGet(() -> userSettingsRepository.save(UserSettings.builder()
                        .developer(developer)
                        .currentOrganization(resolveDefaultOrganization(developer))
                        .dailyHoursLimit(DEFAULT_DAILY_HOURS_LIMIT)
                        .reportsSaveDirectory("")
                        .build()));
    }

    private Developer resolveDeveloper(Long developerId) {
        return developerRepository.findById(developerId)
                .orElseThrow(() -> new NotFoundException("Developer not found"));
    }

    private Organization resolveOrganization(Long organizationId) {
        return organizationRepository.findById(organizationId)
                .orElseThrow(() -> new NotFoundException("Organization not found"));
    }

    private Organization resolveDefaultOrganization(Developer developer) {
        if (developer.getOrganization() != null) {
            return developer.getOrganization();
        }

        return organizationRepository.findAll().stream()
                .findFirst()
                .orElse(null);
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
                .build();
    }
}
