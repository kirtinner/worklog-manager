package com.kzhastkou.devproductivityplatform.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class WorkEffortReportResponse {

    private LocalDate from;
    private LocalDate to;
    private Double grandTotalHours;
    private List<WorkEffortReportClientResponse> clients;
}
