package com.kzhastkou.devproductivityplatform.controller;

import com.kzhastkou.devproductivityplatform.dto.OrganizationRequest;
import com.kzhastkou.devproductivityplatform.dto.OrganizationResponse;
import com.kzhastkou.devproductivityplatform.service.OrganizationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/organizations")
@RequiredArgsConstructor
public class OrganizationController {

    private final OrganizationService service;

    @GetMapping
    public List<OrganizationResponse> list() {
        return service.findAll(resolveCurrentUserId());
    }

    @GetMapping("/{id:\\d+}")
    public OrganizationResponse getById(@PathVariable Long id) {
        return service.findById(id, resolveCurrentUserId());
    }

    @PostMapping
    public OrganizationResponse create(@Valid @RequestBody OrganizationRequest request) {
        return service.create(request, resolveCurrentUserId());
    }

    @PutMapping("/{id:\\d+}")
    public OrganizationResponse update(@PathVariable Long id, @Valid @RequestBody OrganizationRequest request) {
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
