import api from "../api/api";

function normalizeTask(task) {
    return {
        id: task.id,
        completed: Boolean(task.completed),
        created_at: task.createdAt ?? task.created_at ?? "",
        task_number: task.taskNumber ?? task.task_number ?? "",
        name: task.name ?? "",
        comment: task.comment ?? "",
        task_link: task.taskLink ?? task.task_link ?? "",
        description: task.description ?? "",
        implementation_details: task.implementationDetails ?? task.implementation_details ?? "",
        estimated_hours: Number(task.estimatedHours ?? task.estimated_hours ?? 0),
        actual_hours: Number(task.actualHours ?? task.actual_hours ?? 0),
        organizationId: task.organizationId ?? null,
        clientId: task.clientId ?? null,
        projectId: task.projectId ?? null,
        softwareProductId: task.softwareProductId ?? task.software_product_id ?? null,
        softwareProductName: task.softwareProductName ?? task.software_product_name ?? ""
    };
}

function toTaskRequest(task) {
    return {
        completed: Boolean(task.completed),
        createdAt: task.created_at || null,
        taskNumber: task.task_number ?? "",
        name: task.name ?? "",
        comment: task.comment ?? "",
        taskLink: task.task_link ?? "",
        description: task.description ?? "",
        implementationDetails: task.implementation_details ?? "",
        estimatedHours: Number(task.estimated_hours ?? 0),
        organizationId: task.organizationId ?? null,
        clientId: task.clientId ?? null,
        projectId: task.projectId ?? null,
        softwareProductId: task.softwareProductId ?? null
    };
}

export async function getTasks() {
    const response = await api.get("/tasks");
    return response.data.map(normalizeTask);
}

export async function createTask(payload) {
    const response = await api.post("/tasks", toTaskRequest(payload));
    return normalizeTask(response.data);
}

export async function updateTask(id, payload) {
    const response = await api.put(`/tasks/${id}`, toTaskRequest(payload));
    return normalizeTask(response.data);
}

export async function checkTaskCanDelete(id) {
    await api.get(`/tasks/${id}/delete-check`);
}

export async function deleteTask(id) {
    await api.delete(`/tasks/${id}`);
}
