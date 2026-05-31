package com.kzhastkou.devproductivityplatform.service;

import com.kzhastkou.devproductivityplatform.dto.ExcelImportCounts;
import com.kzhastkou.devproductivityplatform.dto.ExcelImportIssue;
import com.kzhastkou.devproductivityplatform.dto.ExcelImportResult;
import com.kzhastkou.devproductivityplatform.dto.ExcelImportSchemaResponse;
import com.kzhastkou.devproductivityplatform.dto.ExcelImportSheetSchema;
import com.kzhastkou.devproductivityplatform.dto.ExcelImportStatus;
import com.kzhastkou.devproductivityplatform.dto.ExcelImportValidationResult;
import com.kzhastkou.devproductivityplatform.entity.Client;
import com.kzhastkou.devproductivityplatform.entity.Developer;
import com.kzhastkou.devproductivityplatform.entity.Organization;
import com.kzhastkou.devproductivityplatform.entity.Project;
import com.kzhastkou.devproductivityplatform.entity.SoftwareProduct;
import com.kzhastkou.devproductivityplatform.entity.Task;
import com.kzhastkou.devproductivityplatform.entity.TimeEntry;
import com.kzhastkou.devproductivityplatform.exception.NotFoundException;
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
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExcelImportService {

    private static final List<String> REPLACED_DATA = List.of(
            "Organizations",
            "Clients",
            "Projects",
            "Software Products",
            "Tasks",
            "Time Entries"
    );

    private static final List<ExcelImportSheetSchema> SHEET_SCHEMAS = List.of(
            sheet("Organizations",
                    List.of("code", "short_name"),
                    List.of("full_name")),
            sheet("Clients",
                    List.of("code", "organization_code", "short_name"),
                    List.of("full_name")),
            sheet("Projects",
                    List.of("code", "organization_code", "client_code", "short_name", "full_name"),
                    List.of("description", "completed")),
            sheet("SoftwareProducts",
                    List.of("code", "short_name"),
                    List.of("full_name")),
            sheet("Tasks",
                    List.of("code", "organization_code", "client_code", "project_code", "software_product_code", "task_number", "name"),
                    List.of("comment", "description", "implementation_details", "estimated_hours", "completed", "task_link")),
            sheet("TimeEntries",
                    List.of("task_code", "entry_date", "hours"),
                    List.of("comment"))
    );

    private static final Map<String, ExcelImportSheetSchema> SCHEMA_BY_SHEET = SHEET_SCHEMAS.stream()
            .collect(LinkedHashMap::new, (map, schema) -> map.put(schema.getSheetName(), schema), LinkedHashMap::putAll);

    private final DeveloperRepository developerRepository;
    private final OrganizationRepository organizationRepository;
    private final ClientRepository clientRepository;
    private final ProjectRepository projectRepository;
    private final SoftwareProductRepository softwareProductRepository;
    private final TaskRepository taskRepository;
    private final TimeEntryRepository timeEntryRepository;
    private final UserSettingsRepository userSettingsRepository;
    private final PlatformTransactionManager transactionManager;

    public ExcelImportSchemaResponse getSchema() {
        return ExcelImportSchemaResponse.builder()
                .warning("Import will replace all current data for the current user account.")
                .replacedData(REPLACED_DATA)
                .sheets(SHEET_SCHEMAS)
                .build();
    }

    @Transactional(readOnly = true)
    public ExcelImportValidationResult validate(MultipartFile file, Long developerId) {
        return parseAndValidate(file).result;
    }

    public ExcelImportResult importData(MultipartFile file, Long developerId) {
        ParsedWorkbook parsed = parseAndValidate(file);
        ExcelImportValidationResult validation = parsed.result;

        if (validation.getStatus() != ExcelImportStatus.ALL_VALID) {
            return ExcelImportResult.builder()
                    .imported(false)
                    .importedRowsCount(ExcelImportCounts.builder().build())
                    .validation(validation)
                    .build();
        }

        try {
            ExcelImportCounts counts = replaceUserData(developerId, parsed);

            return ExcelImportResult.builder()
                    .imported(true)
                    .importedRowsCount(counts)
                    .validation(validation)
                    .build();
        } catch (DataIntegrityViolationException error) {
            return importFailedResult(toUniqueConstraintValidation(error));
        }
    }

    private ParsedWorkbook parseAndValidate(MultipartFile file) {
        ParsedWorkbook parsed = new ParsedWorkbook();

        if (file == null || file.isEmpty()) {
            parsed.addError(null, null, null, "Excel file is required.");
            parsed.finish();
            return parsed;
        }

        String fileName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
            parsed.addError(null, null, null, "File must be an Excel .xlsx or .xls file.");
            parsed.finish();
            return parsed;
        }

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            validateSheetsAndColumns(workbook, parsed);
            if (!parsed.errors.isEmpty()) {
                parsed.finish();
                return parsed;
            }

            readRows(workbook, parsed);
            parsed.markRowsWithErrorsInvalid();
            validateDuplicates(parsed);
            validateReferences(parsed);
            validateUrlWarnings(parsed);
            parsed.finish();
            return parsed;
        } catch (IOException | RuntimeException error) {
            parsed.addError(null, null, null, "File could not be opened as Excel.");
            parsed.finish();
            return parsed;
        }
    }

    private void validateSheetsAndColumns(Workbook workbook, ParsedWorkbook parsed) {
        for (ExcelImportSheetSchema schema : SHEET_SCHEMAS) {
            String sheetName = schema.getSheetName();
            Sheet sheet = workbook.getSheet(sheetName);
            if (sheet == null) {
                parsed.addError(sheetName, null, null, "Required sheet is missing.");
                continue;
            }

            Row headerRow = sheet.getRow(0);
            Map<String, Integer> headers = readHeaders(headerRow);
            for (String column : schema.getRequiredColumns()) {
                if (!headers.containsKey(column)) {
                    parsed.addError(sheetName, 1, column, "Required column is missing.");
                }
            }
            parsed.headers.put(sheetName, headers);
        }
    }

    private void readRows(Workbook workbook, ParsedWorkbook parsed) {
        readOrganizations(workbook.getSheet("Organizations"), parsed);
        readClients(workbook.getSheet("Clients"), parsed);
        readProjects(workbook.getSheet("Projects"), parsed);
        readSoftwareProducts(workbook.getSheet("SoftwareProducts"), parsed);
        readTasks(workbook.getSheet("Tasks"), parsed);
        readTimeEntries(workbook.getSheet("TimeEntries"), parsed);
    }

    private void readOrganizations(Sheet sheet, ParsedWorkbook parsed) {
        forEachDataRow(sheet, parsed.headers.get("Organizations"), row -> {
            OrganizationRow item = new OrganizationRow(row.rowNumber);
            item.code = row.value("code");
            item.shortName = row.value("short_name");
            item.fullName = row.value("full_name");
            validateRequired(row, item, parsed);
            parsed.organizations.add(item);
            parsed.organizationByCode.putIfAbsent(item.code, item);
        });
    }

    private void readClients(Sheet sheet, ParsedWorkbook parsed) {
        forEachDataRow(sheet, parsed.headers.get("Clients"), row -> {
            ClientRow item = new ClientRow(row.rowNumber);
            item.code = row.value("code");
            item.organizationCode = row.value("organization_code");
            item.shortName = row.value("short_name");
            item.fullName = row.value("full_name");
            validateRequired(row, item, parsed);
            parsed.clients.add(item);
            parsed.clientByCode.putIfAbsent(item.code, item);
        });
    }

    private void readProjects(Sheet sheet, ParsedWorkbook parsed) {
        forEachDataRow(sheet, parsed.headers.get("Projects"), row -> {
            ProjectRow item = new ProjectRow(row.rowNumber);
            item.code = row.value("code");
            item.organizationCode = row.value("organization_code");
            item.clientCode = row.value("client_code");
            item.shortName = row.value("short_name");
            item.fullName = row.value("full_name");
            item.description = row.value("description");
            item.completed = parseBoolean(row, "Projects", "completed", parsed, true);
            validateRequired(row, item, parsed);
            parsed.projects.add(item);
            parsed.projectByCode.putIfAbsent(item.code, item);
        });
    }

    private void readSoftwareProducts(Sheet sheet, ParsedWorkbook parsed) {
        forEachDataRow(sheet, parsed.headers.get("SoftwareProducts"), row -> {
            SoftwareProductRow item = new SoftwareProductRow(row.rowNumber);
            item.code = row.value("code");
            item.shortName = row.value("short_name");
            item.fullName = row.value("full_name");
            validateRequired(row, item, parsed);
            parsed.softwareProducts.add(item);
            parsed.softwareProductByCode.putIfAbsent(item.code, item);
        });
    }

    private void readTasks(Sheet sheet, ParsedWorkbook parsed) {
        forEachDataRow(sheet, parsed.headers.get("Tasks"), row -> {
            TaskRow item = new TaskRow(row.rowNumber);
            item.code = row.value("code");
            item.organizationCode = row.value("organization_code");
            item.clientCode = row.value("client_code");
            item.projectCode = row.value("project_code");
            item.softwareProductCode = row.value("software_product_code");
            item.taskNumber = row.value("task_number");
            item.name = row.value("name");
            item.comment = row.value("comment");
            item.description = row.value("description");
            item.implementationDetails = row.value("implementation_details");
            item.estimatedHours = parseNonNegativeDouble(row, "Tasks", "estimated_hours", parsed, true);
            item.completed = parseBoolean(row, "Tasks", "completed", parsed, true);
            item.taskLink = row.value("task_link");
            validateRequired(row, item, parsed);
            parsed.tasks.add(item);
            parsed.taskByCode.putIfAbsent(item.code, item);
        });
    }

    private void readTimeEntries(Sheet sheet, ParsedWorkbook parsed) {
        forEachDataRow(sheet, parsed.headers.get("TimeEntries"), row -> {
            TimeEntryRow item = new TimeEntryRow(row.rowNumber);
            item.taskCode = row.value("task_code");
            item.entryDate = parseDate(row, "TimeEntries", "entry_date", parsed);
            item.hours = parsePositiveDouble(row, "TimeEntries", "hours", parsed, true);
            item.comment = row.value("comment");
            validateRequired(row, item, parsed);
            parsed.timeEntries.add(item);
        });
    }

    private void validateRequired(SheetRow row, ImportRow item, ParsedWorkbook parsed) {
        for (String field : SCHEMA_BY_SHEET.get(item.sheet).getRequiredColumns()) {
            if (isBlank(row.value(field))) {
                item.valid = false;
                parsed.addError(item.sheet, item.rowNumber, field, "Required field is empty.");
            }
        }
    }

    private void validateDuplicates(ParsedWorkbook parsed) {
        validateDuplicateCodes(parsed.organizations, "Organizations", "code", parsed);
        validateDuplicateCodes(parsed.clients, "Clients", "code", parsed);
        validateDuplicateClientShortNames(parsed);
        validateDuplicateCodes(parsed.projects, "Projects", "code", parsed);
        validateDuplicateProjectShortNames(parsed);
        validateDuplicateCodes(parsed.softwareProducts, "SoftwareProducts", "code", parsed);
        validateDuplicateCodes(parsed.tasks, "Tasks", "code", parsed);

    }

    private <T extends CodedRow> void validateDuplicateCodes(List<T> rows, String sheet, String field, ParsedWorkbook parsed) {
        validateDuplicateValues(rows, sheet, field, CodedRow::code, parsed);
    }

    private <T extends ImportRow> void validateDuplicateValues(List<T> rows, String sheet, String field, ValueReader<T> valueReader, ParsedWorkbook parsed) {
        Map<String, T> seen = new HashMap<>();
        for (T row : rows) {
            String value = valueReader.value(row);
            if (isBlank(value)) {
                continue;
            }

            T previous = seen.putIfAbsent(value, row);
            if (previous != null) {
                row.valid = false;
                parsed.addError(sheet, row.rowNumber, field, "Duplicate value '" + value + "'.");
            }
        }
    }

    private void validateDuplicateClientShortNames(ParsedWorkbook parsed) {
        Map<String, ClientRow> seen = new HashMap<>();
        for (ClientRow row : parsed.clients) {
            if (isBlank(row.shortName)) {
                continue;
            }

            ClientRow previous = seen.putIfAbsent(row.shortName, row);
            if (previous != null) {
                row.valid = false;
                parsed.addError("Clients", row.rowNumber, "short_name", "Duplicate client short_name '" + row.shortName + "'.");
            }
        }
    }

    private void validateDuplicateProjectShortNames(ParsedWorkbook parsed) {
        Map<String, ProjectRow> seen = new HashMap<>();
        for (ProjectRow row : parsed.projects) {
            if (isBlank(row.organizationCode) || isBlank(row.clientCode) || isBlank(row.shortName)) {
                continue;
            }

            String key = row.organizationCode + "\u0000" + row.clientCode + "\u0000" + row.shortName;
            ProjectRow previous = seen.putIfAbsent(key, row);
            if (previous != null) {
                row.valid = false;
                parsed.addError("Projects", row.rowNumber, "short_name",
                        "Duplicate project short_name '" + row.shortName
                                + "' for organization_code '" + row.organizationCode
                                + "' and client_code '" + row.clientCode + "'.");
            }
        }
    }

    private void validateReferences(ParsedWorkbook parsed) {
        for (ClientRow row : parsed.clients) {
            OrganizationRow organization = parsed.organizationByCode.get(row.organizationCode);
            if (organization == null || !organization.valid) {
                invalidate(row, parsed, "organization_code", "Organization " + safe(row.organizationCode) + " does not exist or is invalid.");
            }
        }

        for (ProjectRow row : parsed.projects) {
            OrganizationRow organization = parsed.organizationByCode.get(row.organizationCode);
            ClientRow client = parsed.clientByCode.get(row.clientCode);
            if (organization == null || !organization.valid) {
                invalidate(row, parsed, "organization_code", "Organization " + safe(row.organizationCode) + " does not exist or is invalid.");
            }
            if (client == null || !client.valid) {
                invalidate(row, parsed, "client_code", "Client " + safe(row.clientCode) + " does not exist or is invalid.");
            } else if (organization != null && organization.valid && !Objects.equals(client.organizationCode, row.organizationCode)) {
                invalidate(row, parsed, "client_code", "Client " + row.clientCode + " does not belong to organization " + row.organizationCode + ".");
            }
        }

        for (TaskRow row : parsed.tasks) {
            OrganizationRow organization = parsed.organizationByCode.get(row.organizationCode);
            ClientRow client = parsed.clientByCode.get(row.clientCode);
            ProjectRow project = parsed.projectByCode.get(row.projectCode);
            SoftwareProductRow softwareProduct = parsed.softwareProductByCode.get(row.softwareProductCode);
            if (organization == null || !organization.valid) {
                invalidate(row, parsed, "organization_code", "Organization " + safe(row.organizationCode) + " does not exist or is invalid.");
            }
            if (client == null || !client.valid) {
                invalidate(row, parsed, "client_code", "Client " + safe(row.clientCode) + " does not exist or is invalid.");
            } else if (organization != null && organization.valid && !Objects.equals(client.organizationCode, row.organizationCode)) {
                invalidate(row, parsed, "client_code", "Client " + row.clientCode + " does not belong to organization " + row.organizationCode + ".");
            }
            if (project == null || !project.valid) {
                invalidate(row, parsed, "project_code", "Project " + safe(row.projectCode) + " does not exist or is invalid.");
            } else {
                if (organization != null && organization.valid && !Objects.equals(project.organizationCode, row.organizationCode)) {
                    invalidate(row, parsed, "project_code", "Project " + row.projectCode + " does not belong to organization " + row.organizationCode + ".");
                }
                if (client != null && client.valid && !Objects.equals(project.clientCode, row.clientCode)) {
                    invalidate(row, parsed, "project_code", "Project " + row.projectCode + " does not belong to client " + row.clientCode + ".");
                }
            }
            if (softwareProduct == null || !softwareProduct.valid) {
                invalidate(row, parsed, "software_product_code", "Software product " + safe(row.softwareProductCode) + " does not exist or is invalid.");
            }
        }

        for (TimeEntryRow row : parsed.timeEntries) {
            TaskRow task = parsed.taskByCode.get(row.taskCode);
            if (task == null || !task.valid) {
                invalidate(row, parsed, "task_code", "Task " + safe(row.taskCode) + " does not exist or is invalid.");
            }
        }
    }

    private void validateUrlWarnings(ParsedWorkbook parsed) {
        for (TaskRow row : parsed.tasks) {
            if (isBlank(row.taskLink)) {
                continue;
            }

            try {
                URI uri = new URI(row.taskLink);
                if (isBlank(uri.getScheme()) || isBlank(uri.getHost())) {
                    parsed.addWarning("Tasks", row.rowNumber, "task_link", "Task link is not a valid absolute URL.");
                }
            } catch (URISyntaxException error) {
                parsed.addWarning("Tasks", row.rowNumber, "task_link", "Task link is not a valid URL.");
            }
        }
    }

    private static ExcelImportSheetSchema sheet(String sheetName, List<String> requiredColumns, List<String> optionalColumns) {
        return ExcelImportSheetSchema.builder()
                .sheetName(sheetName)
                .requiredColumns(requiredColumns)
                .optionalColumns(optionalColumns)
                .build();
    }

    private ExcelImportCounts replaceUserData(Long developerId, ParsedWorkbook parsed) {
        runInNewTransaction(() -> deleteExistingUserData(developerId));
        return runInNewTransaction(() -> importParsedData(developerId, parsed));
    }

    private void deleteExistingUserData(Long developerId) {
        Developer developer = developerRepository.findById(developerId)
                .orElseThrow(() -> new NotFoundException("Developer not found"));
        ExistingDataCounts counts = readExistingDataCounts(developerId);

        log.info("Deleting existing data for developerId={}", developerId);

        userSettingsRepository.findByDeveloperId(developerId).ifPresent(settings -> {
            settings.setCurrentOrganization(null);
            userSettingsRepository.save(settings);
        });
        developer.setOrganization(null);
        developerRepository.save(developer);
        userSettingsRepository.flush();
        developerRepository.flush();

        timeEntryRepository.deleteAll(timeEntryRepository.findByDeveloperId(developerId));
        timeEntryRepository.flush();
        taskRepository.deleteAll(taskRepository.findByDeveloperIdOrderByIdAsc(developerId));
        taskRepository.flush();
        softwareProductRepository.deleteAll(softwareProductRepository.findByDeveloperIdOrderByIdAsc(developerId));
        softwareProductRepository.flush();
        projectRepository.deleteAll(projectRepository.findByDeveloperIdOrderByIdAsc(developerId));
        projectRepository.flush();
        clientRepository.deleteAll(clientRepository.findByDeveloperIdOrderByIdAsc(developerId));
        clientRepository.flush();
        organizationRepository.deleteAll(organizationRepository.findByDeveloperIdOrderByIdAsc(developerId));
        organizationRepository.flush();

        verifyUserDataDeleted(developerId);
        log.info("""
                Deleted existing data for developerId={}
                - Organizations: {}
                - Clients: {}
                - Projects: {}
                - Software Products: {}
                - Tasks: {}
                - Time Entries: {}
                """,
                developerId,
                counts.organizations(),
                counts.clients(),
                counts.projects(),
                counts.softwareProducts(),
                counts.tasks(),
                counts.timeEntries());
    }

    private ExcelImportCounts importParsedData(Long developerId, ParsedWorkbook parsed) {
        Developer developer = developerRepository.findById(developerId)
                .orElseThrow(() -> new NotFoundException("Developer not found"));
        Map<String, Organization> organizations = new LinkedHashMap<>();
        for (OrganizationRow row : parsed.organizations.stream().filter(ImportRow::valid).toList()) {
            Organization organization = organizationRepository.save(Organization.builder()
                    .developer(developer)
                    .shortName(row.shortName)
                    .fullName(defaultString(row.fullName, row.shortName))
                    .build());
            organizations.put(row.code, organization);
        }

        Map<String, Client> clients = new LinkedHashMap<>();
        for (ClientRow row : parsed.clients.stream().filter(ImportRow::valid).toList()) {
            Organization organization = organizations.get(row.organizationCode);
            if (organization == null) {
                continue;
            }
            Client client = clientRepository.save(Client.builder()
                    .developer(developer)
                    .organization(organization)
                    .shortName(row.shortName)
                    .fullName(defaultString(row.fullName, row.shortName))
                    .build());
            clients.put(row.code, client);
        }
        clientRepository.flush();

        Map<String, Project> projects = new LinkedHashMap<>();
        for (ProjectRow row : parsed.projects.stream().filter(ImportRow::valid).toList()) {
            Organization organization = organizations.get(row.organizationCode);
            Client client = clients.get(row.clientCode);
            if (organization == null || client == null) {
                continue;
            }
            Project project = projectRepository.save(Project.builder()
                    .developer(developer)
                    .organization(organization)
                    .client(client)
                    .shortName(row.shortName)
                    .fullName(row.fullName)
                    .description(row.description)
                    .completed(Boolean.TRUE.equals(row.completed))
                    .build());
            projects.put(row.code, project);
        }
        projectRepository.flush();

        Map<String, SoftwareProduct> softwareProducts = new LinkedHashMap<>();
        for (SoftwareProductRow row : parsed.softwareProducts.stream().filter(ImportRow::valid).toList()) {
            SoftwareProduct product = softwareProductRepository.save(SoftwareProduct.builder()
                    .developer(developer)
                    .shortName(row.shortName)
                    .fullName(defaultString(row.fullName, row.shortName))
                    .build());
            softwareProducts.put(row.code, product);
        }
        softwareProductRepository.flush();

        Map<String, Task> tasks = new LinkedHashMap<>();
        for (TaskRow row : parsed.tasks.stream().filter(ImportRow::valid).toList()) {
            Organization organization = organizations.get(row.organizationCode);
            Client client = clients.get(row.clientCode);
            Project project = projects.get(row.projectCode);
            SoftwareProduct softwareProduct = softwareProducts.get(row.softwareProductCode);
            if (organization == null || client == null || project == null || softwareProduct == null) {
                continue;
            }
            Task task = taskRepository.save(Task.builder()
                    .developer(developer)
                    .organization(organization)
                    .client(client)
                    .project(project)
                    .softwareProduct(softwareProduct)
                    .taskNumber(row.taskNumber)
                    .name(row.name)
                    .comment(row.comment)
                    .description(row.description)
                    .implementationDetails(row.implementationDetails)
                    .estimatedHours(row.estimatedHours)
                    .completed(Boolean.TRUE.equals(row.completed))
                    .taskLink(row.taskLink)
                    .createdAt(LocalDate.now())
                    .build());
            tasks.put(row.code, task);
        }
        taskRepository.flush();

        int savedTimeEntries = 0;
        for (TimeEntryRow row : parsed.timeEntries.stream().filter(ImportRow::valid).toList()) {
            Task task = tasks.get(row.taskCode);
            if (task == null) {
                continue;
            }
            timeEntryRepository.save(TimeEntry.builder()
                    .developer(developer)
                    .organization(task.getOrganization())
                    .task(task)
                    .date(row.entryDate)
                    .hours(row.hours)
                    .comment(row.comment)
                    .build());
            savedTimeEntries++;
        }
        timeEntryRepository.flush();

        Organization currentOrganization = organizations.values().stream().findFirst().orElse(null);
        if (currentOrganization != null) {
            developer.setOrganization(currentOrganization);
            developerRepository.save(developer);
        }
        developerRepository.flush();

        return ExcelImportCounts.builder()
                .organizations(organizations.size())
                .clients(clients.size())
                .projects(projects.size())
                .softwareProducts(softwareProducts.size())
                .tasks(tasks.size())
                .timeEntries(savedTimeEntries)
                .build();
    }

    private ExistingDataCounts readExistingDataCounts(Long developerId) {
        return new ExistingDataCounts(
                organizationRepository.findByDeveloperIdOrderByIdAsc(developerId).size(),
                clientRepository.findByDeveloperIdOrderByIdAsc(developerId).size(),
                projectRepository.findByDeveloperIdOrderByIdAsc(developerId).size(),
                softwareProductRepository.findByDeveloperIdOrderByIdAsc(developerId).size(),
                taskRepository.findByDeveloperIdOrderByIdAsc(developerId).size(),
                timeEntryRepository.findByDeveloperId(developerId).size()
        );
    }

    private void verifyUserDataDeleted(Long developerId) {
        ExistingDataCounts remaining = readExistingDataCounts(developerId);
        if (remaining.total() != 0) {
            throw new RuntimeException("Unable to delete all existing data before import.");
        }
    }

    private <T> T runInNewTransaction(TransactionCallback<T> callback) {
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        return template.execute(status -> callback.execute());
    }

    private void runInNewTransaction(Runnable callback) {
        runInNewTransaction(() -> {
            callback.run();
            return null;
        });
    }

    private ExcelImportResult importFailedResult(ExcelImportValidationResult validation) {
        return ExcelImportResult.builder()
                .imported(false)
                .importedRowsCount(ExcelImportCounts.builder().build())
                .validation(validation)
                .build();
    }

    private ExcelImportValidationResult toUniqueConstraintValidation(DataIntegrityViolationException error) {
        String message = resolveUniqueConstraintMessage(error);
        return ExcelImportValidationResult.builder()
                .status(ExcelImportStatus.INVALID)
                .counts(ExcelImportCounts.builder().build())
                .validRowsCount(ExcelImportCounts.builder().build())
                .errorRowsCount(1)
                .errors(List.of(ExcelImportIssue.builder()
                        .message(message)
                        .build()))
                .warnings(List.of())
                .build();
    }

    private String resolveUniqueConstraintMessage(DataIntegrityViolationException error) {
        String text = error.getMostSpecificCause() != null
                ? error.getMostSpecificCause().getMessage()
                : error.getMessage();

        if (text != null && text.contains("ux_clients_developer_short_name")) {
            return "Client short_name must be unique for the current user. Check the Clients sheet for duplicate short_name values.";
        }

        if (text != null && text.contains("ux_projects_dev_org_client_short_name")) {
            return "Project short_name must be unique for the same organization and client. Check duplicate Projects rows with the same organization_code, client_code, and short_name.";
        }

        if (text != null && text.toLowerCase(Locale.ROOT).contains("duplicate key")) {
            return "Import failed because the Excel data violates a unique database constraint. Check duplicate short_name values in the import file.";
        }

        return "Import failed because the Excel data violates a database constraint.";
    }

    private Map<String, Integer> readHeaders(Row headerRow) {
        Map<String, Integer> headers = new HashMap<>();
        if (headerRow == null) {
            return headers;
        }

        DataFormatter formatter = new DataFormatter();
        for (Cell cell : headerRow) {
            String value = normalizeHeader(formatter.formatCellValue(cell));
            if (!isBlank(value)) {
                headers.put(value, cell.getColumnIndex());
            }
        }
        return headers;
    }

    private void forEachDataRow(Sheet sheet, Map<String, Integer> headers, RowConsumer consumer) {
        if (sheet == null || headers == null) {
            return;
        }

        for (int rowIndex = 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
            SheetRow row = new SheetRow(sheet.getSheetName(), sheet.getRow(rowIndex), rowIndex + 1, headers);
            if (!row.isEmpty()) {
                consumer.accept(row);
            }
        }
    }

    private Boolean parseBoolean(SheetRow row, String sheet, String field, ParsedWorkbook parsed, boolean defaultFalse) {
        String value = row.value(field);
        if (isBlank(value)) {
            return defaultFalse ? Boolean.FALSE : null;
        }

        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (List.of("true", "yes", "1").contains(normalized)) {
            return Boolean.TRUE;
        }
        if (List.of("false", "no", "0").contains(normalized)) {
            return Boolean.FALSE;
        }

        parsed.addError(sheet, row.rowNumber, field, "Value must be TRUE/FALSE, Yes/No, or 1/0.");
        return defaultFalse ? Boolean.FALSE : null;
    }

    private Double parseNonNegativeDouble(SheetRow row, String sheet, String field, ParsedWorkbook parsed, boolean defaultZero) {
        String value = row.value(field);
        if (isBlank(value)) {
            return defaultZero ? 0.0 : null;
        }

        Double parsedValue = parseDoubleValue(value);
        if (parsedValue == null) {
            parsed.addError(sheet, row.rowNumber, field, "Value must be a number.");
            return defaultZero ? 0.0 : null;
        }
        if (parsedValue < 0) {
            parsed.addError(sheet, row.rowNumber, field, "Value must be greater than or equal to 0.");
        }
        return parsedValue;
    }

    private Double parsePositiveDouble(SheetRow row, String sheet, String field, ParsedWorkbook parsed, boolean max24) {
        String value = row.value(field);
        if (isBlank(value)) {
            return null;
        }

        Double parsedValue = parseDoubleValue(value);
        if (parsedValue == null) {
            parsed.addError(sheet, row.rowNumber, field, "Value must be a number.");
            return null;
        }
        if (parsedValue <= 0) {
            parsed.addError(sheet, row.rowNumber, field, "Value must be greater than 0.");
        }
        if (max24 && parsedValue > 24) {
            parsed.addError(sheet, row.rowNumber, field, "Value should not exceed 24.");
        }
        return parsedValue;
    }

    private LocalDate parseDate(SheetRow row, String sheet, String field, ParsedWorkbook parsed) {
        Cell cell = row.cell(field);
        if (cell != null && cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            return cell.getDateCellValue().toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        }

        String value = row.value(field);
        if (isBlank(value)) {
            return null;
        }

        try {
            return LocalDate.parse(value.trim());
        } catch (RuntimeException error) {
            parsed.addError(sheet, row.rowNumber, field, "Date must be an Excel date or yyyy-MM-dd.");
            return null;
        }
    }

    private Double parseDoubleValue(String value) {
        try {
            return Double.parseDouble(value.trim().replace(',', '.'));
        } catch (RuntimeException error) {
            return null;
        }
    }

    private void invalidate(ImportRow row, ParsedWorkbook parsed, String field, String message) {
        row.valid = false;
        parsed.addError(row.sheet, row.rowNumber, field, message);
    }

    private String normalizeHeader(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String safe(String value) {
        return isBlank(value) ? "<empty>" : value;
    }

    private String defaultString(String value, String fallback) {
        return isBlank(value) ? fallback : value;
    }

    private interface RowConsumer {
        void accept(SheetRow row);
    }

    private interface ValueReader<T> {
        String value(T row);
    }

    private interface TransactionCallback<T> {
        T execute();
    }

    private record ExistingDataCounts(
            int organizations,
            int clients,
            int projects,
            int softwareProducts,
            int tasks,
            int timeEntries
    ) {
        private int total() {
            return organizations + clients + projects + softwareProducts + tasks + timeEntries;
        }
    }

    private static class SheetRow {
        private final String sheet;
        private final Row row;
        private final int rowNumber;
        private final Map<String, Integer> headers;
        private final DataFormatter formatter = new DataFormatter();

        private SheetRow(String sheet, Row row, int rowNumber, Map<String, Integer> headers) {
            this.sheet = sheet;
            this.row = row;
            this.rowNumber = rowNumber;
            this.headers = headers;
        }

        private String value(String field) {
            Cell cell = cell(field);
            return cell == null ? "" : formatter.formatCellValue(cell).trim();
        }

        private Cell cell(String field) {
            Integer column = headers.get(field);
            return row == null || column == null ? null : row.getCell(column);
        }

        private boolean isEmpty() {
            if (row == null) {
                return true;
            }

            for (Integer column : headers.values()) {
                Cell cell = row.getCell(column);
                if (cell != null && !formatter.formatCellValue(cell).trim().isEmpty()) {
                    return false;
                }
            }
            return true;
        }
    }

    private static class ParsedWorkbook {
        private final Map<String, Map<String, Integer>> headers = new HashMap<>();
        private final List<ExcelImportIssue> errors = new ArrayList<>();
        private final List<ExcelImportIssue> warnings = new ArrayList<>();
        private final List<OrganizationRow> organizations = new ArrayList<>();
        private final List<ClientRow> clients = new ArrayList<>();
        private final List<ProjectRow> projects = new ArrayList<>();
        private final List<SoftwareProductRow> softwareProducts = new ArrayList<>();
        private final List<TaskRow> tasks = new ArrayList<>();
        private final List<TimeEntryRow> timeEntries = new ArrayList<>();
        private final Map<String, OrganizationRow> organizationByCode = new HashMap<>();
        private final Map<String, ClientRow> clientByCode = new HashMap<>();
        private final Map<String, ProjectRow> projectByCode = new HashMap<>();
        private final Map<String, SoftwareProductRow> softwareProductByCode = new HashMap<>();
        private final Map<String, TaskRow> taskByCode = new HashMap<>();
        private ExcelImportValidationResult result;

        private void addError(String sheet, Integer rowNumber, String field, String message) {
            errors.add(ExcelImportIssue.builder()
                    .sheet(sheet)
                    .rowNumber(rowNumber)
                    .field(field)
                    .message(message)
                    .build());
        }

        private void addWarning(String sheet, Integer rowNumber, String field, String message) {
            warnings.add(ExcelImportIssue.builder()
                    .sheet(sheet)
                    .rowNumber(rowNumber)
                    .field(field)
                    .message(message)
                    .build());
        }

        private void finish() {
            markRowsWithErrorsInvalid();
            ExcelImportCounts counts = ExcelImportCounts.builder()
                    .organizations((int) organizations.stream().filter(ImportRow::valid).count())
                    .clients((int) clients.stream().filter(ImportRow::valid).count())
                    .projects((int) projects.stream().filter(ImportRow::valid).count())
                    .softwareProducts((int) softwareProducts.stream().filter(ImportRow::valid).count())
                    .tasks((int) tasks.stream().filter(ImportRow::valid).count())
                    .timeEntries((int) timeEntries.stream().filter(ImportRow::valid).count())
                    .build();
            if (errors.isEmpty() && counts.total() == 0) {
                addError(null, null, null, "The file contains no data to import.");
            }
            int errorRowsCount = countErrorRows();
            ExcelImportStatus status = errors.isEmpty()
                    ? ExcelImportStatus.ALL_VALID
                    : ExcelImportStatus.INVALID;

            result = ExcelImportValidationResult.builder()
                    .status(status)
                    .counts(counts)
                    .validRowsCount(counts)
                    .errorRowsCount(errorRowsCount)
                    .errors(errors)
                    .warnings(warnings)
                    .build();
        }

        private int countErrorRows() {
            Set<String> rows = new HashSet<>();
            for (ExcelImportIssue error : errors) {
                rows.add((error.getSheet() == null ? "" : error.getSheet()) + ":" + (error.getRowNumber() == null ? "" : error.getRowNumber()));
            }
            return rows.size();
        }

        private void markRowsWithErrorsInvalid() {
            for (ExcelImportIssue error : errors) {
                if (error.getSheet() == null || error.getRowNumber() == null) {
                    continue;
                }

                rowsForSheet(error.getSheet()).stream()
                        .filter(row -> row.rowNumber == error.getRowNumber())
                        .forEach(row -> row.valid = false);
            }
        }

        private List<? extends ImportRow> rowsForSheet(String sheet) {
            return switch (sheet) {
                case "Organizations" -> organizations;
                case "Clients" -> clients;
                case "Projects" -> projects;
                case "SoftwareProducts" -> softwareProducts;
                case "Tasks" -> tasks;
                case "TimeEntries" -> timeEntries;
                default -> List.of();
            };
        }
    }

    private static class ImportRow {
        protected final String sheet;
        protected final int rowNumber;
        protected boolean valid = true;

        private ImportRow(String sheet, int rowNumber) {
            this.sheet = sheet;
            this.rowNumber = rowNumber;
        }

        private boolean valid() {
            return valid;
        }
    }

    private static class CodedRow extends ImportRow {
        protected String code;

        private CodedRow(String sheet, int rowNumber) {
            super(sheet, rowNumber);
        }

        private String code() {
            return code;
        }
    }

    private static class OrganizationRow extends CodedRow {
        private String shortName;
        private String fullName;

        private OrganizationRow(int rowNumber) {
            super("Organizations", rowNumber);
        }

        private String shortName() {
            return shortName;
        }
    }

    private static class ClientRow extends CodedRow {
        private String organizationCode;
        private String shortName;
        private String fullName;

        private ClientRow(int rowNumber) {
            super("Clients", rowNumber);
        }

        private String shortName() {
            return shortName;
        }
    }

    private static class ProjectRow extends CodedRow {
        private String organizationCode;
        private String clientCode;
        private String shortName;
        private String fullName;
        private String description;
        private Boolean completed;

        private ProjectRow(int rowNumber) {
            super("Projects", rowNumber);
        }
    }

    private static class SoftwareProductRow extends CodedRow {
        private String shortName;
        private String fullName;

        private SoftwareProductRow(int rowNumber) {
            super("SoftwareProducts", rowNumber);
        }

        private String shortName() {
            return shortName;
        }
    }

    private static class TaskRow extends CodedRow {
        private String organizationCode;
        private String clientCode;
        private String projectCode;
        private String softwareProductCode;
        private String taskNumber;
        private String name;
        private String comment;
        private String description;
        private String implementationDetails;
        private Double estimatedHours;
        private Boolean completed;
        private String taskLink;

        private TaskRow(int rowNumber) {
            super("Tasks", rowNumber);
        }
    }

    private static class TimeEntryRow extends ImportRow {
        private String taskCode;
        private LocalDate entryDate;
        private Double hours;
        private String comment;

        private TimeEntryRow(int rowNumber) {
            super("TimeEntries", rowNumber);
        }
    }
}
