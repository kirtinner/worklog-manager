package com.kzhastkou.devproductivityplatform.service;

import com.kzhastkou.devproductivityplatform.dto.ExcelImportCounts;
import com.kzhastkou.devproductivityplatform.dto.ExcelImportIssue;
import com.kzhastkou.devproductivityplatform.dto.ExcelImportResult;
import com.kzhastkou.devproductivityplatform.dto.ExcelImportStatus;
import com.kzhastkou.devproductivityplatform.dto.ExcelImportValidationResult;
import com.kzhastkou.devproductivityplatform.entity.Client;
import com.kzhastkou.devproductivityplatform.entity.Developer;
import com.kzhastkou.devproductivityplatform.entity.Organization;
import com.kzhastkou.devproductivityplatform.entity.Project;
import com.kzhastkou.devproductivityplatform.entity.SoftwareProduct;
import com.kzhastkou.devproductivityplatform.entity.Task;
import com.kzhastkou.devproductivityplatform.entity.TimeEntry;
import com.kzhastkou.devproductivityplatform.entity.UserSettings;
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
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ExcelImportService {

    private static final List<String> REQUIRED_SHEETS = List.of(
            "UserSettings",
            "Organizations",
            "Clients",
            "Projects",
            "SoftwareProducts",
            "Tasks",
            "TimeEntries"
    );

    private static final Map<String, List<String>> REQUIRED_COLUMNS = Map.of(
            "UserSettings", List.of("daily_hours_limit", "current_organization_code", "reports_save_directory"),
            "Organizations", List.of("code", "short_name", "full_name"),
            "Clients", List.of("code", "organization_code", "short_name", "full_name"),
            "Projects", List.of("code", "organization_code", "client_code", "name", "completed"),
            "SoftwareProducts", List.of("code", "short_name", "full_name"),
            "Tasks", List.of("code", "organization_code", "client_code", "project_code", "software_product_code", "task_number", "name", "comment", "estimated_hours", "completed", "task_link"),
            "TimeEntries", List.of("task_code", "entry_date", "hours", "comment")
    );

    private static final Map<String, List<String>> REQUIRED_FIELDS = Map.of(
            "UserSettings", List.of("daily_hours_limit", "current_organization_code"),
            "Organizations", List.of("code", "short_name"),
            "Clients", List.of("code", "organization_code", "short_name"),
            "Projects", List.of("code", "organization_code", "client_code", "name"),
            "SoftwareProducts", List.of("code", "short_name"),
            "Tasks", List.of("code", "organization_code", "client_code", "project_code", "software_product_code", "task_number", "name"),
            "TimeEntries", List.of("task_code", "entry_date", "hours")
    );

    private final DeveloperRepository developerRepository;
    private final OrganizationRepository organizationRepository;
    private final ClientRepository clientRepository;
    private final ProjectRepository projectRepository;
    private final SoftwareProductRepository softwareProductRepository;
    private final TaskRepository taskRepository;
    private final TimeEntryRepository timeEntryRepository;
    private final UserSettingsRepository userSettingsRepository;

    @Transactional(readOnly = true)
    public ExcelImportValidationResult validate(MultipartFile file, Long developerId) {
        return parseAndValidate(file).result;
    }

    @Transactional
    public ExcelImportResult importData(MultipartFile file, Long developerId) {
        ParsedWorkbook parsed = parseAndValidate(file);
        ExcelImportValidationResult validation = parsed.result;

        if (validation.getStatus() == ExcelImportStatus.INVALID_NO_IMPORTABLE_DATA) {
            throw new RuntimeException("The file contains no valid data to import.");
        }

        Developer developer = developerRepository.findById(developerId)
                .orElseThrow(() -> new NotFoundException("Developer not found"));

        ExcelImportCounts counts = replaceUserData(developer, parsed);

        return ExcelImportResult.builder()
                .imported(true)
                .importedRowsCount(counts)
                .validation(validation)
                .build();
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
        for (String sheetName : REQUIRED_SHEETS) {
            Sheet sheet = workbook.getSheet(sheetName);
            if (sheet == null) {
                parsed.addError(sheetName, null, null, "Required sheet is missing.");
                continue;
            }

            Row headerRow = sheet.getRow(0);
            Map<String, Integer> headers = readHeaders(headerRow);
            for (String column : REQUIRED_COLUMNS.get(sheetName)) {
                if (!headers.containsKey(column)) {
                    parsed.addError(sheetName, 1, column, "Required column is missing.");
                }
            }
            parsed.headers.put(sheetName, headers);
        }
    }

    private void readRows(Workbook workbook, ParsedWorkbook parsed) {
        readUserSettings(workbook.getSheet("UserSettings"), parsed);
        readOrganizations(workbook.getSheet("Organizations"), parsed);
        readClients(workbook.getSheet("Clients"), parsed);
        readProjects(workbook.getSheet("Projects"), parsed);
        readSoftwareProducts(workbook.getSheet("SoftwareProducts"), parsed);
        readTasks(workbook.getSheet("Tasks"), parsed);
        readTimeEntries(workbook.getSheet("TimeEntries"), parsed);
    }

    private void readUserSettings(Sheet sheet, ParsedWorkbook parsed) {
        forEachDataRow(sheet, parsed.headers.get("UserSettings"), row -> {
            UserSettingsRow item = new UserSettingsRow(row.rowNumber);
            item.dailyHoursLimit = parsePositiveDouble(row, "UserSettings", "daily_hours_limit", parsed, false);
            item.currentOrganizationCode = row.value("current_organization_code");
            item.reportsSaveDirectory = row.value("reports_save_directory");
            validateRequired(row, item, parsed);
            parsed.userSettings.add(item);
        });
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
            item.name = row.value("name");
            item.description = defaultString(row.value("project_description"), row.value("description"));
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
        for (String field : REQUIRED_FIELDS.get(item.sheet)) {
            if (isBlank(row.value(field))) {
                item.valid = false;
                parsed.addError(item.sheet, item.rowNumber, field, "Required field is empty.");
            }
        }
    }

    private void validateDuplicates(ParsedWorkbook parsed) {
        validateDuplicateCodes(parsed.organizations, "Organizations", "code", parsed);
        validateDuplicateCodes(parsed.clients, "Clients", "code", parsed);
        validateDuplicateCodes(parsed.projects, "Projects", "code", parsed);
        validateDuplicateCodes(parsed.softwareProducts, "SoftwareProducts", "code", parsed);
        validateDuplicateCodes(parsed.tasks, "Tasks", "code", parsed);

        validateDuplicateValues(parsed.organizations, "Organizations", "short_name", OrganizationRow::shortName, parsed);
        validateDuplicateValues(parsed.clients, "Clients", "short_name", ClientRow::shortName, parsed);
        validateDuplicateValues(parsed.projects, "Projects", "name", ProjectRow::name, parsed);
        validateDuplicateValues(parsed.softwareProducts, "SoftwareProducts", "short_name", SoftwareProductRow::shortName, parsed);
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

    private void validateReferences(ParsedWorkbook parsed) {
        for (UserSettingsRow row : parsed.userSettings) {
            OrganizationRow organization = parsed.organizationByCode.get(row.currentOrganizationCode);
            if (organization == null || !organization.valid) {
                invalidate(row, parsed, "current_organization_code", "Organization " + safe(row.currentOrganizationCode) + " does not exist or is invalid.");
            }
        }

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

    private ExcelImportCounts replaceUserData(Developer developer, ParsedWorkbook parsed) {
        Long developerId = developer.getId();
        Organization tempOrganization = createTemporaryOrganization(developer);
        developer.setOrganization(tempOrganization);
        developerRepository.saveAndFlush(developer);

        List<Organization> oldOrganizations = organizationRepository.findByDeveloperIdOrderByIdAsc(developerId)
                .stream()
                .filter(organization -> !organization.getId().equals(tempOrganization.getId()))
                .toList();

        timeEntryRepository.deleteAll(timeEntryRepository.findByDeveloperId(developerId));
        taskRepository.deleteAll(taskRepository.findByDeveloperIdOrderByIdAsc(developerId));
        projectRepository.deleteAll(projectRepository.findByDeveloperIdOrderByIdAsc(developerId));
        clientRepository.deleteAll(clientRepository.findByDeveloperIdOrderByIdAsc(developerId));
        userSettingsRepository.findByDeveloperId(developerId).ifPresent(userSettingsRepository::delete);
        softwareProductRepository.deleteAll(softwareProductRepository.findByDeveloperIdOrderByIdAsc(developerId));
        organizationRepository.deleteAll(oldOrganizations);
        organizationRepository.flush();

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

        Map<String, SoftwareProduct> softwareProducts = new LinkedHashMap<>();
        for (SoftwareProductRow row : parsed.softwareProducts.stream().filter(ImportRow::valid).toList()) {
            SoftwareProduct product = softwareProductRepository.save(SoftwareProduct.builder()
                    .developer(developer)
                    .shortName(row.shortName)
                    .fullName(defaultString(row.fullName, row.shortName))
                    .build());
            softwareProducts.put(row.code, product);
        }

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
                    .shortName(row.name)
                    .fullName(row.name)
                    .description(row.description)
                    .completed(Boolean.TRUE.equals(row.completed))
                    .build());
            projects.put(row.code, project);
        }

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
                    .estimatedHours(row.estimatedHours)
                    .completed(Boolean.TRUE.equals(row.completed))
                    .taskLink(row.taskLink)
                    .createdAt(LocalDate.now())
                    .build());
            tasks.put(row.code, task);
        }

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

        UserSettingsRow settingsRow = parsed.userSettings.stream().filter(ImportRow::valid).findFirst().orElse(null);
        Organization currentOrganization = settingsRow != null
                ? organizations.get(settingsRow.currentOrganizationCode)
                : organizations.values().stream().findFirst().orElse(null);
        if (currentOrganization != null) {
            developer.setOrganization(currentOrganization);
            developerRepository.save(developer);
        }
        organizationRepository.delete(tempOrganization);

        if (settingsRow != null) {
            userSettingsRepository.save(UserSettings.builder()
                    .developer(developer)
                    .currentOrganization(currentOrganization)
                    .dailyHoursLimit(settingsRow.dailyHoursLimit)
                    .reportsSaveDirectory(defaultString(settingsRow.reportsSaveDirectory, ""))
                    .build());
        } else if (currentOrganization != null) {
            userSettingsRepository.save(UserSettings.builder()
                    .developer(developer)
                    .currentOrganization(currentOrganization)
                    .dailyHoursLimit(8.0)
                    .reportsSaveDirectory("")
                    .build());
        }

        return ExcelImportCounts.builder()
                .userSettings(settingsRow != null ? 1 : 0)
                .organizations(organizations.size())
                .clients(clients.size())
                .projects(projects.size())
                .softwareProducts(softwareProducts.size())
                .tasks(tasks.size())
                .timeEntries(savedTimeEntries)
                .build();
    }

    private Organization createTemporaryOrganization(Developer developer) {
        return organizationRepository.saveAndFlush(Organization.builder()
                .developer(developer)
                .shortName("__IMPORT_TMP_" + UUID.randomUUID())
                .fullName("Temporary import organization")
                .build());
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
        private final List<UserSettingsRow> userSettings = new ArrayList<>();
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
                    .userSettings((int) userSettings.stream().filter(ImportRow::valid).count())
                    .organizations((int) organizations.stream().filter(ImportRow::valid).count())
                    .clients((int) clients.stream().filter(ImportRow::valid).count())
                    .projects((int) projects.stream().filter(ImportRow::valid).count())
                    .softwareProducts((int) softwareProducts.stream().filter(ImportRow::valid).count())
                    .tasks((int) tasks.stream().filter(ImportRow::valid).count())
                    .timeEntries((int) timeEntries.stream().filter(ImportRow::valid).count())
                    .build();
            int errorRowsCount = countErrorRows();
            ExcelImportStatus status = errors.isEmpty()
                    ? ExcelImportStatus.ALL_VALID
                    : counts.total() == 0
                        ? ExcelImportStatus.INVALID_NO_IMPORTABLE_DATA
                        : ExcelImportStatus.PARTIALLY_VALID;

            result = ExcelImportValidationResult.builder()
                    .status(status)
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
                case "UserSettings" -> userSettings;
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

    private static class UserSettingsRow extends ImportRow {
        private Double dailyHoursLimit;
        private String currentOrganizationCode;
        private String reportsSaveDirectory;

        private UserSettingsRow(int rowNumber) {
            super("UserSettings", rowNumber);
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
        private String name;
        private String description;
        private Boolean completed;

        private ProjectRow(int rowNumber) {
            super("Projects", rowNumber);
        }

        private String name() {
            return name;
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
