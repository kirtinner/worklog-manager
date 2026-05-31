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
public class ExcelImportSchemaResponse {

    private String warning;
    @Builder.Default
    private List<String> replacedData = new ArrayList<>();
    @Builder.Default
    private List<ExcelImportSheetSchema> sheets = new ArrayList<>();
}
