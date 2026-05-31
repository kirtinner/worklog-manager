import api from "../api/api";

function createImportFormData(file) {
    const formData = new FormData();
    formData.append("file", file);
    return formData;
}

export async function validateImportFile(file) {
    const response = await api.post("/administration/import/validate", createImportFormData(file), {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    });

    return response.data;
}

export async function getImportSchema() {
    const response = await api.get("/import/schema");
    return response.data;
}

export async function importValidatedFile(file) {
    const response = await api.post("/administration/import", createImportFormData(file), {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    });

    return response.data;
}
