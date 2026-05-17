import { initialProjects } from "../mock/projectRecords";

function cloneProjects(items) {
    return items.map(item => ({ ...item }));
}

export async function getProjects() {
    return cloneProjects(initialProjects);
}

