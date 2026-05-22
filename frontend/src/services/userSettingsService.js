import api from "../api/api";

function normalizeUserSettings(settings) {
    return {
        id: settings.id,
        developerId: settings.developerId ?? null,
        currentOrganizationId: settings.currentOrganizationId ?? null,
        currentOrganizationName: settings.currentOrganizationName ?? "",
        dailyHoursLimit: Number(settings.dailyHoursLimit ?? 8),
        reportsSaveDirectory: settings.reportsSaveDirectory ?? ""
    };
}

function toUserSettingsRequest(settings) {
    return {
        currentOrganizationId: settings.currentOrganizationId ?? null,
        dailyHoursLimit: Number(settings.dailyHoursLimit),
        reportsSaveDirectory: settings.reportsSaveDirectory ?? ""
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
