package com.kzhastkou.devproductivityplatform.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ProjectResponse {

    private Long id;
    private Long organizationId;
    private String organizationName;
    private Long clientId;
    private String clientName;
    private String shortName;
    private String fullName;
    private String description;
    private Boolean completed;
}
