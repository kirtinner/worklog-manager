package com.kzhastkou.devproductivityplatform.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class TaskRequest {

    @NotNull
    private Long organizationId;

    @NotNull
    private Long clientId;

    @NotNull
    private Long projectId;

    @NotBlank
    private String taskNumber;

    @NotBlank
    private String name;

    @Size(max = 2000)
    private String comment;

    @Size(max = 2000)
    private String description;

    @Size(max = 5000)
    private String implementationDetails;

    @NotNull
    @DecimalMin("0")
    private Double estimatedHours;

    @NotNull
    private Long softwareProductId;

    private Boolean completed;

    private LocalDate createdAt;
}
