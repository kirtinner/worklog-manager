import { initialOrganizations } from "../mock/organizations";

function cloneOrganizations(items) {
    return items.map(item => ({ ...item }));
}

export async function getOrganizations() {
    return cloneOrganizations(initialOrganizations);
}

