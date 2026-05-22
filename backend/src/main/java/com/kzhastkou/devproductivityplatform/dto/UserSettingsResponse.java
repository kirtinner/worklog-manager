package com.kzhastkou.devproductivityplatform.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserSettingsResponse {

    private Long id;
    private Long developerId;
    private Long currentOrganizationId;
    private String currentOrganizationName;
    private Double dailyHoursLimit;
    private String reportsSaveDirectory;
}
