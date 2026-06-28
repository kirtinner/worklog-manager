import api from "../api/api";

export async function getCurrentUser() {
    const response = await api.get("/auth/me");
    return response.data;
}

export async function changePassword(payload) {
    const response = await api.post("/auth/change-password", {
        currentPassword: payload.currentPassword,
        newPassword: payload.newPassword,
        confirmNewPassword: payload.confirmNewPassword
    });
    return response.data;
}
