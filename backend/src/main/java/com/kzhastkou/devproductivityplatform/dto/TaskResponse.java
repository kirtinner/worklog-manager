package com.kzhastkou.devproductivityplatform.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

@Data
@Builder
public class TaskResponse {

    private Long id;
    private Long organizationId;
    private String organizationName;
    private Long clientId;
    private String clientName;
    private Long projectId;
    private String projectName;
    private String taskNumber;
    private String name;
    private String comment;
    private String taskLink;
    private String description;
    private String implementationDetails;
    private Double estimatedHours;
    private Double actualHours;
    private Long softwareProductId;
    private String softwareProductName;
    private Boolean completed;
    private LocalDate createdAt;
    private Long developerId;
}
