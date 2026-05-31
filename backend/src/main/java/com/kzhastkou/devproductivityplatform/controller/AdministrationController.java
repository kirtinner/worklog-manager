package com.kzhastkou.devproductivityplatform.controller;

import com.kzhastkou.devproductivityplatform.dto.ExcelImportResult;
import com.kzhastkou.devproductivityplatform.dto.ExcelImportValidationResult;
import com.kzhastkou.devproductivityplatform.service.ExcelImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/administration/import")
@RequiredArgsConstructor
public class AdministrationController {

    private final ExcelImportService excelImportService;

    @PostMapping("/validate")
    public ExcelImportValidationResult validate(@RequestParam("file") MultipartFile file) {
        return excelImportService.validate(file, resolveCurrentUserId());
    }

    @PostMapping
    public ExcelImportResult importData(@RequestParam("file") MultipartFile file) {
        return excelImportService.importData(file, resolveCurrentUserId());
    }

    private Long resolveCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        Object principal = authentication != null ? authentication.getPrincipal() : null;

        if (principal instanceof Long userId) {
            return userId;
        }

        throw new IllegalStateException("Unable to resolve current user");
    }
}
