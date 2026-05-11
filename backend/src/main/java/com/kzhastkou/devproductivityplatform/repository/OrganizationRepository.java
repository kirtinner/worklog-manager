package com.kzhastkou.devproductivityplatform.repository;

import com.kzhastkou.devproductivityplatform.entity.Organization;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationRepository extends JpaRepository<Organization, Long> {
}