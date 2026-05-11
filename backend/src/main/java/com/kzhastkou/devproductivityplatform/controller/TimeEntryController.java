package com.kzhastkou.devproductivityplatform.controller;

import com.kzhastkou.devproductivityplatform.dto.TimeEntryRequest;
import com.kzhastkou.devproductivityplatform.dto.TimeEntryResponse;
import com.kzhastkou.devproductivityplatform.entity.TimeEntry;
import com.kzhastkou.devproductivityplatform.repository.TimeEntryRepository;
import com.kzhastkou.devproductivityplatform.service.TimeEntryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/time-entries")
@RequiredArgsConstructor
public class TimeEntryController {

    private final TimeEntryService timeEntryService;

    @PostMapping
    public TimeEntryResponse create(@Valid @RequestBody TimeEntryRequest request) {
        Long userId = (Long) SecurityContextHolder.getContext()
                .getAuthentication()
                .getPrincipal();

        return timeEntryService.create(request, userId);
    }

    @GetMapping("/my")
    public List<TimeEntryResponse> getMyEntries() {

        System.out.println("AUTH: " + SecurityContextHolder.getContext().getAuthentication());

        Long userId = (Long) SecurityContextHolder.getContext()
                .getAuthentication()
                .getPrincipal();

        return timeEntryService.getByDeveloper(userId);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        timeEntryService.delete(id);
    }

    @PutMapping("/{id}")
    public TimeEntryResponse update(@PathVariable Long id,
                                    @RequestBody TimeEntryRequest request) {

        Long userId = (Long) SecurityContextHolder.getContext()
                .getAuthentication()
                .getPrincipal();

        return timeEntryService.update(id, request, userId);
    }
}