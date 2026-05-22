package com.kzhastkou.devproductivityplatform.service;

import com.kzhastkou.devproductivityplatform.dto.WorkEffortReportClientResponse;
import com.kzhastkou.devproductivityplatform.dto.WorkEffortReportResponse;
import com.kzhastkou.devproductivityplatform.dto.WorkEffortReportTaskResponse;
import com.kzhastkou.devproductivityplatform.entity.TimeEntry;
import com.kzhastkou.devproductivityplatform.repository.TimeEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final TimeEntryRepository timeEntryRepository;

    @Transactional(readOnly = true)
    public WorkEffortReportResponse getWorkEffortReport(LocalDate from, LocalDate to, Long developerId) {
        if (from == null || to == null) {
            throw new IllegalArgumentException("Report period is required");
        }

        if (from.isAfter(to)) {
            throw new IllegalArgumentException("Date from must be before or equal to date to");
        }

        List<TimeEntry> entries = timeEntryRepository.findByDeveloperIdAndDateBetweenOrderByDateAscIdAsc(developerId, from, to);
        Map<Long, ClientAggregate> clients = new LinkedHashMap<>();

        for (TimeEntry entry : entries) {
            Long clientId = entry.getTask().getClient().getId();
            ClientAggregate clientAggregate = clients.computeIfAbsent(clientId, id -> new ClientAggregate(
                    id,
                    entry.getTask().getClient().getShortName()
            ));

            Long taskId = entry.getTask().getId();
            TaskAggregate taskAggregate = clientAggregate.tasks.computeIfAbsent(taskId, id -> new TaskAggregate(
                    id,
                    entry.getTask().getName()
            ));

            double hours = entry.getHours() == null ? 0 : entry.getHours();
            taskAggregate.hours += hours;
            clientAggregate.totalHours += hours;
        }

        List<WorkEffortReportClientResponse> clientResponses = clients.values()
                .stream()
                .sorted(Comparator.comparing(client -> client.clientName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(client -> WorkEffortReportClientResponse.builder()
                        .clientId(client.clientId)
                        .clientName(client.clientName)
                        .totalHours(client.totalHours)
                        .tasks(client.tasks.values()
                                .stream()
                                .sorted(Comparator.comparing(task -> task.taskName, Comparator.nullsLast(String::compareToIgnoreCase)))
                                .map(task -> WorkEffortReportTaskResponse.builder()
                                        .taskId(task.taskId)
                                        .taskName(task.taskName)
                                        .hours(task.hours)
                                        .build())
                                .toList())
                        .build())
                .toList();

        double grandTotal = clientResponses.stream()
                .mapToDouble(client -> client.getTotalHours() == null ? 0 : client.getTotalHours())
                .sum();

        return WorkEffortReportResponse.builder()
                .from(from)
                .to(to)
                .grandTotalHours(grandTotal)
                .clients(clientResponses)
                .build();
    }

    private static class ClientAggregate {
        private final Long clientId;
        private final String clientName;
        private final Map<Long, TaskAggregate> tasks = new LinkedHashMap<>();
        private double totalHours;

        private ClientAggregate(Long clientId, String clientName) {
            this.clientId = clientId;
            this.clientName = clientName;
        }
    }

    private static class TaskAggregate {
        private final Long taskId;
        private final String taskName;
        private double hours;

        private TaskAggregate(Long taskId, String taskName) {
            this.taskId = taskId;
            this.taskName = taskName;
        }
    }
}
