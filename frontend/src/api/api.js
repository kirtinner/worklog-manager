import axios from "axios";

const api = axios.create({
    baseURL: "/api"
});

api.interceptors.request.use(config => {
    const token = localStorage.getItem("token")?.trim();

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

api.interceptors.response.use(
    response => response,
    error => {
        if (error.response) {
            const status = error.response.status;

            if (status === 401) {
                localStorage.removeItem("token");
                window.location.reload();
            }

            if (status === 403) {
                console.warn("Access denied (403)", {
                    method: error.config?.method,
                    url: error.config?.url,
                    response: error.response?.data
                });
                localStorage.removeItem("token");
                window.location.reload();
            }
        }

        return Promise.reject(error);
    }
);

export default api;
