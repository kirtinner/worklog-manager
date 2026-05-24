package com.kzhastkou.devproductivityplatform.controller;

import com.kzhastkou.devproductivityplatform.dto.SoftwareProductRequest;
import com.kzhastkou.devproductivityplatform.dto.SoftwareProductResponse;
import com.kzhastkou.devproductivityplatform.service.SoftwareProductService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/software-products")
@RequiredArgsConstructor
public class SoftwareProductController {

    private final SoftwareProductService service;

    @GetMapping
    public List<SoftwareProductResponse> list() {
        return service.findAll(resolveCurrentUserId());
    }

    @GetMapping("/{id:\\d+}")
    public SoftwareProductResponse getById(@PathVariable Long id) {
        return service.findById(id, resolveCurrentUserId());
    }

    @PostMapping
    public SoftwareProductResponse create(@Valid @RequestBody SoftwareProductRequest request) {
        return service.create(request, resolveCurrentUserId());
    }

    @PutMapping("/{id:\\d+}")
    public SoftwareProductResponse update(@PathVariable Long id, @Valid @RequestBody SoftwareProductRequest request) {
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
