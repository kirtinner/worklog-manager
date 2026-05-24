package com.kzhastkou.devproductivityplatform.service;

import com.kzhastkou.devproductivityplatform.dto.OrganizationRequest;
import com.kzhastkou.devproductivityplatform.dto.OrganizationResponse;
import com.kzhastkou.devproductivityplatform.entity.Developer;
import com.kzhastkou.devproductivityplatform.entity.Organization;
import com.kzhastkou.devproductivityplatform.entity.UserSettings;
import com.kzhastkou.devproductivityplatform.exception.NotFoundException;
import com.kzhastkou.devproductivityplatform.repository.ClientRepository;
import com.kzhastkou.devproductivityplatform.repository.DeveloperRepository;
import com.kzhastkou.devproductivityplatform.repository.OrganizationRepository;
import com.kzhastkou.devproductivityplatform.repository.ProjectRepository;
import com.kzhastkou.devproductivityplatform.repository.TaskRepository;
import com.kzhastkou.devproductivityplatform.repository.TimeEntryRepository;
import com.kzhastkou.devproductivityplatform.repository.UserSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class OrganizationService {

    private final OrganizationRepository organizationRepository;
    private final ClientRepository clientRepository;
    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final DeveloperRepository developerRepository;
    private final TimeEntryRepository timeEntryRepository;
    private final UserSettingsRepository userSettingsRepository;

    @Transactional(readOnly = true)
    public List<OrganizationResponse> findAll(Long developerId) {
        return organizationRepository.findByDeveloperIdOrderByIdAsc(developerId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public OrganizationResponse findById(Long id, Long developerId) {
        return toResponse(findEntity(id, developerId));
    }

    @Transactional
    public OrganizationResponse create(OrganizationRequest request, Long developerId) {
        Developer developer = resolveDeveloper(developerId);
        Organization organization = Organization.builder()
                .developer(developer)
                .shortName(request.getShortName().trim())
                .fullName(request.getFullName().trim())
                .build();

        return toResponse(organizationRepository.save(organization));
    }

    @Transactional
    public OrganizationResponse update(Long id, OrganizationRequest request, Long developerId) {
        Organization organization = findEntity(id, developerId);
        organization.setShortName(request.getShortName().trim());
        organization.setFullName(request.getFullName().trim());
        return toResponse(organizationRepository.save(organization));
    }

    @Transactional
    public void delete(Long id, Long developerId) {
        Organization organization = findEntity(id, developerId);

        if (clientRepository.existsByDeveloperIdAndOrganizationId(developerId, id)
                || projectRepository.existsByDeveloperIdAndOrganizationId(developerId, id)
                || taskRepository.existsByDeveloperIdAndOrganizationId(developerId, id)
                || timeEntryRepository.existsByDeveloperIdAndOrganizationId(developerId, id)
                || developerRepository.existsByOrganizationId(id)) {
            throw new RuntimeException("Organization is used in the system and cannot be deleted.");
        }

        userSettingsRepository.findByDeveloperId(developerId).ifPresent(settings -> {
            if (settings.getCurrentOrganization() != null
                    && settings.getCurrentOrganization().getId().equals(organization.getId())) {
                settings.setCurrentOrganization(null);
                userSettingsRepository.save(settings);
            }
        });

        organizationRepository.deleteById(id);
    }

    private Organization findEntity(Long id, Long developerId) {
        return organizationRepository.findByIdAndDeveloperId(id, developerId)
                .orElseThrow(() -> new NotFoundException("Organization not found"));
    }

    private Developer resolveDeveloper(Long developerId) {
        return developerRepository.findById(developerId)
                .orElseThrow(() -> new NotFoundException("Developer not found"));
    }

    private OrganizationResponse toResponse(Organization organization) {
        return OrganizationResponse.builder()
                .id(organization.getId())
                .shortName(organization.getShortName())
                .fullName(organization.getFullName())
                .build();
    }
}
