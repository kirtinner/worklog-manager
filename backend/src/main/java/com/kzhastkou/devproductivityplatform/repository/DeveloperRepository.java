package com.kzhastkou.devproductivityplatform.repository;

import com.kzhastkou.devproductivityplatform.entity.Developer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DeveloperRepository extends JpaRepository<Developer, Long> {
    Optional<Developer> findByEmail(String email);
    boolean existsByEmail(String email);
}
