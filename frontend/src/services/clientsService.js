import { initialClients } from "../mock/clientRecords";

function cloneClients(items) {
    return items.map(item => ({ ...item }));
}

export async function getClients() {
    return cloneClients(initialClients);
}

