package com.kzhastkou.devproductivityplatform.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

@Data
@Builder
public class TimeEntryResponse {

    private Long id;
    private LocalDate date;
    private Long organizationId;
    private String organizationName;
    private Long clientId;
    private String clientName;
    private Double hours;
    private Double totalTaskHours;
    private String comment;

    private Long developerId;
    private Long taskId;
    private String taskName;
}
