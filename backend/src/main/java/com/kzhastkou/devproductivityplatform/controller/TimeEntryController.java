package com.kzhastkou.devproductivityplatform.controller;

import com.kzhastkou.devproductivityplatform.dto.TimeEntryDayRequest;
import com.kzhastkou.devproductivityplatform.dto.TimeEntryRequest;
import com.kzhastkou.devproductivityplatform.dto.TimeEntryResponse;
import com.kzhastkou.devproductivityplatform.dto.TaskTimeEntryResponse;
import com.kzhastkou.devproductivityplatform.entity.Developer;
import com.kzhastkou.devproductivityplatform.repository.DeveloperRepository;
import com.kzhastkou.devproductivityplatform.service.TimeEntryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/time-entries")
@RequiredArgsConstructor
public class TimeEntryController {

    private final TimeEntryService timeEntryService;
    private final DeveloperRepository developerRepository;

    @PostMapping
    public TimeEntryResponse create(@Valid @RequestBody TimeEntryRequest request) {
        return timeEntryService.create(request, resolveCurrentUserId());
    }

    @GetMapping
    public List<TimeEntryResponse> getByDate(@RequestParam LocalDate date) {
        return timeEntryService.getByDate(date, resolveCurrentUserId());
    }

    @GetMapping("/month")
    public List<TimeEntryResponse> getByMonth(@RequestParam int year, @RequestParam int month) {
        return timeEntryService.getByMonth(year, month, resolveCurrentUserId());
    }

    @GetMapping("/task/{taskId}")
    public List<TaskTimeEntryResponse> getByTask(@PathVariable Long taskId) {
        return timeEntryService.getByTask(taskId, resolveCurrentUserId());
    }

    @PutMapping("/day")
    public List<TimeEntryResponse> saveDay(@RequestParam LocalDate date,
                                           @Valid @RequestBody List<@Valid TimeEntryDayRequest> entries) {
        return timeEntryService.saveDay(date, entries, resolveCurrentUserId());
    }

    @GetMapping("/my")
    public List<TimeEntryResponse> getMyEntries() {
        return timeEntryService.getByDeveloper(resolveCurrentUserId());
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        timeEntryService.delete(id, resolveCurrentUserId());
    }

    @PutMapping("/{id}")
    public TimeEntryResponse update(@PathVariable Long id,
                                    @Valid @RequestBody TimeEntryRequest request) {
        return timeEntryService.update(id, request, resolveCurrentUserId());
    }

    private Long resolveCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        Object principal = authentication != null ? authentication.getPrincipal() : null;

        if (principal instanceof Long userId) {
            return userId;
        }

        return developerRepository.findFirstByOrderByIdAsc()
                .map(Developer::getId)
                .orElseThrow(() -> new IllegalStateException("No developer available for time tracking"));
    }
}
