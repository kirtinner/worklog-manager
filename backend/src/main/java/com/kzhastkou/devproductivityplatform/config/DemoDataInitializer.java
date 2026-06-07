package com.kzhastkou.devproductivityplatform.config;

import com.kzhastkou.devproductivityplatform.entity.Client;
import com.kzhastkou.devproductivityplatform.entity.Developer;
import com.kzhastkou.devproductivityplatform.entity.Organization;
import com.kzhastkou.devproductivityplatform.entity.Project;
import com.kzhastkou.devproductivityplatform.entity.Role;
import com.kzhastkou.devproductivityplatform.entity.SoftwareProduct;
import com.kzhastkou.devproductivityplatform.entity.Task;
import com.kzhastkou.devproductivityplatform.entity.TimeEntry;
import com.kzhastkou.devproductivityplatform.entity.UserSettings;
import com.kzhastkou.devproductivityplatform.repository.ClientRepository;
import com.kzhastkou.devproductivityplatform.repository.DeveloperRepository;
import com.kzhastkou.devproductivityplatform.repository.OrganizationRepository;
import com.kzhastkou.devproductivityplatform.repository.ProjectRepository;
import com.kzhastkou.devproductivityplatform.repository.SoftwareProductRepository;
import com.kzhastkou.devproductivityplatform.repository.TaskRepository;
import com.kzhastkou.devproductivityplatform.repository.TimeEntryRepository;
import com.kzhastkou.devproductivityplatform.repository.UserSettingsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
@Slf4j
public class DemoDataInitializer implements ApplicationRunner {

    private static final LocalDate DEMO_WORKLOG_DATE = LocalDate.of(2026, 6, 1);

    private final DeveloperRepository developerRepository;
    private final OrganizationRepository organizationRepository;
    private final ClientRepository clientRepository;
    private final ProjectRepository projectRepository;
    private final SoftwareProductRepository softwareProductRepository;
    private final TaskRepository taskRepository;
    private final TimeEntryRepository timeEntryRepository;
    private final UserSettingsRepository userSettingsRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (developerRepository.count() > 0) {
            log.info("Demo data initialization skipped because data already exists.");
            return;
        }

        Developer developer = developerRepository.save(Developer.builder()
                .email("example@gmail.com")
                .password(passwordEncoder.encode("123"))
                .role(Role.USER)
                .build());

        Organization organization = organizationRepository.save(Organization.builder()
                .developer(developer)
                .shortName("Demo Organization")
                .fullName("Demo Organization")
                .build());

        developer.setOrganization(organization);
        developerRepository.save(developer);

        Client client = clientRepository.save(Client.builder()
                .developer(developer)
                .organization(organization)
                .shortName("Internal Project")
                .fullName("Internal Project")
                .notDisplayed(false)
                .build());

        Project project = projectRepository.save(Project.builder()
                .developer(developer)
                .organization(organization)
                .client(client)
                .shortName("Dev Productivity Platform")
                .fullName("Dev Productivity Platform")
                .description("Demo project for tracking product development work.")
                .completed(false)
                .build());

        SoftwareProduct softwareProduct = softwareProductRepository.save(SoftwareProduct.builder()
                .developer(developer)
                .shortName("DPP")
                .fullName("Dev Productivity Platform")
                .build());

        Task backendTask = createTask(
                developer,
                organization,
                client,
                project,
                softwareProduct,
                "DPP-1",
                "Backend Development",
                "Implement REST APIs for organizations, clients and projects.",
                16.0
        );
        Task frontendTask = createTask(
                developer,
                organization,
                client,
                project,
                softwareProduct,
                "DPP-2",
                "Frontend Development",
                "Create React UI pages and modal editors.",
                16.0
        );
        Task dockerTask = createTask(
                developer,
                organization,
                client,
                project,
                softwareProduct,
                "DPP-3",
                "Docker Setup",
                "Containerize application using Docker Compose and Nginx.",
                8.0
        );

        timeEntryRepository.saveAll(List.of(
                createTimeEntry(developer, organization, backendTask, 4.0, "Implemented REST API endpoints and completed service layer integration."),
                createTimeEntry(developer, organization, frontendTask, 3.0, "Created UI components and connected frontend forms to backend APIs."),
                createTimeEntry(developer, organization, dockerTask, 1.0, "Configured Docker Compose and verified container startup.")
        ));

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

        log.info("Demo data created successfully.");
    }

    private Task createTask(
            Developer developer,
            Organization organization,
            Client client,
            Project project,
            SoftwareProduct softwareProduct,
            String taskNumber,
            String name,
            String comment,
            Double estimatedHours
    ) {
        return taskRepository.save(Task.builder()
                .developer(developer)
                .organization(organization)
                .client(client)
                .project(project)
                .softwareProduct(softwareProduct)
                .taskNumber(taskNumber)
                .name(name)
                .createdAt(DEMO_WORKLOG_DATE)
                .estimatedHours(estimatedHours)
                .completed(false)
                .comment(comment)
                .description("")
                .implementationDetails("")
                .taskLink("")
                .build());
    }

    private TimeEntry createTimeEntry(Developer developer, Organization organization, Task task, Double hours, String comment) {
        return TimeEntry.builder()
                .developer(developer)
                .organization(organization)
                .task(task)
                .date(DEMO_WORKLOG_DATE)
                .hours(hours)
                .comment(comment)
                .build();
    }
}
