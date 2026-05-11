package com.kzhastkou.devproductivityplatform.service;

import com.kzhastkou.devproductivityplatform.dto.TimeEntryRequest;
import com.kzhastkou.devproductivityplatform.dto.TimeEntryResponse;
import com.kzhastkou.devproductivityplatform.entity.Developer;
import com.kzhastkou.devproductivityplatform.entity.Task;
import com.kzhastkou.devproductivityplatform.entity.TimeEntry;
import com.kzhastkou.devproductivityplatform.exception.NotFoundException;
import com.kzhastkou.devproductivityplatform.repository.DeveloperRepository;
import com.kzhastkou.devproductivityplatform.repository.TaskRepository;
import com.kzhastkou.devproductivityplatform.repository.TimeEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TimeEntryService {

    private final TimeEntryRepository repository;
    private final TaskRepository taskRepository;
    private final DeveloperRepository developerRepository;

    public TimeEntryResponse create(TimeEntryRequest request, Long userId) {

        if (request.getHours() <= 0 || request.getHours() > 16) {
            throw new RuntimeException("Hours must be between 0 and 16");
        }

        Developer dev = developerRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("Developer not found"));

        Task task = taskRepository.findById(request.getTaskId())
                .orElseThrow(() -> new NotFoundException("Task not found"));

        if (!task.getOrganization().getId().equals(dev.getOrganization().getId())) {
            throw new NotFoundException("Cross-organization access запрещен");
        }

        TimeEntry entry = TimeEntry.builder()
                .date(request.getDate())
                .hours(request.getHours())
                .comment(request.getComment())
                .developer(dev)
                .task(task)
                .organization(dev.getOrganization())
                .build();

        TimeEntry saved = repository.save(entry);

        return TimeEntryResponse.builder()
                .id(saved.getId())
                .date(saved.getDate())
                .hours(saved.getHours())
                .comment(saved.getComment())
                .developerId(dev.getId())
                .taskId(task.getId())
                .taskName(entry.getTask().getName())
                .build();
    }

    public List<TimeEntryResponse> getByDeveloper(Long developerId) {
        return repository.findByDeveloperId(developerId)
                .stream()
                .map(entry -> TimeEntryResponse.builder()
                        .id(entry.getId())
                        .date(entry.getDate())
                        .hours(entry.getHours())
                        .comment(entry.getComment())
                        .developerId(entry.getDeveloper().getId())
                        .taskId(entry.getTask().getId())
                        .taskName(entry.getTask().getName())
                        .build()
                )
                .toList();
    }

    public void delete(Long id) {
        repository.deleteById(id);
    }

    public TimeEntryResponse update(Long id, TimeEntryRequest request, Long userId) {

        TimeEntry entry = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Not found"));

        if (!entry.getDeveloper().getId().equals(userId)) {
            throw new RuntimeException("Access denied");
        }

        entry.setDate(request.getDate());
        entry.setHours(request.getHours());
        entry.setComment(request.getComment());

        TimeEntry saved = repository.save(entry);

        return TimeEntryResponse.builder()
                .id(saved.getId())
                .date(saved.getDate())
                .hours(saved.getHours())
                .comment(saved.getComment())
                .taskId(saved.getTask().getId())
                .taskName(entry.getTask().getName())
                .build();
    }
}