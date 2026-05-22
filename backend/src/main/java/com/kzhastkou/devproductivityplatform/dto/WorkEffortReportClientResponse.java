package com.kzhastkou.devproductivityplatform.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class WorkEffortReportClientResponse {

    private Long clientId;
    private String clientName;
    private Double totalHours;
    private List<WorkEffortReportTaskResponse> tasks;
}
