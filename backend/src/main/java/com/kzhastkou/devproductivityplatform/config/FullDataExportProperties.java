package com.kzhastkou.devproductivityplatform.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.full-data-export.scheduled")
@Getter
@Setter
public class FullDataExportProperties {

    private boolean enabled = false;
    private String cron = "0 0 2 * * *";
    private String exportDir = "";
    private int retentionDays = 30;
    private Long developerId = 1L;
}
