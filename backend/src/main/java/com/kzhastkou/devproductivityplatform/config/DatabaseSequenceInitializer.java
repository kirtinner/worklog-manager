package com.kzhastkou.devproductivityplatform.config;

import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DatabaseSequenceInitializer {

    private final EntityManager entityManager;

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void synchronizeIdentitySequences() {
        allowEmptyCurrentOrganization();
        allowEmptyDeveloperOrganization();
        convertLongTextColumns();
        backfillDeveloperOwnership();
        synchronizeSequence("organizations_id_seq", "organizations");
        synchronizeSequence("clients_id_seq", "clients");
        synchronizeSequence("projects_id_seq", "projects");
        synchronizeSequence("tasks_id_seq", "tasks");
        synchronizeSequence("software_products_id_seq", "software_products");
        synchronizeSequence("user_settings_id_seq", "user_settings");
    }

    private void allowEmptyCurrentOrganization() {
        entityManager.createNativeQuery("""
                ALTER TABLE IF EXISTS user_settings
                ALTER COLUMN current_organization_id DROP NOT NULL
                """).executeUpdate();
    }

    private void allowEmptyDeveloperOrganization() {
        entityManager.createNativeQuery("""
                ALTER TABLE IF EXISTS developers
                ALTER COLUMN organization_id DROP NOT NULL
                """).executeUpdate();
    }

    private void convertLongTextColumns() {
        alterColumnToText("tasks", "comment");
        alterColumnToText("tasks", "description");
        alterColumnToText("tasks", "implementation_details");
        alterColumnToText("projects", "description");
        alterColumnToText("time_entries", "comment");
    }

    private void alterColumnToText(String tableName, String columnName) {
        entityManager.createNativeQuery("""
                ALTER TABLE IF EXISTS %s
                ALTER COLUMN %s TYPE TEXT
                """.formatted(tableName, columnName)).executeUpdate();
    }

    private void backfillDeveloperOwnership() {
        var developerRows = entityManager.createNativeQuery("""
                select id
                from developers
                order by id asc
                limit 1
                """).getResultList();

        if (developerRows.isEmpty() || developerRows.get(0) == null) {
            return;
        }

        Long developerId = ((Number) developerRows.get(0)).longValue();

        entityManager.createNativeQuery("""
                alter table if exists organizations
                add column if not exists developer_id bigint
                """).executeUpdate();
        entityManager.createNativeQuery("""
                alter table if exists clients
                add column if not exists developer_id bigint
                """).executeUpdate();
        entityManager.createNativeQuery("""
                alter table if exists projects
                add column if not exists developer_id bigint
                """).executeUpdate();
        entityManager.createNativeQuery("""
                alter table if exists projects
                add column if not exists completed boolean
                """).executeUpdate();
        entityManager.createNativeQuery("""
                alter table if exists software_products
                add column if not exists developer_id bigint
                """).executeUpdate();

        entityManager.createNativeQuery("""
                update organizations
                set developer_id = :developerId
                where developer_id is null
                """).setParameter("developerId", developerId).executeUpdate();
        entityManager.createNativeQuery("""
                update clients
                set developer_id = :developerId
                where developer_id is null
                """).setParameter("developerId", developerId).executeUpdate();
        entityManager.createNativeQuery("""
                update projects
                set developer_id = :developerId
                where developer_id is null
                """).setParameter("developerId", developerId).executeUpdate();
        entityManager.createNativeQuery("""
                update projects
                set completed = false
                where completed is null
                """).executeUpdate();
        entityManager.createNativeQuery("""
                update software_products
                set developer_id = :developerId
                where developer_id is null
                """).setParameter("developerId", developerId).executeUpdate();
        entityManager.createNativeQuery("""
                update tasks
                set developer_id = :developerId
                where developer_id is null
                """).setParameter("developerId", developerId).executeUpdate();

        entityManager.createNativeQuery("""
                alter table if exists organizations
                alter column developer_id set not null
                """).executeUpdate();
        entityManager.createNativeQuery("""
                alter table if exists clients
                alter column developer_id set not null
                """).executeUpdate();
        entityManager.createNativeQuery("""
                alter table if exists projects
                alter column developer_id set not null
                """).executeUpdate();
        entityManager.createNativeQuery("""
                alter table if exists projects
                alter column completed set not null
                """).executeUpdate();
        entityManager.createNativeQuery("""
                alter table if exists software_products
                alter column developer_id set not null
                """).executeUpdate();
        entityManager.createNativeQuery("""
                alter table if exists tasks
                alter column developer_id set not null
                """).executeUpdate();

        deduplicateShortNames("organizations");
        deduplicateShortNames("clients");
        deduplicateProjectShortNames();
        deduplicateShortNames("software_products");

        entityManager.createNativeQuery("""
                create unique index if not exists ux_organizations_developer_short_name
                on organizations (developer_id, short_name)
                """).executeUpdate();
        entityManager.createNativeQuery("""
                create unique index if not exists ux_clients_developer_short_name
                on clients (developer_id, short_name)
                """).executeUpdate();
        entityManager.createNativeQuery("""
                alter table if exists projects
                drop constraint if exists ux_projects_developer_short_name
                """).executeUpdate();
        dropProjectDeveloperShortNameConstraints();
        entityManager.createNativeQuery("""
                drop index if exists ux_projects_developer_short_name
                """).executeUpdate();
        entityManager.createNativeQuery("""
                create unique index if not exists ux_projects_dev_org_client_short_name
                on projects (developer_id, organization_id, client_id, short_name)
                """).executeUpdate();
        entityManager.createNativeQuery("""
                create unique index if not exists ux_software_products_developer_short_name
                on software_products (developer_id, short_name)
                """).executeUpdate();
    }

    private void deduplicateShortNames(String tableName) {
        entityManager.createNativeQuery("""
                with duplicate_rows as (
                    select id,
                           row_number() over (partition by developer_id, short_name order by id) as rn
                    from %s
                )
                update %s t
                set short_name = t.short_name || ' (' || t.id || ')'
                from duplicate_rows d
                where t.id = d.id
                  and d.rn > 1
                """.formatted(tableName, tableName)).executeUpdate();
    }

    private void deduplicateProjectShortNames() {
        entityManager.createNativeQuery("""
                with duplicate_rows as (
                    select id,
                           row_number() over (
                               partition by developer_id, organization_id, client_id, short_name
                               order by id
                           ) as rn
                    from projects
                )
                update projects t
                set short_name = t.short_name || ' (' || t.id || ')'
                from duplicate_rows d
                where t.id = d.id
                  and d.rn > 1
                """).executeUpdate();
    }

    private void dropProjectDeveloperShortNameConstraints() {
        entityManager.createNativeQuery("""
                do $$
                declare
                    old_constraint text;
                begin
                    for old_constraint in
                        select c.conname
                        from pg_constraint c
                        join pg_class t on t.oid = c.conrelid
                        join pg_namespace n on n.oid = t.relnamespace
                        where n.nspname = current_schema()
                          and t.relname = 'projects'
                          and c.contype = 'u'
                          and (
                              select array_agg(a.attname::text order by a.attname::text)
                              from unnest(c.conkey) key(attnum)
                              join pg_attribute a on a.attrelid = t.oid and a.attnum = key.attnum
                          ) = array['developer_id', 'short_name']::text[]
                    loop
                        execute format('alter table %I drop constraint %I', 'projects', old_constraint);
                    end loop;
                end $$;
                """).executeUpdate();
    }

    private void synchronizeSequence(String sequenceName, String tableName) {
        entityManager.createNativeQuery("""
                SELECT setval(
                    '%s',
                    COALESCE((SELECT MAX(id) FROM %s), 1)
                )
                """.formatted(sequenceName, tableName)).getSingleResult();
    }
}
