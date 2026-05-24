package com.kzhastkou.devproductivityplatform.repository;

import com.kzhastkou.devproductivityplatform.entity.Client;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClientRepository extends JpaRepository<Client, Long> {

    List<Client> findByDeveloperIdOrderByIdAsc(Long developerId);

    List<Client> findByDeveloperIdAndOrganizationId(Long developerId, Long organizationId);

    Optional<Client> findByIdAndDeveloperId(Long id, Long developerId);

    List<Client> findByOrganizationId(Long organizationId);

    boolean existsByOrganizationId(Long organizationId);

    boolean existsByDeveloperIdAndOrganizationId(Long developerId, Long organizationId);

    boolean existsByDeveloperIdAndId(Long developerId, Long id);
}
