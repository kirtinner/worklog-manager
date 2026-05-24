package com.kzhastkou.devproductivityplatform.repository;

import com.kzhastkou.devproductivityplatform.entity.Organization;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrganizationRepository extends JpaRepository<Organization, Long> {

    List<Organization> findByDeveloperIdOrderByIdAsc(Long developerId);

    Optional<Organization> findByIdAndDeveloperId(Long id, Long developerId);

    boolean existsByDeveloperIdAndId(Long developerId, Long id);
}
