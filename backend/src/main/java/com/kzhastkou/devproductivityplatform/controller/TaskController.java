package com.kzhastkou.devproductivityplatform.controller;

import com.kzhastkou.devproductivityplatform.entity.Task;
import com.kzhastkou.devproductivityplatform.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskRepository repository;

    @GetMapping
    public List<Task> getAll() {
        return repository.findAll();
    }

    @GetMapping("/my")
    public List<Task> getMyTasks() {
        Long userId = (Long) SecurityContextHolder.getContext()
                .getAuthentication()
                .getPrincipal();

        return repository.findByDeveloperId(userId);
//        return repository.findAll();
    }
}
