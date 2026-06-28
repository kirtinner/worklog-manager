package com.kzhastkou.devproductivityplatform.controller;

import com.kzhastkou.devproductivityplatform.dto.AboutResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/about")
public class AboutController {

    @Value("${app.about.application-name:Dev Productivity Platform}")
    private String applicationName;

    @Value("${app.about.version:unknown}")
    private String version;

    @Value("${app.about.author:}")
    private String author;

    @Value("${app.about.license:}")
    private String license;

    @Value("${app.about.repository:}")
    private String repository;

    @GetMapping
    public AboutResponse getAbout() {
        return AboutResponse.builder()
                .applicationName(applicationName)
                .version(version)
                .author(author)
                .license(license)
                .repository(repository)
                .build();
    }
}
