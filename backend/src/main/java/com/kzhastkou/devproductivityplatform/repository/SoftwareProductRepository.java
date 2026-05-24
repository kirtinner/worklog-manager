package com.kzhastkou.devproductivityplatform.repository;

import com.kzhastkou.devproductivityplatform.entity.SoftwareProduct;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SoftwareProductRepository extends JpaRepository<SoftwareProduct, Long> {

    List<SoftwareProduct> findByDeveloperIdOrderByIdAsc(Long developerId);

    Optional<SoftwareProduct> findByIdAndDeveloperId(Long id, Long developerId);

    boolean existsByDeveloperIdAndId(Long developerId, Long id);
}
