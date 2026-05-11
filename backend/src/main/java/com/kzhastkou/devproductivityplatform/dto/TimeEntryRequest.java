package com.kzhastkou.devproductivityplatform.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDate;

@Data
public class TimeEntryRequest {

    @NotNull
    private LocalDate date;

    @NotNull
    @Min(1)
    @Max(24)
    private Double hours;

    @Size(max = 2000)
    private String comment;

//    @NotNull
//    private Long developerId;

    @NotNull
    private Long taskId;
}