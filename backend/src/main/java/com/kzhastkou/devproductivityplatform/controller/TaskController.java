package com.kzhastkou.devproductivityplatform.controller;

import com.kzhastkou.devproductivityplatform.dto.TaskRequest;
import com.kzhastkou.devproductivityplatform.dto.TaskResponse;
import com.kzhastkou.devproductivityplatform.dto.TaskTimeEntryResponse;
import com.kzhastkou.devproductivityplatform.service.TaskService;
import com.kzhastkou.devproductivityplatform.service.TimeEntryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;
    private final TimeEntryService timeEntryService;

    @GetMapping
    public List<TaskResponse> getAll() {
        return taskService.findAll(resolveCurrentUserId());
    }

    @GetMapping("/my")
    public List<TaskResponse> getMyTasks() {
        return taskService.findMyTasks(resolveCurrentUserId());
    }

    @GetMapping("/{id:\\d+}")
    public TaskResponse getById(@PathVariable Long id) {
        return taskService.findById(id, resolveCurrentUserId());
    }

    @PostMapping
    public TaskResponse create(@Valid @RequestBody TaskRequest request) {
        return taskService.create(request, resolveCurrentUserId());
    }

    @PutMapping("/{id:\\d+}")
    public TaskResponse update(@PathVariable Long id, @Valid @RequestBody TaskRequest request) {
        return taskService.update(id, request, resolveCurrentUserId());
    }

    @GetMapping("/{id:\\d+}/delete-check")
    public void checkCanDelete(@PathVariable Long id) {
        taskService.validateCanDelete(id, resolveCurrentUserId());
    }

    @GetMapping("/{id:\\d+}/time-entries")
    public List<TaskTimeEntryResponse> getTimeEntries(@PathVariable Long id) {
        return timeEntryService.getByTask(id, resolveCurrentUserId());
    }

    @DeleteMapping("/{id:\\d+}")
    public void delete(@PathVariable Long id) {
        taskService.delete(id, resolveCurrentUserId());
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
