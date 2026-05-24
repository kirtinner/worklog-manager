package com.kzhastkou.devproductivityplatform.service;

import com.kzhastkou.devproductivityplatform.dto.SoftwareProductRequest;
import com.kzhastkou.devproductivityplatform.dto.SoftwareProductResponse;
import com.kzhastkou.devproductivityplatform.entity.Developer;
import com.kzhastkou.devproductivityplatform.entity.SoftwareProduct;
import com.kzhastkou.devproductivityplatform.exception.NotFoundException;
import com.kzhastkou.devproductivityplatform.repository.DeveloperRepository;
import com.kzhastkou.devproductivityplatform.repository.SoftwareProductRepository;
import com.kzhastkou.devproductivityplatform.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SoftwareProductService {

    private final SoftwareProductRepository softwareProductRepository;
    private final DeveloperRepository developerRepository;
    private final TaskRepository taskRepository;

    @Transactional(readOnly = true)
    public List<SoftwareProductResponse> findAll(Long developerId) {
        return softwareProductRepository.findByDeveloperIdOrderByIdAsc(developerId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public SoftwareProductResponse findById(Long id, Long developerId) {
        return toResponse(findEntity(id, developerId));
    }

    @Transactional
    public SoftwareProductResponse create(SoftwareProductRequest request, Long developerId) {
        Developer developer = resolveDeveloper(developerId);
        SoftwareProduct product = SoftwareProduct.builder()
                .developer(developer)
                .shortName(request.getShortName().trim())
                .fullName(request.getFullName().trim())
                .build();

        return toResponse(softwareProductRepository.save(product));
    }

    @Transactional
    public SoftwareProductResponse update(Long id, SoftwareProductRequest request, Long developerId) {
        SoftwareProduct product = findEntity(id, developerId);
        product.setShortName(request.getShortName().trim());
        product.setFullName(request.getFullName().trim());
        return toResponse(softwareProductRepository.save(product));
    }

    @Transactional
    public void delete(Long id, Long developerId) {
        findEntity(id, developerId);

        if (taskRepository.existsByDeveloperIdAndSoftwareProductId(developerId, id)) {
            throw new RuntimeException("Software Product is used in the system and cannot be deleted.");
        }

        softwareProductRepository.deleteById(id);
    }

    private SoftwareProduct findEntity(Long id, Long developerId) {
        return softwareProductRepository.findByIdAndDeveloperId(id, developerId)
                .orElseThrow(() -> new NotFoundException("Software Product not found"));
    }

    private Developer resolveDeveloper(Long developerId) {
        return developerRepository.findById(developerId)
                .orElseThrow(() -> new NotFoundException("Developer not found"));
    }

    private SoftwareProductResponse toResponse(SoftwareProduct product) {
        return SoftwareProductResponse.builder()
                .id(product.getId())
                .shortName(product.getShortName())
                .fullName(product.getFullName())
                .build();
    }
}
