package com.kzhastkou.devproductivityplatform.controller;

import com.kzhastkou.devproductivityplatform.dto.ProjectRequest;
import com.kzhastkou.devproductivityplatform.dto.ProjectResponse;
import com.kzhastkou.devproductivityplatform.service.ProjectService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService service;

    @GetMapping
    public List<ProjectResponse> list() {
        return service.findAll(resolveCurrentUserId());
    }

    @GetMapping("/{id:\\d+}")
    public ProjectResponse getById(@PathVariable Long id) {
        return service.findById(id, resolveCurrentUserId());
    }

    @PostMapping
    public ProjectResponse create(@Valid @RequestBody ProjectRequest request) {
        return service.create(request, resolveCurrentUserId());
    }

    @PutMapping("/{id:\\d+}")
    public ProjectResponse update(@PathVariable Long id, @Valid @RequestBody ProjectRequest request) {
        return service.update(id, request, resolveCurrentUserId());
    }

    @DeleteMapping("/{id:\\d+}")
    public void delete(@PathVariable Long id) {
        service.delete(id, resolveCurrentUserId());
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
