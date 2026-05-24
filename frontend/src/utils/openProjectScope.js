function sameId(left, right) {
    return left != null && right != null && String(left) === String(right);
}

function normalizeId(value) {
    return value == null ? null : String(value);
}

function createIdSet(values = []) {
    return new Set(values.filter(value => value != null).map(value => String(value)));
}

export function buildOpenProjectScope(projects = []) {
    const organizationIds = new Set();
    const clientIds = new Set();
    const projectIds = new Set();
    const organizationClientIds = new Map();

    projects.forEach(project => {
        if (!project || project.completed) {
            return;
        }

        const organizationId = normalizeId(project.organizationId);
        const clientId = normalizeId(project.clientId);
        const projectId = normalizeId(project.id);

        if (organizationId != null) {
            organizationIds.add(organizationId);
        }

        if (clientId != null) {
            clientIds.add(clientId);
        }

        if (projectId != null) {
            projectIds.add(projectId);
        }

        if (organizationId != null && clientId != null) {
            if (!organizationClientIds.has(organizationId)) {
                organizationClientIds.set(organizationId, new Set());
            }

            organizationClientIds.get(organizationId).add(clientId);
        }
    });

    return {
        organizationIds,
        clientIds,
        projectIds,
        organizationClientIds
    };
}

export function filterOrganizationsForOpenProjects(organizations = [], openProjectScope, includeIds = []) {
    const allowedIds = new Set(openProjectScope?.organizationIds ?? []);
    createIdSet(includeIds).forEach(id => allowedIds.add(id));

    return organizations.filter(organization => allowedIds.has(normalizeId(organization.id)));
}

export function filterClientsForOpenProjects(clients = [], openProjectScope, organizationId = null, includeIds = []) {
    const allowedIds = organizationId == null
        ? new Set(openProjectScope?.clientIds ?? [])
        : new Set(openProjectScope?.organizationClientIds.get(normalizeId(organizationId)) ?? []);

    createIdSet(includeIds).forEach(id => allowedIds.add(id));

    return clients.filter(client => allowedIds.has(normalizeId(client.id)));
}

export function filterProjectsForOpenProjects(projects = [], organizationId = null, clientId = null, includeIds = []) {
    const allowedIds = createIdSet(includeIds);

    return projects.filter(project => {
        const projectId = normalizeId(project.id);
        if (allowedIds.has(projectId)) {
            return true;
        }

        if (project.completed) {
            return false;
        }

        if (organizationId != null && !sameId(project.organizationId, organizationId)) {
            return false;
        }

        if (clientId != null && !sameId(project.clientId, clientId)) {
            return false;
        }

        return true;
    });
}
