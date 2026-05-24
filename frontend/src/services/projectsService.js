import api from "../api/api";

function normalizeProject(project) {
    return {
        id: project.id,
        organizationId: project.organizationId ?? null,
        organizationName: project.organizationName ?? project.organization?.shortName ?? "",
        clientId: project.clientId ?? null,
        clientName: project.clientName ?? project.client?.shortName ?? "",
        shortName: project.shortName ?? "",
        fullName: project.fullName ?? "",
        description: project.description ?? "",
        completed: Boolean(project.completed)
    };
}

export async function getProjects() {
    const response = await api.get("/projects");
    return response.data.map(normalizeProject);
}

export async function createProject(payload) {
    const response = await api.post("/projects", payload);
    return normalizeProject(response.data);
}

export async function updateProject(id, payload) {
    const response = await api.put(`/projects/${id}`, payload);
    return normalizeProject(response.data);
}

export async function deleteProject(id) {
    await api.delete(`/projects/${id}`);
}
