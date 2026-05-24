package com.kzhastkou.devproductivityplatform.repository;

import com.kzhastkou.devproductivityplatform.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findAllByOrderByIdAsc();

    List<Task> findByDeveloperIdOrderByIdAsc(Long developerId);

    List<Task> findByOrganizationId(Long organizationId);

    List<Task> findByClientId(Long clientId);

    List<Task> findByProjectId(Long projectId);

    List<Task> findByDeveloperId(Long developerId);

    List<Task> findByDeveloperIdAndOrganizationId(Long developerId, Long organizationId);

    List<Task> findByDeveloperIdAndClientId(Long developerId, Long clientId);

    List<Task> findByDeveloperIdAndProjectId(Long developerId, Long projectId);

    List<Task> findByDeveloperIdAndSoftwareProductId(Long developerId, Long softwareProductId);

    java.util.Optional<Task> findByIdAndDeveloperId(Long id, Long developerId);

    boolean existsByOrganizationId(Long organizationId);

    boolean existsByClientId(Long clientId);

    boolean existsByProjectId(Long projectId);

    boolean existsBySoftwareProductId(Long softwareProductId);

    boolean existsByDeveloperIdAndOrganizationId(Long developerId, Long organizationId);

    boolean existsByDeveloperIdAndClientId(Long developerId, Long clientId);

    boolean existsByDeveloperIdAndProjectId(Long developerId, Long projectId);

    boolean existsByDeveloperIdAndSoftwareProductId(Long developerId, Long softwareProductId);

    boolean existsByDeveloperIdAndId(Long developerId, Long id);
}
