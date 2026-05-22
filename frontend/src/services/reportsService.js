import api from "../api/api";

function mapReportTask(task) {
    return {
        taskId: task.taskId,
        taskName: task.taskName ?? "",
        hours: Number(task.hours ?? 0)
    };
}

function mapReportClient(client) {
    return {
        clientId: client.clientId,
        clientName: client.clientName ?? "",
        totalHours: Number(client.totalHours ?? 0),
        tasks: (client.tasks ?? []).map(mapReportTask)
    };
}

export async function getWorkEffortReport(from, to) {
    const response = await api.get("/reports/work-effort", {
        params: { from, to }
    });

    return {
        from: response.data.from,
        to: response.data.to,
        grandTotalHours: Number(response.data.grandTotalHours ?? 0),
        clients: (response.data.clients ?? []).map(mapReportClient)
    };
}
