package com.kzhastkou.devproductivityplatform.service;

import com.kzhastkou.devproductivityplatform.dto.AuthResponse;
import com.kzhastkou.devproductivityplatform.dto.AuthUserResponse;
import com.kzhastkou.devproductivityplatform.dto.ChangePasswordRequest;
import com.kzhastkou.devproductivityplatform.dto.LoginRequest;
import com.kzhastkou.devproductivityplatform.dto.RegisterRequest;
import com.kzhastkou.devproductivityplatform.entity.Developer;
import com.kzhastkou.devproductivityplatform.entity.Organization;
import com.kzhastkou.devproductivityplatform.entity.Role;
import com.kzhastkou.devproductivityplatform.entity.SoftwareProduct;
import com.kzhastkou.devproductivityplatform.entity.UserSettings;
import com.kzhastkou.devproductivityplatform.exception.NotFoundException;
import com.kzhastkou.devproductivityplatform.repository.DeveloperRepository;
import com.kzhastkou.devproductivityplatform.repository.OrganizationRepository;
import com.kzhastkou.devproductivityplatform.repository.SoftwareProductRepository;
import com.kzhastkou.devproductivityplatform.repository.UserSettingsRepository;
import com.kzhastkou.devproductivityplatform.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final DeveloperRepository developerRepository;
    private final OrganizationRepository organizationRepository;
    private final UserSettingsRepository userSettingsRepository;
    private final SoftwareProductRepository softwareProductRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {

        Developer dev = developerRepository.findByEmail(normalizeEmail(request.getEmail()))
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!passwordMatches(request.getPassword(), dev.getPassword())) {
            throw new RuntimeException("Invalid password");
        }

        return buildAuthResponse(dev);
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.getEmail());

        if (developerRepository.existsByEmail(email)) {
            throw new RuntimeException("Email is already registered.");
        }

        Developer developer = developerRepository.save(Developer.builder()
                .email(email)
                .password(passwordEncoder.encode(request.getPassword()))
                .role(Role.USER)
                .build());

        Organization organization = organizationRepository.save(Organization.builder()
                .developer(developer)
                .shortName("Default Organization")
                .fullName("Default Organization")
                .build());

        developer.setOrganization(organization);
        developerRepository.save(developer);

        userSettingsRepository.save(UserSettings.builder()
                .developer(developer)
                .currentOrganization(organization)
                .dailyHoursLimit(8.0)
                .reportsSaveDirectory("")
                .scheduledExportEnabled(false)
                .scheduledExportFolder("")
                .scheduledExportTime("02:00")
                .scheduledExportRetentionDays(30)
                .build());

        softwareProductRepository.saveAll(defaultSoftwareProducts(developer));

        return buildAuthResponse(developer);
    }

    @Transactional(readOnly = true)
    public AuthUserResponse getCurrentUser(Long developerId) {
        Developer developer = developerRepository.findById(developerId)
                .orElseThrow(() -> new NotFoundException("Developer not found"));

        return toUserResponse(developer);
    }

    @Transactional
    public AuthUserResponse changePassword(Long developerId, ChangePasswordRequest request) {
        Developer developer = developerRepository.findById(developerId)
                .orElseThrow(() -> new NotFoundException("Developer not found"));

        String currentPassword = request != null ? request.getCurrentPassword() : null;
        String newPassword = request != null ? request.getNewPassword() : null;
        String confirmNewPassword = request != null ? request.getConfirmNewPassword() : null;

        if (isBlank(currentPassword)) {
            throw new RuntimeException("Current password is required.");
        }

        if (!passwordEncoder.matches(currentPassword, developer.getPassword())) {
            throw new RuntimeException("Current password is incorrect.");
        }

        if (newPassword == null || newPassword.length() < 6) {
            throw new RuntimeException("New password must be at least 6 characters.");
        }

        if (!newPassword.equals(confirmNewPassword)) {
            throw new RuntimeException("New password and confirmation do not match.");
        }

        developer.setPassword(passwordEncoder.encode(newPassword));
        Developer savedDeveloper = developerRepository.save(developer);

        return toUserResponse(savedDeveloper);
    }

    private AuthResponse buildAuthResponse(Developer developer) {
        return AuthResponse.builder()
                .token(jwtService.generateToken(developer.getId()))
                .user(toUserResponse(developer))
                .build();
    }

    private AuthUserResponse toUserResponse(Developer developer) {
        return AuthUserResponse.builder()
                .id(developer.getId())
                .email(developer.getEmail())
                .role(developer.getRole() != null ? developer.getRole().name() : Role.USER.name())
                .build();
    }

    private List<SoftwareProduct> defaultSoftwareProducts(Developer developer) {
        return List.of(
                SoftwareProduct.builder()
                        .developer(developer)
                        .shortName("ERP")
                        .fullName("Enterprise Resource Planning")
                        .build(),
                SoftwareProduct.builder()
                        .developer(developer)
                        .shortName("CRM")
                        .fullName("Customer Relationship Management")
                        .build(),
                SoftwareProduct.builder()
                        .developer(developer)
                        .shortName("FIN")
                        .fullName("Financial Operations Suite")
                        .build(),
                SoftwareProduct.builder()
                        .developer(developer)
                        .shortName("HR")
                        .fullName("Human Resources Platform")
                        .build()
        );
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private boolean passwordMatches(String rawPassword, String storedPassword) {
        if (storedPassword == null) {
            return false;
        }

        if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$") || storedPassword.startsWith("$2y$")) {
            return passwordEncoder.matches(rawPassword, storedPassword);
        }

        return storedPassword.equals(rawPassword);
    }
}
