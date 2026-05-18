package com.kzhastkou.devproductivityplatform.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDate;

@Data
public class TimeEntryRequest {

    @NotNull
    private LocalDate date;

    @NotNull
    @DecimalMin(value = "0.0", inclusive = false)
    @DecimalMax("24.0")
    private Double hours;

    @Size(max = 2000)
    private String comment;

//    @NotNull
//    private Long developerId;

    @NotNull
    private Long taskId;

    @NotNull
    private Long clientId;

    @NotNull
    private Long organizationId;
}
