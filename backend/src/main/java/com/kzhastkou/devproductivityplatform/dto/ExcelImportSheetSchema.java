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
public class ExcelImportSheetSchema {

    private String sheetName;
    @Builder.Default
    private List<String> requiredColumns = new ArrayList<>();
    @Builder.Default
    private List<String> optionalColumns = new ArrayList<>();
}
