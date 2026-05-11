package com.kzhastkou.devproductivityplatform.repository;

import com.kzhastkou.devproductivityplatform.entity.TimeEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface TimeEntryRepository extends JpaRepository<TimeEntry, Long> {

    List<TimeEntry> findByDeveloperId(Long developerId);

    List<TimeEntry> findByDeveloperIdAndDateBetween(Long developerId, LocalDate from, LocalDate to);
}