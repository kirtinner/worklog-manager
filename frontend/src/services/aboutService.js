import api from "../api/api";

export async function getAboutInfo() {
    const response = await api.get("/about");
    return response.data;
}
