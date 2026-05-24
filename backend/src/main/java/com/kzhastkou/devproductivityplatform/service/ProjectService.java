package com.kzhastkou.devproductivityplatform.service;

import com.kzhastkou.devproductivityplatform.dto.ProjectRequest;
import com.kzhastkou.devproductivityplatform.dto.ProjectResponse;
import com.kzhastkou.devproductivityplatform.entity.Developer;
import com.kzhastkou.devproductivityplatform.entity.Client;
import com.kzhastkou.devproductivityplatform.entity.Organization;
import com.kzhastkou.devproductivityplatform.entity.Project;
import com.kzhastkou.devproductivityplatform.exception.NotFoundException;
import com.kzhastkou.devproductivityplatform.repository.ClientRepository;
import com.kzhastkou.devproductivityplatform.repository.DeveloperRepository;
import com.kzhastkou.devproductivityplatform.repository.OrganizationRepository;
import com.kzhastkou.devproductivityplatform.repository.ProjectRepository;
import com.kzhastkou.devproductivityplatform.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final OrganizationRepository organizationRepository;
    private final ClientRepository clientRepository;
    private final DeveloperRepository developerRepository;
    private final TaskRepository taskRepository;

    @Transactional(readOnly = true)
    public List<ProjectResponse> findAll(Long developerId) {
        return projectRepository.findByDeveloperIdOrderByIdAsc(developerId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectResponse findById(Long id, Long developerId) {
        return toResponse(findEntity(id, developerId));
    }

    @Transactional
    public ProjectResponse create(ProjectRequest request, Long developerId) {
        Developer developer = resolveDeveloper(developerId);
        Organization organization = resolveOrganization(request.getOrganizationId(), developerId);
        Client client = resolveClient(request.getClientId(), developerId);
        validateClientBelongsToOrganization(client, organization);

        Project project = Project.builder()
                .developer(developer)
                .organization(organization)
                .client(client)
                .shortName(request.getShortName().trim())
                .fullName(request.getFullName().trim())
                .description(request.getDescription())
                .completed(request.getCompleted() != null ? request.getCompleted() : Boolean.FALSE)
                .build();

        return toResponse(projectRepository.save(project));
    }

    @Transactional
    public ProjectResponse update(Long id, ProjectRequest request, Long developerId) {
        Project project = findEntity(id, developerId);
        Organization organization = resolveOrganization(request.getOrganizationId(), developerId);
        Client client = resolveClient(request.getClientId(), developerId);
        validateClientBelongsToOrganization(client, organization);

        project.setOrganization(organization);
        project.setClient(client);
        project.setShortName(request.getShortName().trim());
        project.setFullName(request.getFullName().trim());
        project.setDescription(request.getDescription());
        project.setCompleted(request.getCompleted() != null ? request.getCompleted() : Boolean.FALSE);
        return toResponse(projectRepository.save(project));
    }

    @Transactional
    public void delete(Long id, Long developerId) {
        findEntity(id, developerId);

        if (taskRepository.existsByDeveloperIdAndProjectId(developerId, id)) {
            throw new RuntimeException("Project is used in the system and cannot be deleted.");
        }

        projectRepository.deleteById(id);
    }

    private Project findEntity(Long id, Long developerId) {
        return projectRepository.findByIdAndDeveloperId(id, developerId)
                .orElseThrow(() -> new NotFoundException("Project not found"));
    }

    private Developer resolveDeveloper(Long developerId) {
        return developerRepository.findById(developerId)
                .orElseThrow(() -> new NotFoundException("Developer not found"));
    }

    private Organization resolveOrganization(Long organizationId, Long developerId) {
        return organizationRepository.findByIdAndDeveloperId(organizationId, developerId)
                .orElseThrow(() -> new NotFoundException("Organization not found"));
    }

    private Client resolveClient(Long clientId, Long developerId) {
        return clientRepository.findByIdAndDeveloperId(clientId, developerId)
                .orElseThrow(() -> new NotFoundException("Client not found"));
    }

    private void validateClientBelongsToOrganization(Client client, Organization organization) {
        if (!client.getOrganization().getId().equals(organization.getId())) {
            throw new RuntimeException("Client does not belong to the selected organization");
        }
    }

    private ProjectResponse toResponse(Project project) {
        return ProjectResponse.builder()
                .id(project.getId())
                .organizationId(project.getOrganization().getId())
                .organizationName(project.getOrganization().getShortName())
                .clientId(project.getClient().getId())
                .clientName(project.getClient().getShortName())
                .shortName(project.getShortName())
                .fullName(project.getFullName())
                .description(project.getDescription())
                .completed(project.getCompleted())
                .build();
    }
}
