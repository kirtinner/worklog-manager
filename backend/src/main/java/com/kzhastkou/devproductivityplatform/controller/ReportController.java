package com.kzhastkou.devproductivityplatform.controller;

import com.kzhastkou.devproductivityplatform.dto.WorkEffortReportResponse;
import com.kzhastkou.devproductivityplatform.entity.Developer;
import com.kzhastkou.devproductivityplatform.repository.DeveloperRepository;
import com.kzhastkou.devproductivityplatform.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;
    private final DeveloperRepository developerRepository;

    @GetMapping("/work-effort")
    public WorkEffortReportResponse getWorkEffortReport(@RequestParam LocalDate from,
                                                        @RequestParam LocalDate to) {
        return reportService.getWorkEffortReport(from, to, resolveCurrentUserId());
    }

    private Long resolveCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        Object principal = authentication != null ? authentication.getPrincipal() : null;

        if (principal instanceof Long userId) {
            return userId;
        }

        return developerRepository.findFirstByOrderByIdAsc()
                .map(Developer::getId)
                .orElseThrow(() -> new IllegalStateException("No developer available for reports"));
    }
}
