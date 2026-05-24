package com.kzhastkou.devproductivityplatform.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ProjectRequest {

    @NotNull
    private Long organizationId;

    @NotNull
    private Long clientId;

    @NotBlank
    private String shortName;

    @NotBlank
    private String fullName;

    @Size(max = 2000)
    private String description;

    private Boolean completed;
}
