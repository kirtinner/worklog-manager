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
public class ExcelImportCounts {

    private int userSettings;
    private int organizations;
    private int clients;
    private int projects;
    private int softwareProducts;
    private int tasks;
    private int timeEntries;

    public int total() {
        return userSettings + organizations + clients + projects + softwareProducts + tasks + timeEntries;
    }
}
