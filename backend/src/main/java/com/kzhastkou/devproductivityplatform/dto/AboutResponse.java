package com.kzhastkou.devproductivityplatform.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AboutResponse {
    private String applicationName;
    private String version;
    private String author;
    private String license;
    private String repository;
}
