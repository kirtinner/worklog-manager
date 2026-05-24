export function createLocalWorklogEntry(date, nextId, organizationId = null) {
    return {
        id: `local-${date}-${nextId}`,
        organizationId,
        organizationName: "",
        clientId: null,
        clientName: "New Client",
        projectId: null,
        projectName: "",
        taskId: null,
        taskName: "",
        date,
        hours: 1,
        totalTaskHours: 1,
        comment: "New local worklog entry",
        modified: true
    };
}
