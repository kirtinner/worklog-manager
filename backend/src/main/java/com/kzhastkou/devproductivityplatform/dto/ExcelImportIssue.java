package com.kzhastkou.devproductivityplatform.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExcelImportIssue {

    private String sheet;
    private Integer rowNumber;
    private String field;
    private String message;
}
