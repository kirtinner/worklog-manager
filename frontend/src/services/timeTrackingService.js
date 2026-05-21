import api from "../api/api";

function mapTimeEntry(entry) {
    return {
        id: entry.id,
        date: entry.date,
        organizationId: entry.organizationId ?? entry.organization?.id ?? null,
        organizationName: entry.organizationName ?? entry.organization?.shortName ?? entry.organization?.fullName ?? "",
        clientId: entry.clientId,
        clientName: entry.clientName ?? entry.client?.shortName ?? entry.client?.fullName ?? "",
        taskId: entry.taskId,
        taskName: entry.taskName ?? entry.task?.name ?? "",
        hours: entry.hours,
        totalTaskHours: entry.totalTaskHours ?? 0,
        comment: entry.comment ?? "",
        developerId: entry.developerId
    };
}

function mapTask(task) {
    return {
        id: task.id,
        name: task.name ?? task.shortName ?? task.fullName ?? "",
        shortName: task.shortName ?? "",
        fullName: task.fullName ?? task.name ?? "",
        clientId: task.clientId ?? task.client?.id ?? null,
        clientName: task.clientName ?? task.client?.shortName ?? task.client?.fullName ?? "",
        organizationId: task.organizationId ?? null,
        projectId: task.projectId ?? null,
        softwareProductId: task.softwareProductId ?? null
    };
}

function mapClient(client) {
    return {
        id: client.id,
        organizationId: client.organizationId ?? client.organization?.id ?? null,
        name: client.shortName ?? client.name ?? client.fullName ?? "",
        shortName: client.shortName ?? "",
        fullName: client.fullName ?? client.name ?? ""
    };
}

let tasksRequestPromise = null;

async function loadTasksResponse() {
    if (!tasksRequestPromise) {
        tasksRequestPromise = api.get("/tasks/my").finally(() => {
            tasksRequestPromise = null;
        });
    }

    return tasksRequestPromise;
}

export async function getTimeEntriesByDate(date) {
    const response = await api.get("/time-entries", {
        params: { date }
    });

    return response.data.map(mapTimeEntry);
}

export async function getTimeEntriesByMonth(year, month) {
    const response = await api.get("/time-entries/month", {
        params: { year, month: month + 1 }
    });

    return response.data.map(mapTimeEntry);
}

export async function getTimeEntriesByTask(taskId) {
    const response = await api.get(`/tasks/${taskId}/time-entries`);
    return response.data.map(mapTimeEntry);
}

function toTimeEntryRequest(entry) {
    return {
        date: entry.date,
        organizationId: entry.organizationId,
        clientId: entry.clientId,
        taskId: entry.taskId,
        hours: entry.hours,
        comment: entry.comment ?? ""
    };
}

export async function createTimeEntry(entry) {
    const payload = toTimeEntryRequest(entry);
    console.log("[timeTrackingService] POST /time-entries payload", payload);
    const response = await api.post("/time-entries", payload);
    return mapTimeEntry(response.data);
}

export async function updateTimeEntry(id, entry) {
    const payload = toTimeEntryRequest(entry);
    console.log(`[timeTrackingService] PUT /time-entries/${id} payload`, payload);
    const response = await api.put(`/time-entries/${id}`, payload);
    return mapTimeEntry(response.data);
}

export async function deleteTimeEntry(id) {
    await api.delete(`/time-entries/${id}`);
}

export async function getClients() {
    const response = await api.get("/clients");
    return response.data.map(mapClient);
}

export async function getTasks() {
    const response = await loadTasksResponse();
    return response.data.map(mapTask);
}
