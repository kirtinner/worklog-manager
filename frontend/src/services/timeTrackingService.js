import api from "../api/api";

function isLocalTimeEntryId(id) {
    return typeof id === "string" && id.startsWith("local-");
}

function mapTimeEntry(entry) {
    return {
        id: entry.id,
        date: entry.date,
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
        name: task.name,
        clientId: task.clientId ?? task.client?.id ?? null,
        clientName: task.clientName ?? task.client?.shortName ?? task.client?.fullName ?? ""
    };
}

function uniqueClientsFromTasks(tasks) {
    const clientsById = new Map();

    tasks.forEach(task => {
        const clientId = task.clientId ?? task.client?.id ?? null;
        if (clientId == null || clientsById.has(clientId)) {
            return;
        }

        clientsById.set(clientId, {
            id: clientId,
            name: task.clientName ?? task.client?.shortName ?? task.client?.fullName ?? ""
        });
    });

    return [...clientsById.values()];
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

export async function saveTimeEntriesForDate(date, entries) {
    const payload = entries.map(entry => {
        const base = {
            clientId: entry.clientId,
            taskId: entry.taskId,
            hours: entry.hours,
            comment: entry.comment ?? ""
        };

        if (isLocalTimeEntryId(entry.id)) {
            return {
                ...base,
                id: null
            };
        }

        return {
            ...base,
            id: entry.id
        };
    });

    const response = await api.put("/time-entries/day", payload, {
        params: { date }
    });

    return response.data.map(mapTimeEntry);
}

export async function getClients() {
    const response = await loadTasksResponse();
    return uniqueClientsFromTasks(response.data);
}

export async function getTasks() {
    const response = await loadTasksResponse();
    return response.data.map(mapTask);
}
