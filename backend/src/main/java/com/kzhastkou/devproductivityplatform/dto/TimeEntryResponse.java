package com.kzhastkou.devproductivityplatform.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

@Data
@Builder
public class TimeEntryResponse {

    private Long id;
    private LocalDate date;
    private Double hours;
    private String comment;

    private Long developerId;
    private Long taskId;
    private String taskName;
}