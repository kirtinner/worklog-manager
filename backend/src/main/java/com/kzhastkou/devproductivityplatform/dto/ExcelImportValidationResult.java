package com.kzhastkou.devproductivityplatform.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExcelImportValidationResult {

    private ExcelImportStatus status;
    private ExcelImportCounts validRowsCount;
    private int errorRowsCount;
    @Builder.Default
    private List<ExcelImportIssue> errors = new ArrayList<>();
    @Builder.Default
    private List<ExcelImportIssue> warnings = new ArrayList<>();
}
