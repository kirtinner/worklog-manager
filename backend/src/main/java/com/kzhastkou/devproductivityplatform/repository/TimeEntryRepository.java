package com.kzhastkou.devproductivityplatform.repository;

import com.kzhastkou.devproductivityplatform.entity.TimeEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface TimeEntryRepository extends JpaRepository<TimeEntry, Long> {

    interface TaskHoursTotal {
        Long getTaskId();

        Double getActualHours();
    }

    List<TimeEntry> findByDeveloperId(Long developerId);

    List<TimeEntry> findByDeveloperIdAndDate(Long developerId, LocalDate date);

    List<TimeEntry> findByDeveloperIdAndDateBetweenOrderByDateAscIdAsc(Long developerId, LocalDate from, LocalDate to);

    List<TimeEntry> findByDeveloperIdAndTaskId(Long developerId, Long taskId);

    void deleteByDeveloperIdAndDate(Long developerId, LocalDate date);

    boolean existsByOrganizationId(Long organizationId);

    boolean existsByDeveloperIdAndOrganizationId(Long developerId, Long organizationId);

    boolean existsByTaskClientId(Long clientId);

    boolean existsByDeveloperIdAndTaskClientId(Long developerId, Long clientId);

    boolean existsByTaskProjectId(Long projectId);

    boolean existsByDeveloperIdAndTaskProjectId(Long developerId, Long projectId);

    boolean existsByTaskId(Long taskId);

    @Query("""
            select timeEntry.task.id as taskId, coalesce(sum(timeEntry.hours), 0) as actualHours
            from TimeEntry timeEntry
            group by timeEntry.task.id
            """)
    List<TaskHoursTotal> sumHoursByTask();

    @Query("""
            select timeEntry.task.id as taskId, coalesce(sum(timeEntry.hours), 0) as actualHours
            from TimeEntry timeEntry
            where timeEntry.developer.id = :developerId
            group by timeEntry.task.id
            """)
    List<TaskHoursTotal> sumHoursByTaskForDeveloper(@Param("developerId") Long developerId);
}
