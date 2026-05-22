package com.kzhastkou.devproductivityplatform.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class WorkEffortReportTaskResponse {

    private Long taskId;
    private String taskName;
    private Double hours;
}
