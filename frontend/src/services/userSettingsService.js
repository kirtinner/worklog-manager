import api from "../api/api";

function normalizeUserSettings(settings) {
    return {
        id: settings.id,
        developerId: settings.developerId ?? null,
        currentOrganizationId: settings.currentOrganizationId ?? null,
        currentOrganizationName: settings.currentOrganizationName ?? "",
        dailyHoursLimit: Number(settings.dailyHoursLimit ?? 8),
        reportsSaveDirectory: settings.reportsSaveDirectory ?? "",
        scheduledExportEnabled: Boolean(settings.scheduledExportEnabled),
        scheduledExportFolder: settings.scheduledExportFolder ?? "",
        scheduledExportTime: settings.scheduledExportTime ?? "02:00",
        scheduledExportRetentionDays: Number(settings.scheduledExportRetentionDays ?? 30),
        scheduledExportLastRunAt: settings.scheduledExportLastRunAt ?? null,
        scheduledExportLastSuccessAt: settings.scheduledExportLastSuccessAt ?? null,
        scheduledExportLastErrorMessage: settings.scheduledExportLastErrorMessage ?? ""
    };
}

function toUserSettingsRequest(settings) {
    return {
        currentOrganizationId: settings.currentOrganizationId ?? null,
        dailyHoursLimit: Number(settings.dailyHoursLimit),
        reportsSaveDirectory: settings.reportsSaveDirectory ?? "",
        scheduledExportEnabled: Boolean(settings.scheduledExportEnabled),
        scheduledExportFolder: settings.scheduledExportFolder ?? "",
        scheduledExportTime: settings.scheduledExportTime ?? "02:00",
        scheduledExportRetentionDays: Number(settings.scheduledExportRetentionDays ?? 30)
    };
}

export async function getUserSettings() {
    console.log("[userSettingsService] GET /api/user-settings");
    const response = await api.get("/user-settings");
    console.log("[userSettingsService] GET /api/user-settings response", response.status, response.data);
    return normalizeUserSettings(response.data);
}

export async function updateUserSettings(payload) {
    console.log("[userSettingsService] PUT /api/user-settings", toUserSettingsRequest(payload));
    const response = await api.put("/user-settings", toUserSettingsRequest(payload));
    console.log("[userSettingsService] PUT /api/user-settings response", response.status, response.data);
    return normalizeUserSettings(response.data);
}

export async function updateGeneralUserSettings(payload) {
    const response = await api.put("/user-settings/general", toUserSettingsRequest(payload));
    return normalizeUserSettings(response.data);
}

export async function updateScheduledExportSettings(payload) {
    const response = await api.put("/user-settings/scheduled-export", toUserSettingsRequest(payload));
    return normalizeUserSettings(response.data);
}

export async function runScheduledFullDataExportNow() {
    const response = await api.post("/user-settings/scheduled-export/run-now");
    return {
        ...response.data,
        settings: response.data?.settings ? normalizeUserSettings(response.data.settings) : null
    };
}

export async function validateFolder(path) {
    const response = await api.post("/user-settings/folders/validate", { path });
    return response.data;
}
