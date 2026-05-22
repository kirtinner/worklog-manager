package com.kzhastkou.devproductivityplatform.service;

import com.kzhastkou.devproductivityplatform.dto.TaskRequest;
import com.kzhastkou.devproductivityplatform.dto.TaskResponse;
import com.kzhastkou.devproductivityplatform.entity.Client;
import com.kzhastkou.devproductivityplatform.entity.Developer;
import com.kzhastkou.devproductivityplatform.entity.Organization;
import com.kzhastkou.devproductivityplatform.entity.Project;
import com.kzhastkou.devproductivityplatform.entity.SoftwareProduct;
import com.kzhastkou.devproductivityplatform.entity.Task;
import com.kzhastkou.devproductivityplatform.exception.NotFoundException;
import com.kzhastkou.devproductivityplatform.repository.ClientRepository;
import com.kzhastkou.devproductivityplatform.repository.DeveloperRepository;
import com.kzhastkou.devproductivityplatform.repository.OrganizationRepository;
import com.kzhastkou.devproductivityplatform.repository.ProjectRepository;
import com.kzhastkou.devproductivityplatform.repository.SoftwareProductRepository;
import com.kzhastkou.devproductivityplatform.repository.TaskRepository;
import com.kzhastkou.devproductivityplatform.repository.TimeEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final OrganizationRepository organizationRepository;
    private final ClientRepository clientRepository;
    private final ProjectRepository projectRepository;
    private final SoftwareProductRepository softwareProductRepository;
    private final DeveloperRepository developerRepository;
    private final TimeEntryRepository timeEntryRepository;

    @Transactional(readOnly = true)
    public List<TaskResponse> findAll() {
        List<Task> tasks = taskRepository.findAll(Sort.by(Sort.Direction.ASC, "id"));
        Map<Long, Double> actualHoursByTaskId = loadActualHoursByTaskId();

        return tasks.stream()
                .map(task -> toResponse(task, actualHoursByTaskId))
                .toList();
    }

    @Transactional(readOnly = true)
    public TaskResponse findById(Long id) {
        Task task = findEntity(id);
        Map<Long, Double> actualHoursByTaskId = loadActualHoursByTaskId();

        return toResponse(task, actualHoursByTaskId);
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> findMyTasks(Long userId) {
        Map<Long, Double> actualHoursByTaskId = loadActualHoursByTaskId(userId);

        return taskRepository.findByDeveloperId(userId)
                .stream()
                .sorted(Comparator.comparing(Task::getId))
                .map(task -> toResponse(task, actualHoursByTaskId))
                .toList();
    }

    @Transactional
    public TaskResponse create(TaskRequest request, Long userId) {
        Developer developer = resolveDeveloper(userId);
        Task task = new Task();
        applyRequest(task, request, developer, true);
        return toResponse(taskRepository.save(task), Map.of());
    }

    @Transactional
    public TaskResponse update(Long id, TaskRequest request, Long userId) {
        Task task = findEntity(id);
        resolveDeveloper(userId);
        applyRequest(task, request, task.getDeveloper(), false);
        return toResponse(taskRepository.save(task), loadActualHoursByTaskId());
    }

    @Transactional
    public void delete(Long id) {
        validateCanDelete(id);

        taskRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public void validateCanDelete(Long id) {
        findEntity(id);

        if (timeEntryRepository.existsByTaskId(id)) {
            throw new RuntimeException("Task cannot be deleted because worklog entries exist.");
        }
    }

    private Task findEntity(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Task not found"));
    }

    private Developer resolveDeveloper(Long userId) {
        return developerRepository.findById(userId)
                .orElseGet(() -> developerRepository.findFirstByOrderByIdAsc()
                        .orElseThrow(() -> new NotFoundException("Developer not found")));
    }

    private void applyRequest(Task task, TaskRequest request, Developer developer, boolean isCreate) {
        Organization organization = resolveOrganization(request.getOrganizationId());
        Client client = resolveClient(request.getClientId());
        Project project = resolveProject(request.getProjectId());
        SoftwareProduct softwareProduct = resolveSoftwareProduct(request.getSoftwareProductId());

        validateHierarchy(organization, client, project);

        task.setOrganization(organization);
        task.setClient(client);
        task.setProject(project);
        task.setSoftwareProduct(softwareProduct);
        task.setTaskNumber(request.getTaskNumber().trim());
        task.setName(request.getName().trim());
        task.setComment(request.getComment());
        task.setTaskLink(request.getTaskLink());
        task.setDescription(request.getDescription());
        task.setImplementationDetails(request.getImplementationDetails());
        task.setEstimatedHours(request.getEstimatedHours());
        task.setCompleted(request.getCompleted() != null ? request.getCompleted() : Boolean.FALSE);
        task.setCreatedAt(request.getCreatedAt() != null ? request.getCreatedAt() : (isCreate ? LocalDate.now() : task.getCreatedAt()));

        if (isCreate) {
            task.setDeveloper(developer);
        }
    }

    private Organization resolveOrganization(Long organizationId) {
        return organizationRepository.findById(organizationId)
                .orElseThrow(() -> new NotFoundException("Organization not found"));
    }

    private Client resolveClient(Long clientId) {
        return clientRepository.findById(clientId)
                .orElseThrow(() -> new NotFoundException("Client not found"));
    }

    private Project resolveProject(Long projectId) {
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new NotFoundException("Project not found"));
    }

    private SoftwareProduct resolveSoftwareProduct(Long softwareProductId) {
        return softwareProductRepository.findById(softwareProductId)
                .orElseThrow(() -> new NotFoundException("Software Product not found"));
    }

    private void validateHierarchy(Organization organization, Client client, Project project) {
        if (!client.getOrganization().getId().equals(organization.getId())) {
            throw new RuntimeException("Client does not belong to the selected organization");
        }

        if (!project.getOrganization().getId().equals(organization.getId())) {
            throw new RuntimeException("Project does not belong to the selected organization");
        }

        if (!project.getClient().getId().equals(client.getId())) {
            throw new RuntimeException("Project does not belong to the selected client");
        }
    }

    private Map<Long, Double> loadActualHoursByTaskId() {
        return timeEntryRepository.sumHoursByTask()
                .stream()
                .collect(Collectors.toMap(
                        TimeEntryRepository.TaskHoursTotal::getTaskId,
                        total -> total.getActualHours() == null ? 0.0 : total.getActualHours(),
                        (left, right) -> left
                ));
    }

    private Map<Long, Double> loadActualHoursByTaskId(Long developerId) {
        return timeEntryRepository.sumHoursByTaskForDeveloper(developerId)
                .stream()
                .collect(Collectors.toMap(
                        TimeEntryRepository.TaskHoursTotal::getTaskId,
                        total -> total.getActualHours() == null ? 0.0 : total.getActualHours(),
                        (left, right) -> left
                ));
    }

    private TaskResponse toResponse(Task task, Map<Long, Double> actualHoursByTaskId) {
        return TaskResponse.builder()
                .id(task.getId())
                .organizationId(task.getOrganization().getId())
                .organizationName(task.getOrganization().getShortName())
                .clientId(task.getClient().getId())
                .clientName(task.getClient().getShortName())
                .projectId(task.getProject().getId())
                .projectName(task.getProject().getShortName())
                .taskNumber(task.getTaskNumber())
                .name(task.getName())
                .comment(task.getComment())
                .taskLink(task.getTaskLink())
                .description(task.getDescription())
                .implementationDetails(task.getImplementationDetails())
                .estimatedHours(task.getEstimatedHours() == null ? null : task.getEstimatedHours().doubleValue())
                .actualHours(actualHoursByTaskId.getOrDefault(task.getId(), 0.0))
                .softwareProductId(task.getSoftwareProduct() != null ? task.getSoftwareProduct().getId() : null)
                .softwareProductName(task.getSoftwareProduct() != null ? task.getSoftwareProduct().getShortName() : null)
                .completed(task.getCompleted())
                .createdAt(task.getCreatedAt())
                .developerId(task.getDeveloper() != null ? task.getDeveloper().getId() : null)
                .build();
    }
}
