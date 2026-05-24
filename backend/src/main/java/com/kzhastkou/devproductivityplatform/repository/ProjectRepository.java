package com.kzhastkou.devproductivityplatform.repository;

import com.kzhastkou.devproductivityplatform.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Long> {

    List<Project> findByDeveloperIdOrderByIdAsc(Long developerId);

    List<Project> findByDeveloperIdAndOrganizationId(Long developerId, Long organizationId);

    List<Project> findByDeveloperIdAndClientId(Long developerId, Long clientId);

    Optional<Project> findByIdAndDeveloperId(Long id, Long developerId);

    List<Project> findByOrganizationId(Long organizationId);

    List<Project> findByOrganizationIdAndClientId(Long organizationId, Long clientId);

    boolean existsByOrganizationId(Long organizationId);

    boolean existsByClientId(Long clientId);

    boolean existsByDeveloperIdAndOrganizationId(Long developerId, Long organizationId);

    boolean existsByDeveloperIdAndClientId(Long developerId, Long clientId);

    boolean existsByDeveloperIdAndId(Long developerId, Long id);
}
