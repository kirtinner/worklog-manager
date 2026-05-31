package com.kzhastkou.devproductivityplatform.controller;

import com.kzhastkou.devproductivityplatform.dto.ExcelImportSchemaResponse;
import com.kzhastkou.devproductivityplatform.service.ExcelImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/import")
@RequiredArgsConstructor
public class ImportSchemaController {

    private final ExcelImportService excelImportService;

    @GetMapping("/schema")
    public ExcelImportSchemaResponse getSchema() {
        return excelImportService.getSchema();
    }
}
