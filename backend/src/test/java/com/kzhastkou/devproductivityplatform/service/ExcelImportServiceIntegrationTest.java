package com.kzhastkou.devproductivityplatform.service;

import com.kzhastkou.devproductivityplatform.dto.ExcelImportResult;
import com.kzhastkou.devproductivityplatform.entity.Developer;
import com.kzhastkou.devproductivityplatform.entity.Role;
import com.kzhastkou.devproductivityplatform.repository.ClientRepository;
import com.kzhastkou.devproductivityplatform.repository.DeveloperRepository;
import com.kzhastkou.devproductivityplatform.repository.OrganizationRepository;
import com.kzhastkou.devproductivityplatform.repository.ProjectRepository;
import com.kzhastkou.devproductivityplatform.repository.SoftwareProductRepository;
import com.kzhastkou.devproductivityplatform.repository.TaskRepository;
import com.kzhastkou.devproductivityplatform.repository.TimeEntryRepository;
import com.kzhastkou.devproductivityplatform.repository.UserSettingsRepository;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class ExcelImportServiceIntegrationTest {

    @Autowired
    private ExcelImportService excelImportService;
    @Autowired
    private DeveloperRepository developerRepository;
    @Autowired
    private OrganizationRepository organizationRepository;
    @Autowired
    private ClientRepository clientRepository;
    @Autowired
    private ProjectRepository projectRepository;
    @Autowired
    private SoftwareProductRepository softwareProductRepository;
    @Autowired
    private TaskRepository taskRepository;
    @Autowired
    private TimeEntryRepository timeEntryRepository;
    @Autowired
    private UserSettingsRepository userSettingsRepository;

    private final List<Long> developerIds = new ArrayList<>();

    @AfterEach
    void cleanup() {
        for (Long developerId : developerIds) {
            developerRepository.findById(developerId).ifPresent(developer -> {
                userSettingsRepository.findByDeveloperId(developerId).ifPresent(settings -> {
                    settings.setCurrentOrganization(null);
                    userSettingsRepository.save(settings);
                });
                developer.setOrganization(null);
                developerRepository.saveAndFlush(developer);
                timeEntryRepository.deleteAll(timeEntryRepository.findByDeveloperId(developerId));
                taskRepository.deleteAll(taskRepository.findByDeveloperIdOrderByIdAsc(developerId));
                softwareProductRepository.deleteAll(softwareProductRepository.findByDeveloperIdOrderByIdAsc(developerId));
                projectRepository.deleteAll(projectRepository.findByDeveloperIdOrderByIdAsc(developerId));
                clientRepository.deleteAll(clientRepository.findByDeveloperIdOrderByIdAsc(developerId));
                organizationRepository.deleteAll(organizationRepository.findByDeveloperIdOrderByIdAsc(developerId));
                timeEntryRepository.flush();
                taskRepository.flush();
                softwareProductRepository.flush();
                projectRepository.flush();
                clientRepository.flush();
                organizationRepository.flush();
                developerRepository.delete(developer);
                developerRepository.flush();
            });
        }
        developerIds.clear();
    }

    @Test
    void replaceModeSupportsEmptyReplaceAndRepeatedImport() throws IOException {
        Developer developer = developerRepository.saveAndFlush(Developer.builder()
                .email("import-test-" + System.nanoTime() + "@example.test")
                .password("test")
                .role(Role.USER)
                .build());
        developerIds.add(developer.getId());

        ExcelImportResult firstImport = excelImportService.importData(workbookFile("A"), developer.getId());
        assertThat(firstImport.isImported()).isTrue();
        assertCounts(developer.getId(), "Org A", "Client A", "Project A", "Product A");

        ExcelImportResult replacementImport = excelImportService.importData(workbookFile("B"), developer.getId());
        assertThat(replacementImport.isImported()).isTrue();
        assertCounts(developer.getId(), "Org B", "Client B", "Project B", "Product B");

        ExcelImportResult repeatedImport = excelImportService.importData(workbookFile("B"), developer.getId());
        assertThat(repeatedImport.isImported()).isTrue();
        assertCounts(developer.getId(), "Org B", "Client B", "Project B", "Product B");
    }

    @Test
    void importAllowsSameProjectShortNameForDifferentClients() throws IOException {
        Developer developer = developerRepository.saveAndFlush(Developer.builder()
                .email("import-project-duplicates-" + System.nanoTime() + "@example.test")
                .password("test")
                .role(Role.USER)
                .build());
        developerIds.add(developer.getId());

        ExcelImportResult result = excelImportService.importData(workbookFileWithSameProjectShortNameForDifferentClients(), developer.getId());

        assertThat(result.isImported()).isTrue();
        assertThat(projectRepository.findByDeveloperIdOrderByIdAsc(developer.getId()))
                .hasSize(2)
                .allSatisfy(project -> assertThat(project.getShortName()).isEqualTo("Shared Project"));
    }

    @Test
    void importSupportsLongTaskTextFields() throws IOException {
        Developer developer = developerRepository.saveAndFlush(Developer.builder()
                .email("import-long-task-text-" + System.nanoTime() + "@example.test")
                .password("test")
                .role(Role.USER)
                .build());
        developerIds.add(developer.getId());

        String longDescription = "D".repeat(2500);
        String longComment = "C".repeat(2500);
        String longImplementationDetails = "I".repeat(2500);

        ExcelImportResult result = excelImportService.importData(
                workbookFileWithLongTaskText(longDescription, longComment, longImplementationDetails),
                developer.getId()
        );

        assertThat(result.isImported()).isTrue();
        assertThat(taskRepository.findByDeveloperIdOrderByIdAsc(developer.getId()))
                .singleElement()
                .satisfies(task -> {
                    assertThat(task.getDescription()).isEqualTo(longDescription);
                    assertThat(task.getDescription()).hasSizeGreaterThan(2000);
                    assertThat(task.getComment()).isEqualTo(longComment);
                    assertThat(task.getComment()).hasSizeGreaterThan(2000);
                    assertThat(task.getImplementationDetails()).isEqualTo(longImplementationDetails);
                    assertThat(task.getImplementationDetails()).hasSizeGreaterThan(2000);
                });
    }

    private void assertCounts(Long developerId, String organization, String client, String project, String softwareProduct) {
        assertThat(organizationRepository.findByDeveloperIdOrderByIdAsc(developerId))
                .singleElement()
                .extracting("shortName")
                .isEqualTo(organization);
        assertThat(clientRepository.findByDeveloperIdOrderByIdAsc(developerId))
                .singleElement()
                .extracting("shortName")
                .isEqualTo(client);
        assertThat(projectRepository.findByDeveloperIdOrderByIdAsc(developerId))
                .singleElement()
                .extracting("shortName")
                .isEqualTo(project);
        assertThat(softwareProductRepository.findByDeveloperIdOrderByIdAsc(developerId))
                .singleElement()
                .extracting("shortName")
                .isEqualTo(softwareProduct);
        assertThat(taskRepository.findByDeveloperIdOrderByIdAsc(developerId)).hasSize(1);
        assertThat(timeEntryRepository.findByDeveloperId(developerId)).hasSize(1);
    }

    private MockMultipartFile workbookFile(String suffix) throws IOException {
        Workbook workbook = new XSSFWorkbook();
        createSheet(workbook, "Organizations", "code", "short_name", "full_name");
        createSheet(workbook, "Clients", "code", "organization_code", "short_name", "full_name");
        createSheet(workbook, "Projects", "code", "organization_code", "client_code", "short_name", "full_name", "description", "completed");
        createSheet(workbook, "SoftwareProducts", "code", "short_name", "full_name");
        createSheet(workbook, "Tasks", "code", "organization_code", "client_code", "project_code", "software_product_code", "task_number", "name", "comment", "estimated_hours", "completed", "task_link");
        createSheet(workbook, "TimeEntries", "task_code", "entry_date", "hours", "comment");

        appendRow(workbook.getSheet("Organizations"), "ORG" + suffix, "Org " + suffix, "Organization " + suffix);
        appendRow(workbook.getSheet("Clients"), "CLIENT" + suffix, "ORG" + suffix, "Client " + suffix, "Client Full " + suffix);
        appendRow(workbook.getSheet("Projects"), "PROJECT" + suffix, "ORG" + suffix, "CLIENT" + suffix, "Project " + suffix, "Project Full " + suffix, "Description " + suffix, "false");
        appendRow(workbook.getSheet("SoftwareProducts"), "PRODUCT" + suffix, "Product " + suffix, "Product Full " + suffix);
        appendRow(workbook.getSheet("Tasks"), "TASK" + suffix, "ORG" + suffix, "CLIENT" + suffix, "PROJECT" + suffix, "PRODUCT" + suffix, "TASK-" + suffix, "Task " + suffix, "", "1", "false", "");
        appendRow(workbook.getSheet("TimeEntries"), "TASK" + suffix, "2026-05-24", "1", "Work " + suffix);

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        workbook.write(output);
        workbook.close();
        return new MockMultipartFile(
                "file",
                "import.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                output.toByteArray()
        );
    }

    private MockMultipartFile workbookFileWithSameProjectShortNameForDifferentClients() throws IOException {
        Workbook workbook = new XSSFWorkbook();
        createSheet(workbook, "Organizations", "code", "short_name", "full_name");
        createSheet(workbook, "Clients", "code", "organization_code", "short_name", "full_name");
        createSheet(workbook, "Projects", "code", "organization_code", "client_code", "short_name", "full_name", "description", "completed");
        createSheet(workbook, "SoftwareProducts", "code", "short_name", "full_name");
        createSheet(workbook, "Tasks", "code", "organization_code", "client_code", "project_code", "software_product_code", "task_number", "name", "comment", "estimated_hours", "completed", "task_link");
        createSheet(workbook, "TimeEntries", "task_code", "entry_date", "hours", "comment");

        appendRow(workbook.getSheet("Organizations"), "ORG1", "Org 1", "Organization 1");
        appendRow(workbook.getSheet("Clients"), "CLIENT1", "ORG1", "Client 1", "Client Full 1");
        appendRow(workbook.getSheet("Clients"), "CLIENT2", "ORG1", "Client 2", "Client Full 2");
        appendRow(workbook.getSheet("Projects"), "PROJECT1", "ORG1", "CLIENT1", "Shared Project", "Project Full 1", "", "false");
        appendRow(workbook.getSheet("Projects"), "PROJECT2", "ORG1", "CLIENT2", "Shared Project", "Project Full 2", "", "false");
        appendRow(workbook.getSheet("SoftwareProducts"), "PRODUCT1", "Product 1", "Product Full 1");
        appendRow(workbook.getSheet("Tasks"), "TASK1", "ORG1", "CLIENT1", "PROJECT1", "PRODUCT1", "TASK-1", "Task 1", "", "1", "false", "");
        appendRow(workbook.getSheet("TimeEntries"), "TASK1", "2026-05-24", "1", "Work");

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        workbook.write(output);
        workbook.close();
        return new MockMultipartFile(
                "file",
                "import.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                output.toByteArray()
        );
    }

    private MockMultipartFile workbookFileWithLongTaskText(String description, String comment, String implementationDetails) throws IOException {
        Workbook workbook = new XSSFWorkbook();
        createSheet(workbook, "Organizations", "code", "short_name", "full_name");
        createSheet(workbook, "Clients", "code", "organization_code", "short_name", "full_name");
        createSheet(workbook, "Projects", "code", "organization_code", "client_code", "short_name", "full_name", "description", "completed");
        createSheet(workbook, "SoftwareProducts", "code", "short_name", "full_name");
        createSheet(workbook, "Tasks", "code", "organization_code", "client_code", "project_code", "software_product_code", "task_number", "name", "comment", "description", "implementation_details", "estimated_hours", "completed", "task_link");
        createSheet(workbook, "TimeEntries", "task_code", "entry_date", "hours", "comment");

        appendRow(workbook.getSheet("Organizations"), "ORG1", "Org 1", "Organization 1");
        appendRow(workbook.getSheet("Clients"), "CLIENT1", "ORG1", "Client 1", "Client Full 1");
        appendRow(workbook.getSheet("Projects"), "PROJECT1", "ORG1", "CLIENT1", "Project 1", "Project Full 1", "Project description", "false");
        appendRow(workbook.getSheet("SoftwareProducts"), "PRODUCT1", "Product 1", "Product Full 1");
        appendRow(workbook.getSheet("Tasks"), "TASK1", "ORG1", "CLIENT1", "PROJECT1", "PRODUCT1", "TASK-1", "Task 1", comment, description, implementationDetails, "1", "false", "");
        appendRow(workbook.getSheet("TimeEntries"), "TASK1", "2026-05-24", "1", "Work");

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        workbook.write(output);
        workbook.close();
        return new MockMultipartFile(
                "file",
                "import.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                output.toByteArray()
        );
    }

    private void createSheet(Workbook workbook, String name, String... columns) {
        Sheet sheet = workbook.createSheet(name);
        Row row = sheet.createRow(0);
        for (int index = 0; index < columns.length; index++) {
            row.createCell(index).setCellValue(columns[index]);
        }
    }

    private void appendRow(Sheet sheet, String... values) {
        Row row = sheet.createRow(sheet.getLastRowNum() + 1);
        for (int index = 0; index < values.length; index++) {
            row.createCell(index).setCellValue(values[index]);
        }
    }
}
