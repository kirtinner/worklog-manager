import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    createClient as apiCreateClient,
    deleteClient as apiDeleteClient,
    getClients as loadClients,
    updateClient as apiUpdateClient
} from "../services/clientsService";

function createClientDraft(organizationId) {
    return {
        id: null,
        organizationId,
        shortName: "",
        fullName: ""
    };
}

function validateClient(client) {
    const issues = [];

    if (client.organizationId == null) {
        issues.push("organization is required.");
    }

    if (!client.shortName.trim()) {
        issues.push("shortName is required.");
    }

    if (!client.fullName.trim()) {
        issues.push("fullName is required.");
    }

    return issues;
}

export default function ClientsPage({
    organizations = [],
    currentOrganizationId = null
}) {
    const [clients, setClients] = useState([]);
    const [selectedOrganizationId, setSelectedOrganizationId] = useState(currentOrganizationId ?? organizations[0]?.id ?? null);
    const [selectedClientId, setSelectedClientId] = useState(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorMode, setEditorMode] = useState(null);
    const [draftClient, setDraftClient] = useState(null);
    const [validationDialogOpen, setValidationDialogOpen] = useState(false);
    const [validationIssues, setValidationIssues] = useState([]);
    const [warningDialogOpen, setWarningDialogOpen] = useState(false);
    const [warningTitle, setWarningTitle] = useState("Delete not available");
    const [warningMessage, setWarningMessage] = useState("");
    const handleCancelRef = useRef(() => {});

    const filteredClients = useMemo(
        () => selectedOrganizationId == null
            ? clients
            : clients.filter(client => client.organizationId === selectedOrganizationId),
        [clients, selectedOrganizationId]
    );

    const selectedClient = filteredClients.find(client => client.id === selectedClientId) ?? null;
    const clientCountLabel = `${filteredClients.length} client${filteredClients.length === 1 ? "" : "s"}`;

    useEffect(() => {
        let active = true;

        async function loadData() {
            try {
                const nextClients = await loadClients();

                if (!active) {
                    return;
                }

                const initialOrganizationId =
                    currentOrganizationId
                    ?? organizations[0]?.id
                    ?? nextClients[0]?.organizationId
                    ?? null;
                const initialClientId = nextClients.find(client => client.organizationId === initialOrganizationId)?.id ?? null;

                setClients(nextClients);
                setSelectedOrganizationId(initialOrganizationId);
                setSelectedClientId(initialClientId);
            } catch {
                if (!active) {
                    return;
                }
            }
        }

        loadData();

        return () => {
            active = false;
        };
    }, [currentOrganizationId, organizations]);

    const closeTransientDialogs = useCallback(() => {
        setValidationDialogOpen(false);
        setValidationIssues([]);
        setWarningDialogOpen(false);
        setWarningTitle("Delete not available");
        setWarningMessage("");
    }, []);

    const closeEditor = useCallback(() => {
        setEditorOpen(false);
        setEditorMode(null);
        setDraftClient(null);
        closeTransientDialogs();
    }, [closeTransientDialogs]);

    const openEditorForExisting = (client) => {
        setSelectedClientId(client.id);
        setEditorOpen(true);
        setEditorMode("edit");
        setDraftClient({ ...client });
        closeTransientDialogs();
    };

    const openEditorForNew = () => {
        const nextDraft = createClientDraft(selectedOrganizationId);

        setEditorOpen(true);
        setEditorMode("add");
        setDraftClient(nextDraft);
        closeTransientDialogs();
    };

    const selectFirstVisibleClient = (nextClients, organizationId) => {
        setSelectedClientId(nextClients.find(client => client.organizationId === organizationId)?.id ?? null);
    };

    const handleAddClient = () => {
        if (editorOpen) {
            return;
        }

        openEditorForNew();
    };

    const handleEditClient = () => {
        if (selectedClient && !editorOpen) {
            openEditorForExisting(selectedClient);
        }
    };

    const handleRowSelect = (client) => {
        setSelectedClientId(client.id);
    };

    const handleRowEditRequest = (client) => {
        if (!editorOpen) {
            openEditorForExisting(client);
        }
    };

    const handleDraftChange = (field, nextValue) => {
        setDraftClient(current => (current ? {
            ...current,
            [field]: nextValue
        } : current));
    };

    const handleDraftOrganizationChange = (nextOrganizationId) => {
        const parsedOrganizationId = nextOrganizationId === "" ? null : Number(nextOrganizationId);
        handleDraftChange("organizationId", parsedOrganizationId);
    };

    const handleOrganizationChange = (nextOrganizationId) => {
        const parsedOrganizationId = nextOrganizationId === "" ? null : Number(nextOrganizationId);

        setSelectedOrganizationId(parsedOrganizationId);
        setSelectedClientId(clients.find(client =>
            parsedOrganizationId == null || client.organizationId === parsedOrganizationId
        )?.id ?? null);
        closeTransientDialogs();
    };

    const handleClearOrganizationFilter = () => {
        setSelectedOrganizationId(null);
        closeTransientDialogs();
    };

    const handleDeleteClient = async () => {
        if (!selectedClient || editorOpen) {
            return;
        }

        const clientId = selectedClient.id;
        try {
            await apiDeleteClient(clientId);
            const nextClients = clients.filter(client => client.id !== clientId);

            setClients(nextClients);
            selectFirstVisibleClient(nextClients, selectedOrganizationId);
            closeTransientDialogs();
        } catch (error) {
            const message =
                error?.response?.data?.message ??
                error?.response?.data?.error ??
                error?.message ??
                "Client is used in the system and cannot be deleted.";
            setWarningTitle("Delete not available");
            setWarningMessage(message);
            setWarningDialogOpen(true);
        }
    };

    const handleSaveClient = async () => {
        if (!draftClient) {
            return;
        }

        const issues = validateClient(draftClient);
        if (issues.length > 0) {
            setValidationIssues(issues);
            setValidationDialogOpen(true);
            return;
        }

        try {
            const isNewClient = editorMode === "add";
            const payload = {
                organizationId: draftClient.organizationId,
                shortName: draftClient.shortName.trim(),
                fullName: draftClient.fullName.trim()
            };
            const savedClient = isNewClient
                ? await apiCreateClient(payload)
                : await apiUpdateClient(draftClient.id, payload);
            const normalizedClient = {
                ...draftClient,
                ...savedClient,
                ...payload
            };

            const nextClients = isNewClient
                ? [...clients, normalizedClient]
                : clients.map(client =>
                    client.id === draftClient.id
                        ? normalizedClient
                        : client
                );

            setClients(nextClients);
            if (normalizedClient.organizationId === selectedOrganizationId) {
                setSelectedClientId(normalizedClient.id);
            } else {
                selectFirstVisibleClient(nextClients, selectedOrganizationId);
            }
            closeEditor();
        } catch (error) {
            const message =
                error?.response?.data?.message ??
                error?.response?.data?.error ??
                error?.message ??
                "Unable to save client.";
            setWarningTitle("Save not available");
            setWarningMessage(message);
            setWarningDialogOpen(true);
        }
    };

    const handleCancelClient = () => {
        if (!editorOpen) {
            return;
        }

        closeEditor();
    };

    useEffect(() => {
        handleCancelRef.current = handleCancelClient;
    });

    useEffect(() => {
        if (!editorOpen || validationDialogOpen || warningDialogOpen) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key !== "Escape") {
                return;
            }

            event.preventDefault();
            handleCancelRef.current();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [editorOpen, validationDialogOpen, warningDialogOpen]);

    const renderRow = (client) => {
        const isSelected = client.id === selectedClientId;

        return (
            <tr
                key={client.id}
                className={isSelected ? "organizations-row-selected" : ""}
                onClick={() => handleRowSelect(client)}
                onDoubleClick={() => handleRowEditRequest(client)}
            >
                <td>
                    <span className="organizations-readonly-cell">{client.shortName}</span>
                </td>
                <td>
                    <span className="organizations-readonly-cell">{client.fullName}</span>
                </td>
            </tr>
        );
    };

    return (
        <div className="tracking-main organizations-main">
            <header className="tracking-topbar">
                <div className="tracking-topbar-main">
                    <div>
                        <h2>Clients</h2>
                        <p>Master data workspace for client records</p>
                    </div>
                </div>
            </header>

            <div className="clients-filter-bar">
                <label className="clients-filter-label" htmlFor="clients-organization-select">
                    Organization
                </label>
                <div className="selector-clear-control">
                    <select
                        id="clients-organization-select"
                        className="clients-filter-select"
                        value={String(selectedOrganizationId ?? "")}
                        onChange={event => handleOrganizationChange(event.target.value)}
                    >
                        <option value=""></option>
                        {organizations.map(organization => (
                            <option key={organization.id} value={String(organization.id)}>
                                {organization.shortName}
                            </option>
                        ))}
                    </select>
                    {selectedOrganizationId != null && (
                        <button type="button" className="selector-clear-button" onClick={handleClearOrganizationFilter} aria-label="Clear organization filter">
                            ×
                        </button>
                    )}
                </div>
            </div>

            <div className="tracking-content-grid organizations-content-grid">
                <section className="tracking-panel organizations-panel">
                    <div className="tracking-panel-header organizations-panel-header clients-panel-header">
                        <div>
                            <h3>Client List</h3>
                            <p className="organizations-subtitle">{clientCountLabel}</p>
                        </div>

                        <div className="clients-toolbar">
                            <div className="organizations-toolbar-actions">
                                <button
                                    type="button"
                                    className="tracking-save-button"
                                    onClick={handleAddClient}
                                    disabled={editorOpen}
                                >
                                    Add
                                </button>
                                <button
                                    type="button"
                                    className="tracking-save-button"
                                    onClick={handleEditClient}
                                    disabled={editorOpen || !selectedClient}
                                >
                                    Edit
                                </button>
                            </div>
                            <button
                                type="button"
                                className="organizations-delete-button organizations-delete-button-separated"
                                onClick={handleDeleteClient}
                                disabled={editorOpen || !selectedClient}
                            >
                                Delete
                            </button>
                        </div>
                    </div>

                    <div className="tracking-panel-body organizations-panel-body">
                        <table className="app-master-data-table organizations-table">
                            <colgroup>
                                <col className="organizations-col-short" />
                                <col className="organizations-col-full" />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>Short Name</th>
                                    <th>Full Name</th>
                                </tr>
                            </thead>
                            <tbody>{filteredClients.map(renderRow)}</tbody>
                        </table>
                    </div>
                </section>
            </div>

            {editorOpen && draftClient && (
                <div className="tracking-modal-overlay" role="presentation">
                    <div
                        className="tracking-modal tracking-modal-confirm tracking-modal-client-editor"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="clients-editor-title"
                    >
                        <div className="tracking-modal-header">
                            <h3 id="clients-editor-title">{editorMode === "add" ? "Add Client" : "Edit Client"}</h3>
                        </div>
                        <div className="tracking-modal-body">
                            <div className="tracking-modal-fields">
                                <label className="tracking-modal-field">
                                    <span>Organization</span>
                                    <div className="selector-clear-control">
                                        <select
                                            value={String(draftClient.organizationId ?? "")}
                                            onChange={event => handleDraftOrganizationChange(event.target.value)}
                                        >
                                            <option value=""></option>
                                            {organizations.map(organization => (
                                                <option key={organization.id} value={String(organization.id)}>
                                                    {organization.shortName}
                                                </option>
                                            ))}
                                        </select>
                                        {draftClient.organizationId != null && (
                                            <button type="button" className="selector-clear-button" onClick={() => handleDraftOrganizationChange("")} aria-label="Clear organization">
                                                ×
                                            </button>
                                        )}
                                    </div>
                                </label>

                                <label className="tracking-modal-field">
                                    <span>Short Name</span>
                                    <input
                                        type="text"
                                        value={draftClient.shortName ?? ""}
                                        onChange={event => handleDraftChange("shortName", event.target.value)}
                                    />
                                </label>

                                <label className="tracking-modal-field">
                                    <span>Full Name</span>
                                    <input
                                        type="text"
                                        value={draftClient.fullName ?? ""}
                                        onChange={event => handleDraftChange("fullName", event.target.value)}
                                    />
                                </label>
                            </div>
                        </div>
                        <div className="tracking-modal-actions">
                            <button type="button" className="tracking-modal-button" onClick={handleSaveClient}>
                                Save
                            </button>
                            <button
                                type="button"
                                className="tracking-modal-button tracking-modal-button-secondary"
                                onClick={handleCancelClient}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {validationDialogOpen && (
                <div className="tracking-modal-overlay" role="presentation">
                    <div className="tracking-modal tracking-modal-confirm" role="dialog" aria-modal="true" aria-labelledby="clients-validation-title">
                        <div className="tracking-modal-header">
                            <h3 id="clients-validation-title">Validation errors</h3>
                        </div>
                        <div className="tracking-modal-body">
                            <ul className="tracking-modal-list">
                                {validationIssues.map((issue, index) => (
                                    <li key={`${issue}-${index}`}>{issue}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="tracking-modal-actions">
                            <button type="button" className="tracking-modal-button" onClick={() => setValidationDialogOpen(false)}>
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {warningDialogOpen && (
                <div className="tracking-modal-overlay" role="presentation">
                    <div className="tracking-modal tracking-modal-confirm" role="dialog" aria-modal="true" aria-labelledby="clients-warning-title">
                        <div className="tracking-modal-header">
                            <h3 id="clients-warning-title">{warningTitle}</h3>
                        </div>
                        <div className="tracking-modal-body">
                            <p className="tracking-modal-text">{warningMessage}</p>
                        </div>
                        <div className="tracking-modal-actions">
                            <button type="button" className="tracking-modal-button" onClick={() => setWarningDialogOpen(false)}>
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
