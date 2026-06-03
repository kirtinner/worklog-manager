package com.kzhastkou.devproductivityplatform.service;

import com.kzhastkou.devproductivityplatform.dto.ExcelImportResult;
import com.kzhastkou.devproductivityplatform.dto.FullDataExportFile;
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
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class ExcelImportServiceIntegrationTest {

    @Autowired
    private ExcelImportService excelImportService;
    @Autowired
    private FullDataExportService fullDataExportService;
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

    @Test
    void importPersistsClientNotDisplayedFlag() throws IOException {
        Developer developer = developerRepository.saveAndFlush(Developer.builder()
                .email("import-hidden-client-" + System.nanoTime() + "@example.test")
                .password("test")
                .role(Role.USER)
                .build());
        developerIds.add(developer.getId());

        ExcelImportResult result = excelImportService.importData(workbookFileWithHiddenClient(), developer.getId());

        assertThat(result.isImported()).isTrue();
        assertThat(clientRepository.findByDeveloperIdOrderByIdAsc(developer.getId()))
                .singleElement()
                .satisfies(client -> {
                    assertThat(client.getShortName()).isEqualTo("Client 1");
                    assertThat(client.getNotDisplayed()).isTrue();
                });
    }

    @Test
    void importPersistsClientNotDisplayedFalseValue() throws IOException {
        Developer developer = developerRepository.saveAndFlush(Developer.builder()
                .email("import-visible-client-false-" + System.nanoTime() + "@example.test")
                .password("test")
                .role(Role.USER)
                .build());
        developerIds.add(developer.getId());

        ExcelImportResult result = excelImportService.importData(workbookFileWithClientNotDisplayed("false", true), developer.getId());

        assertThat(result.isImported()).isTrue();
        assertThat(clientRepository.findByDeveloperIdOrderByIdAsc(developer.getId()))
                .singleElement()
                .satisfies(client -> assertThat(client.getNotDisplayed()).isFalse());
    }

    @Test
    void importDefaultsMissingClientNotDisplayedColumnToFalse() throws IOException {
        Developer developer = developerRepository.saveAndFlush(Developer.builder()
                .email("import-visible-client-missing-" + System.nanoTime() + "@example.test")
                .password("test")
                .role(Role.USER)
                .build());
        developerIds.add(developer.getId());

        ExcelImportResult result = excelImportService.importData(workbookFileWithClientNotDisplayed("", false), developer.getId());

        assertThat(result.isImported()).isTrue();
        assertThat(clientRepository.findByDeveloperIdOrderByIdAsc(developer.getId()))
                .singleElement()
                .satisfies(client -> assertThat(client.getNotDisplayed()).isFalse());
    }

    @Test
    void importDefaultsEmptyClientNotDisplayedValueToFalse() throws IOException {
        Developer developer = developerRepository.saveAndFlush(Developer.builder()
                .email("import-visible-client-empty-" + System.nanoTime() + "@example.test")
                .password("test")
                .role(Role.USER)
                .build());
        developerIds.add(developer.getId());

        ExcelImportResult result = excelImportService.importData(workbookFileWithClientNotDisplayed("", true), developer.getId());

        assertThat(result.isImported()).isTrue();
        assertThat(clientRepository.findByDeveloperIdOrderByIdAsc(developer.getId()))
                .singleElement()
                .satisfies(client -> assertThat(client.getNotDisplayed()).isFalse());
    }

    @Test
    void fullDataExportCanBeImportedBack() throws IOException {
        Developer developer = developerRepository.saveAndFlush(Developer.builder()
                .email("full-export-cycle-" + System.nanoTime() + "@example.test")
                .password("test")
                .role(Role.USER)
                .build());
        developerIds.add(developer.getId());

        ExcelImportResult initialImport = excelImportService.importData(workbookFileWithHiddenClient(), developer.getId());
        assertThat(initialImport.isImported()).isTrue();

        FullDataExportFile exportFile = fullDataExportService.exportForDownload(developer.getId());
        assertThat(exportFile.fileName()).startsWith("dev_platform_full_export_").endsWith(".xlsx");
        assertThat(exportFile.content()).isNotEmpty();
        assertExportContainsTaskCreatedAt(exportFile.content(), "2026-05-20");
        assertExportContainsClientNotDisplayed(exportFile.content(), "true");

        ExcelImportResult importBack = excelImportService.importData(new MockMultipartFile(
                "file",
                exportFile.fileName(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                exportFile.content()
        ), developer.getId());

        assertThat(importBack.isImported()).isTrue();
        assertThat(organizationRepository.findByDeveloperIdOrderByIdAsc(developer.getId())).hasSize(1);
        assertThat(clientRepository.findByDeveloperIdOrderByIdAsc(developer.getId()))
                .singleElement()
                .satisfies(client -> {
                    assertThat(client.getShortName()).isEqualTo("Client 1");
                    assertThat(client.getNotDisplayed()).isTrue();
                });
        assertThat(projectRepository.findByDeveloperIdOrderByIdAsc(developer.getId())).hasSize(1);
        assertThat(softwareProductRepository.findByDeveloperIdOrderByIdAsc(developer.getId())).hasSize(1);
        assertThat(taskRepository.findByDeveloperIdOrderByIdAsc(developer.getId()))
                .singleElement()
                .satisfies(task -> assertThat(task.getCreatedAt()).isEqualTo(LocalDate.of(2026, 5, 20)));
        assertThat(timeEntryRepository.findByDeveloperId(developer.getId())).hasSize(1);
    }

    private void assertExportContainsTaskCreatedAt(byte[] content, String expectedDate) throws IOException {
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(content))) {
            Sheet tasks = workbook.getSheet("Tasks");
            assertThat(tasks).isNotNull();

            Row header = tasks.getRow(0);
            int createdAtColumn = -1;
            for (int index = 0; index < header.getLastCellNum(); index++) {
                if ("created_at".equals(header.getCell(index).getStringCellValue())) {
                    createdAtColumn = index;
                    break;
                }
            }

            assertThat(createdAtColumn).isGreaterThanOrEqualTo(0);
            assertThat(tasks.getRow(1).getCell(createdAtColumn).getStringCellValue()).isEqualTo(expectedDate);
        }
    }

    private void assertExportContainsClientNotDisplayed(byte[] content, String expectedValue) throws IOException {
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(content))) {
            Sheet clients = workbook.getSheet("Clients");
            assertThat(clients).isNotNull();

            Row header = clients.getRow(0);
            int notDisplayedColumn = -1;
            for (int index = 0; index < header.getLastCellNum(); index++) {
                if ("not_displayed".equals(header.getCell(index).getStringCellValue())) {
                    notDisplayedColumn = index;
                    break;
                }
            }

            assertThat(notDisplayedColumn).isGreaterThanOrEqualTo(0);
            assertThat(String.valueOf(clients.getRow(1).getCell(notDisplayedColumn).getBooleanCellValue())).isEqualTo(expectedValue);
        }
    }

    @Test
    void importPersistsTaskCreatedAt() throws IOException {
        Developer developer = developerRepository.saveAndFlush(Developer.builder()
                .email("import-task-created-at-" + System.nanoTime() + "@example.test")
                .password("test")
                .role(Role.USER)
                .build());
        developerIds.add(developer.getId());

        ExcelImportResult result = excelImportService.importData(workbookFile("CREATED"), developer.getId());

        assertThat(result.isImported()).isTrue();
        assertThat(taskRepository.findByDeveloperIdOrderByIdAsc(developer.getId()))
                .singleElement()
                .satisfies(task -> assertThat(task.getCreatedAt()).isEqualTo(LocalDate.of(2026, 5, 20)));
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
        assertThat(taskRepository.findByDeveloperIdOrderByIdAsc(developerId))
                .singleElement()
                .satisfies(task -> assertThat(task.getCreatedAt()).isEqualTo(LocalDate.of(2026, 5, 20)));
        assertThat(timeEntryRepository.findByDeveloperId(developerId)).hasSize(1);
    }

    private MockMultipartFile workbookFile(String suffix) throws IOException {
        Workbook workbook = new XSSFWorkbook();
        createSheet(workbook, "Organizations", "code", "short_name", "full_name");
        createSheet(workbook, "Clients", "code", "organization_code", "short_name", "full_name");
        createSheet(workbook, "Projects", "code", "organization_code", "client_code", "short_name", "full_name", "description", "completed");
        createSheet(workbook, "SoftwareProducts", "code", "short_name", "full_name");
        createSheet(workbook, "Tasks", "code", "organization_code", "client_code", "project_code", "software_product_code", "task_number", "name", "created_at", "comment", "estimated_hours", "completed", "task_link");
        createSheet(workbook, "TimeEntries", "task_code", "entry_date", "hours", "comment");

        appendRow(workbook.getSheet("Organizations"), "ORG" + suffix, "Org " + suffix, "Organization " + suffix);
        appendRow(workbook.getSheet("Clients"), "CLIENT" + suffix, "ORG" + suffix, "Client " + suffix, "Client Full " + suffix);
        appendRow(workbook.getSheet("Projects"), "PROJECT" + suffix, "ORG" + suffix, "CLIENT" + suffix, "Project " + suffix, "Project Full " + suffix, "Description " + suffix, "false");
        appendRow(workbook.getSheet("SoftwareProducts"), "PRODUCT" + suffix, "Product " + suffix, "Product Full " + suffix);
        appendRow(workbook.getSheet("Tasks"), "TASK" + suffix, "ORG" + suffix, "CLIENT" + suffix, "PROJECT" + suffix, "PRODUCT" + suffix, "TASK-" + suffix, "Task " + suffix, "2026-05-20", "", "1", "false", "");
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
        createSheet(workbook, "Tasks", "code", "organization_code", "client_code", "project_code", "software_product_code", "task_number", "name", "created_at", "comment", "estimated_hours", "completed", "task_link");
        createSheet(workbook, "TimeEntries", "task_code", "entry_date", "hours", "comment");

        appendRow(workbook.getSheet("Organizations"), "ORG1", "Org 1", "Organization 1");
        appendRow(workbook.getSheet("Clients"), "CLIENT1", "ORG1", "Client 1", "Client Full 1");
        appendRow(workbook.getSheet("Clients"), "CLIENT2", "ORG1", "Client 2", "Client Full 2");
        appendRow(workbook.getSheet("Projects"), "PROJECT1", "ORG1", "CLIENT1", "Shared Project", "Project Full 1", "", "false");
        appendRow(workbook.getSheet("Projects"), "PROJECT2", "ORG1", "CLIENT2", "Shared Project", "Project Full 2", "", "false");
        appendRow(workbook.getSheet("SoftwareProducts"), "PRODUCT1", "Product 1", "Product Full 1");
        appendRow(workbook.getSheet("Tasks"), "TASK1", "ORG1", "CLIENT1", "PROJECT1", "PRODUCT1", "TASK-1", "Task 1", "2026-05-20", "", "1", "false", "");
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
        createSheet(workbook, "Tasks", "code", "organization_code", "client_code", "project_code", "software_product_code", "task_number", "name", "created_at", "comment", "description", "implementation_details", "estimated_hours", "completed", "task_link");
        createSheet(workbook, "TimeEntries", "task_code", "entry_date", "hours", "comment");

        appendRow(workbook.getSheet("Organizations"), "ORG1", "Org 1", "Organization 1");
        appendRow(workbook.getSheet("Clients"), "CLIENT1", "ORG1", "Client 1", "Client Full 1");
        appendRow(workbook.getSheet("Projects"), "PROJECT1", "ORG1", "CLIENT1", "Project 1", "Project Full 1", "Project description", "false");
        appendRow(workbook.getSheet("SoftwareProducts"), "PRODUCT1", "Product 1", "Product Full 1");
        appendRow(workbook.getSheet("Tasks"), "TASK1", "ORG1", "CLIENT1", "PROJECT1", "PRODUCT1", "TASK-1", "Task 1", "2026-05-20", comment, description, implementationDetails, "1", "false", "");
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

    private MockMultipartFile workbookFileWithHiddenClient() throws IOException {
        return workbookFileWithClientNotDisplayed("истина", true);
    }

    private MockMultipartFile workbookFileWithClientNotDisplayed(String notDisplayed, boolean includeNotDisplayedColumn) throws IOException {
        Workbook workbook = new XSSFWorkbook();
        createSheet(workbook, "Organizations", "code", "short_name", "full_name");
        if (includeNotDisplayedColumn) {
            createSheet(workbook, "Clients", "code", "organization_code", "short_name", "full_name", "not_displayed");
        } else {
            createSheet(workbook, "Clients", "code", "organization_code", "short_name", "full_name");
        }
        createSheet(workbook, "Projects", "code", "organization_code", "client_code", "short_name", "full_name", "description", "completed");
        createSheet(workbook, "SoftwareProducts", "code", "short_name", "full_name");
        createSheet(workbook, "Tasks", "code", "organization_code", "client_code", "project_code", "software_product_code", "task_number", "name", "created_at", "comment", "estimated_hours", "completed", "task_link");
        createSheet(workbook, "TimeEntries", "task_code", "entry_date", "hours", "comment");

        appendRow(workbook.getSheet("Organizations"), "ORG1", "Org 1", "Organization 1");
        if (includeNotDisplayedColumn) {
            appendRow(workbook.getSheet("Clients"), "CLIENT1", "ORG1", "Client 1", "Client Full 1", notDisplayed);
        } else {
            appendRow(workbook.getSheet("Clients"), "CLIENT1", "ORG1", "Client 1", "Client Full 1");
        }
        appendRow(workbook.getSheet("Projects"), "PROJECT1", "ORG1", "CLIENT1", "Project 1", "Project Full 1", "Project description", "false");
        appendRow(workbook.getSheet("SoftwareProducts"), "PRODUCT1", "Product 1", "Product Full 1");
        appendRow(workbook.getSheet("Tasks"), "TASK1", "ORG1", "CLIENT1", "PROJECT1", "PRODUCT1", "TASK-1", "Task 1", "2026-05-20", "", "1", "false", "");
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
