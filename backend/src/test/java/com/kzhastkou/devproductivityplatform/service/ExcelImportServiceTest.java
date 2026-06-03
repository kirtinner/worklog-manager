package com.kzhastkou.devproductivityplatform.service;

import com.kzhastkou.devproductivityplatform.dto.ExcelImportStatus;
import com.kzhastkou.devproductivityplatform.dto.ExcelImportValidationResult;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CreationHelper;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.sql.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ExcelImportServiceTest {

    private final ExcelImportService service = new ExcelImportService(
            null, null, null, null, null, null, null, null, null
    );

    @Test
    void invalidFileIsRejected() {
        ExcelImportValidationResult result = service.validate(
                new MockMultipartFile("file", "data.txt", "text/plain", "not excel".getBytes()),
                1L
        );

        assertThat(result.getStatus()).isEqualTo(ExcelImportStatus.INVALID);
        assertThat(result.getErrors()).isNotEmpty();
    }

    @Test
    void missingSheetIsRejected() throws IOException {
        ExcelImportValidationResult result = service.validate(workbookFile(workbookWithout("Tasks")), 1L);

        assertThat(result.getStatus()).isEqualTo(ExcelImportStatus.INVALID);
        assertThat(result.getErrors()).anyMatch(error -> "Tasks".equals(error.getSheet()));
    }

    @Test
    void missingColumnIsRejected() throws IOException {
        Map<String, List<String>> override = new LinkedHashMap<>(headers());
        override.put("Clients", List.of("code", "organization_code", "full_name"));

        ExcelImportValidationResult result = service.validate(workbookFile(workbook(override, true, false, false)), 1L);

        assertThat(result.getStatus()).isEqualTo(ExcelImportStatus.INVALID);
        assertThat(result.getErrors()).anyMatch(error ->
                "Clients".equals(error.getSheet()) && "short_name".equals(error.getField())
        );
    }

    @Test
    void duplicateCodeReturnsInvalidValidation() throws IOException {
        Workbook workbook = workbook(headers(), true, false, false);
        appendRow(workbook.getSheet("Organizations"), "ORG1", "Org Duplicate", "Org Duplicate");

        ExcelImportValidationResult result = service.validate(workbookFile(workbook), 1L);

        assertThat(result.getStatus()).isEqualTo(ExcelImportStatus.INVALID);
        assertThat(result.getErrors()).anyMatch(error -> error.getMessage().contains("Duplicate"));
    }

    @Test
    void duplicateClientShortNameReturnsInvalidValidation() throws IOException {
        Workbook workbook = workbook(headers(), true, false, false);
        appendRow(workbook.getSheet("Clients"), "CLIENT2", "ORG1", "Client", "Client Full 2");

        ExcelImportValidationResult result = service.validate(workbookFile(workbook), 1L);

        assertThat(result.getStatus()).isEqualTo(ExcelImportStatus.INVALID);
        assertThat(result.getErrors()).anyMatch(error ->
                "Clients".equals(error.getSheet())
                        && "short_name".equals(error.getField())
                        && error.getMessage().contains("Duplicate client short_name 'Client'.")
        );
    }

    @Test
    void duplicateProjectShortNameForSameOrganizationAndClientReturnsInvalidValidation() throws IOException {
        Workbook workbook = workbook(headers(), true, false, false);
        appendRow(workbook.getSheet("Projects"), "PROJECT2", "ORG1", "CLIENT1", "Project", "Project Full 2", "", "false");

        ExcelImportValidationResult result = service.validate(workbookFile(workbook), 1L);

        assertThat(result.getStatus()).isEqualTo(ExcelImportStatus.INVALID);
        assertThat(result.getErrors()).anyMatch(error ->
                "Projects".equals(error.getSheet())
                        && "short_name".equals(error.getField())
                        && error.getMessage().contains("Duplicate project short_name 'Project'")
        );
    }

    @Test
    void duplicateProjectShortNameForDifferentClientsIsAllowed() throws IOException {
        Workbook workbook = workbook(headers(), true, false, false);
        appendRow(workbook.getSheet("Clients"), "CLIENT2", "ORG1", "Client 2", "Client Full 2");
        appendRow(workbook.getSheet("Projects"), "PROJECT2", "ORG1", "CLIENT2", "Project", "Project Full 2", "", "false");

        ExcelImportValidationResult result = service.validate(workbookFile(workbook), 1L);

        assertThat(result.getStatus()).isEqualTo(ExcelImportStatus.ALL_VALID);
        assertThat(result.getErrors()).isEmpty();
    }

    @Test
    void duplicateProjectShortNameForDifferentOrganizationsIsAllowed() throws IOException {
        Workbook workbook = workbook(headers(), true, false, false);
        appendRow(workbook.getSheet("Organizations"), "ORG2", "Org 2", "Organization 2");
        appendRow(workbook.getSheet("Clients"), "CLIENT2", "ORG2", "Client 2", "Client Full 2");
        appendRow(workbook.getSheet("Projects"), "PROJECT2", "ORG2", "CLIENT2", "Project", "Project Full 2", "", "false");

        ExcelImportValidationResult result = service.validate(workbookFile(workbook), 1L);

        assertThat(result.getStatus()).isEqualTo(ExcelImportStatus.ALL_VALID);
        assertThat(result.getErrors()).isEmpty();
    }

    @Test
    void brokenReferenceReturnsInvalidValidation() throws IOException {
        Workbook workbook = workbook(headers(), true, false, false);
        appendRow(workbook.getSheet("TimeEntries"), "MISSING_TASK", "2026-05-24", "1", "Broken");

        ExcelImportValidationResult result = service.validate(workbookFile(workbook), 1L);

        assertThat(result.getStatus()).isEqualTo(ExcelImportStatus.INVALID);
        assertThat(result.getErrors()).anyMatch(error -> "task_code".equals(error.getField()));
    }

    @Test
    void allValidWorkbookIsAccepted() throws IOException {
        ExcelImportValidationResult result = service.validate(workbookFile(workbook(headers(), true, false, false)), 1L);

        assertThat(result.getStatus()).isEqualTo(ExcelImportStatus.ALL_VALID);
        assertThat(result.getValidRowsCount().getTasks()).isEqualTo(1);
        assertThat(result.getErrors()).isEmpty();
    }

    @Test
    void missingTaskCreatedAtColumnIsRejected() throws IOException {
        Map<String, List<String>> override = new LinkedHashMap<>(headers());
        override.put("Tasks", List.of("code", "organization_code", "client_code", "project_code", "software_product_code", "task_number", "name", "comment", "estimated_hours", "completed", "task_link"));

        ExcelImportValidationResult result = service.validate(workbookFile(workbook(override, true, false, false)), 1L);

        assertThat(result.getStatus()).isEqualTo(ExcelImportStatus.INVALID);
        assertThat(result.getErrors()).anyMatch(error ->
                "Tasks".equals(error.getSheet())
                        && Integer.valueOf(1).equals(error.getRowNumber())
                        && "created_at".equals(error.getField())
                        && "Required column is missing.".equals(error.getMessage())
        );
    }

    @Test
    void emptyTaskCreatedAtValueIsRejected() throws IOException {
        Workbook workbook = workbook(headers(), true, false, false);
        workbook.getSheet("Tasks").getRow(1).getCell(7).setCellValue("");

        ExcelImportValidationResult result = service.validate(workbookFile(workbook), 1L);

        assertThat(result.getStatus()).isEqualTo(ExcelImportStatus.INVALID);
        assertThat(result.getErrors()).anyMatch(error ->
                "Tasks".equals(error.getSheet())
                        && Integer.valueOf(2).equals(error.getRowNumber())
                        && "created_at".equals(error.getField())
                        && "Required value is missing.".equals(error.getMessage())
        );
    }

    @Test
    void invalidTaskCreatedAtValueIsRejected() throws IOException {
        Workbook workbook = workbook(headers(), true, false, false);
        workbook.getSheet("Tasks").getRow(1).getCell(7).setCellValue("not-a-date");

        ExcelImportValidationResult result = service.validate(workbookFile(workbook), 1L);

        assertThat(result.getStatus()).isEqualTo(ExcelImportStatus.INVALID);
        assertThat(result.getErrors()).anyMatch(error ->
                "Tasks".equals(error.getSheet())
                        && Integer.valueOf(2).equals(error.getRowNumber())
                        && "created_at".equals(error.getField())
                        && "Invalid date format.".equals(error.getMessage())
        );
    }

    @Test
    void taskCreatedAtAcceptsExcelDateCell() throws IOException {
        Workbook workbook = workbook(headers(), true, false, false);
        CreationHelper creationHelper = workbook.getCreationHelper();
        CellStyle dateStyle = workbook.createCellStyle();
        dateStyle.setDataFormat(creationHelper.createDataFormat().getFormat("yyyy-mm-dd"));
        workbook.getSheet("Tasks").getRow(1).getCell(7).setCellValue(Date.valueOf(LocalDate.of(2026, 5, 20)));
        workbook.getSheet("Tasks").getRow(1).getCell(7).setCellStyle(dateStyle);

        ExcelImportValidationResult result = service.validate(workbookFile(workbook), 1L);

        assertThat(result.getStatus()).isEqualTo(ExcelImportStatus.ALL_VALID);
        assertThat(result.getErrors()).isEmpty();
    }

    @Test
    void clientNotDisplayedColumnAcceptsRussianBooleanValues() throws IOException {
        Map<String, List<String>> override = new LinkedHashMap<>(headers());
        override.put("Clients", List.of("code", "organization_code", "short_name", "full_name", "not_displayed"));
        Workbook workbook = workbook(override, false, false, false);

        appendRow(workbook.getSheet("Organizations"), "ORG1", "Org", "Organization");
        appendRow(workbook.getSheet("Clients"), "CLIENT1", "ORG1", "Client", "Client Full", "истина");
        appendRow(workbook.getSheet("Projects"), "PROJECT1", "ORG1", "CLIENT1", "Project", "Project Full", "Project description", "false");
        appendRow(workbook.getSheet("SoftwareProducts"), "PRODUCT1", "Product", "Product Full");
        appendRow(workbook.getSheet("Tasks"), "TASK1", "ORG1", "CLIENT1", "PROJECT1", "PRODUCT1", "T-1", "Task", "2026-05-20", "", "2", "false", "");
        appendRow(workbook.getSheet("TimeEntries"), "TASK1", "2026-05-24", "1", "Work");

        ExcelImportValidationResult result = service.validate(workbookFile(workbook), 1L);

        assertThat(result.getStatus()).isEqualTo(ExcelImportStatus.ALL_VALID);
        assertThat(result.getErrors()).isEmpty();
    }

    @Test
    void clientNotDisplayedColumnAcceptsDaNetBooleanValues() throws IOException {
        Map<String, List<String>> override = new LinkedHashMap<>(headers());
        override.put("Clients", List.of("code", "organization_code", "short_name", "full_name", "not_displayed"));
        Workbook workbook = workbook(override, false, false, false);

        appendRow(workbook.getSheet("Organizations"), "ORG1", "Org", "Organization");
        appendRow(workbook.getSheet("Clients"), "CLIENT1", "ORG1", "Client", "Client Full", "\u0434\u0430");
        appendRow(workbook.getSheet("Projects"), "PROJECT1", "ORG1", "CLIENT1", "Project", "Project Full", "Project description", "false");
        appendRow(workbook.getSheet("SoftwareProducts"), "PRODUCT1", "Product", "Product Full");
        appendRow(workbook.getSheet("Tasks"), "TASK1", "ORG1", "CLIENT1", "PROJECT1", "PRODUCT1", "T-1", "Task", "2026-05-20", "", "2", "false", "");
        appendRow(workbook.getSheet("TimeEntries"), "TASK1", "2026-05-24", "1", "Work");

        ExcelImportValidationResult result = service.validate(workbookFile(workbook), 1L);

        assertThat(result.getStatus()).isEqualTo(ExcelImportStatus.ALL_VALID);
        assertThat(result.getErrors()).isEmpty();
    }

    @Test
    void clientNotDisplayedInvalidBooleanIsRejected() throws IOException {
        Map<String, List<String>> override = new LinkedHashMap<>(headers());
        override.put("Clients", List.of("code", "organization_code", "short_name", "full_name", "not_displayed"));
        Workbook workbook = workbook(override, false, false, false);

        appendRow(workbook.getSheet("Organizations"), "ORG1", "Org", "Organization");
        appendRow(workbook.getSheet("Clients"), "CLIENT1", "ORG1", "Client", "Client Full", "maybe");
        appendRow(workbook.getSheet("Projects"), "PROJECT1", "ORG1", "CLIENT1", "Project", "Project Full", "Project description", "false");
        appendRow(workbook.getSheet("SoftwareProducts"), "PRODUCT1", "Product", "Product Full");
        appendRow(workbook.getSheet("Tasks"), "TASK1", "ORG1", "CLIENT1", "PROJECT1", "PRODUCT1", "T-1", "Task", "2026-05-20", "", "2", "false", "");
        appendRow(workbook.getSheet("TimeEntries"), "TASK1", "2026-05-24", "1", "Work");

        ExcelImportValidationResult result = service.validate(workbookFile(workbook), 1L);

        assertThat(result.getStatus()).isEqualTo(ExcelImportStatus.INVALID);
        assertThat(result.getErrors()).anyMatch(error ->
                "Clients".equals(error.getSheet())
                        && "not_displayed".equals(error.getField())
                        && "Invalid boolean value.".equals(error.getMessage())
        );
    }

    @Test
    void invalidWorkbookDoesNotEnablePartialImport() throws IOException {
        Workbook workbook = workbook(headers(), true, false, false);
        appendRow(workbook.getSheet("Tasks"), "TASK_BAD", "ORG1", "CLIENT1", "PROJECT1", "PRODUCT1", "", "Broken Task", "2026-05-20", "", "1", "false", "");

        ExcelImportValidationResult result = service.validate(workbookFile(workbook), 1L);

        assertThat(result.getStatus()).isEqualTo(ExcelImportStatus.INVALID);
        assertThat(result.getErrors()).anyMatch(error -> "task_number".equals(error.getField()));
    }

    private Workbook workbookWithout(String missingSheet) {
        Workbook workbook = new XSSFWorkbook();
        headers().forEach((sheet, columns) -> {
            if (!sheet.equals(missingSheet)) {
                createSheet(workbook, sheet, columns);
            }
        });
        return workbook;
    }

    private Workbook workbook(Map<String, List<String>> headers, boolean withData, boolean duplicate, boolean brokenReference) {
        Workbook workbook = new XSSFWorkbook();
        headers.forEach((sheet, columns) -> createSheet(workbook, sheet, columns));

        if (withData) {
            appendRow(workbook.getSheet("Organizations"), "ORG1", "Org", "Organization");
            appendRow(workbook.getSheet("Clients"), "CLIENT1", "ORG1", "Client", "Client Full");
            appendRow(workbook.getSheet("Projects"), "PROJECT1", "ORG1", "CLIENT1", "Project", "Project Full", "Project description", "false");
            appendRow(workbook.getSheet("SoftwareProducts"), "PRODUCT1", "Product", "Product Full");
            appendRow(workbook.getSheet("Tasks"), "TASK1", "ORG1", "CLIENT1", "PROJECT1", "PRODUCT1", "T-1", "Task", "2026-05-20", "", "2", "false", "");
            appendRow(workbook.getSheet("TimeEntries"), brokenReference ? "UNKNOWN" : "TASK1", "2026-05-24", "1", "Work");
        }

        if (duplicate) {
            appendRow(workbook.getSheet("Organizations"), "ORG1", "Org 2", "Organization 2");
        }

        return workbook;
    }

    private void createSheet(Workbook workbook, String name, List<String> columns) {
        Sheet sheet = workbook.createSheet(name);
        Row row = sheet.createRow(0);
        for (int index = 0; index < columns.size(); index++) {
            row.createCell(index).setCellValue(columns.get(index));
        }
    }

    private void appendRow(Sheet sheet, String... values) {
        Row row = sheet.createRow(sheet.getLastRowNum() + 1);
        for (int index = 0; index < values.length; index++) {
            row.createCell(index).setCellValue(values[index]);
        }
    }

    private MockMultipartFile workbookFile(Workbook workbook) throws IOException {
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

    private Map<String, List<String>> headers() {
        Map<String, List<String>> headers = new LinkedHashMap<>();
        headers.put("Organizations", List.of("code", "short_name", "full_name"));
        headers.put("Clients", List.of("code", "organization_code", "short_name", "full_name"));
        headers.put("Projects", List.of("code", "organization_code", "client_code", "short_name", "full_name", "description", "completed"));
        headers.put("SoftwareProducts", List.of("code", "short_name", "full_name"));
        headers.put("Tasks", List.of("code", "organization_code", "client_code", "project_code", "software_product_code", "task_number", "name", "created_at", "comment", "estimated_hours", "completed", "task_link"));
        headers.put("TimeEntries", List.of("task_code", "entry_date", "hours", "comment"));
        return headers;
    }
}
