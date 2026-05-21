package com.kzhastkou.devproductivityplatform.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

@Data
@Builder
public class TaskTimeEntryResponse {

    private LocalDate date;
    private Double hours;
    private String comment;
}
