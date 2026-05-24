package com.kzhastkou.devproductivityplatform.controller;

import com.kzhastkou.devproductivityplatform.dto.ClientRequest;
import com.kzhastkou.devproductivityplatform.dto.ClientResponse;
import com.kzhastkou.devproductivityplatform.service.ClientService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/clients")
@RequiredArgsConstructor
public class ClientController {

    private final ClientService service;

    @GetMapping
    public List<ClientResponse> list() {
        return service.findAll(resolveCurrentUserId());
    }

    @GetMapping("/{id:\\d+}")
    public ClientResponse getById(@PathVariable Long id) {
        return service.findById(id, resolveCurrentUserId());
    }

    @PostMapping
    public ClientResponse create(@Valid @RequestBody ClientRequest request) {
        return service.create(request, resolveCurrentUserId());
    }

    @PutMapping("/{id:\\d+}")
    public ClientResponse update(@PathVariable Long id, @Valid @RequestBody ClientRequest request) {
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
