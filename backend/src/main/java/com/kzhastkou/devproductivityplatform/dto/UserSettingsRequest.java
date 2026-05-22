package com.kzhastkou.devproductivityplatform.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UserSettingsRequest {

    private Long currentOrganizationId;

    @NotNull
    @DecimalMin(value = "0.0", inclusive = false)
    private Double dailyHoursLimit;

    private String reportsSaveDirectory;
}
