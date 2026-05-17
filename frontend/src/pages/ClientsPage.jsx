import { useEffect, useMemo, useRef, useState } from "react";
import { getClients as loadClients } from "../services/clientsService";

function cloneClients(items) {
    return items.map(item => ({ ...item }));
}

function createClient(nextId, organizationId) {
    return {
        id: nextId,
        organizationId,
        shortName: "",
        fullName: ""
    };
}

function isClientLinkedInSystem(client) {
    return client.id === 101 || client.shortName.toUpperCase() === "ACME";
}

function validateClient(client) {
    const issues = [];

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
    const [savedClients, setSavedClients] = useState([]);
    const [selectedOrganizationId, setSelectedOrganizationId] = useState(currentOrganizationId ?? organizations[0]?.id ?? null);
    const [selectedClientId, setSelectedClientId] = useState(null);
    const [editingClientId, setEditingClientId] = useState(null);
    const [draftClient, setDraftClient] = useState(null);
    const [editingOriginalClient, setEditingOriginalClient] = useState(null);
    const [nextId, setNextId] = useState(106);
    const [validationDialogOpen, setValidationDialogOpen] = useState(false);
    const [validationIssues, setValidationIssues] = useState([]);
    const [warningDialogOpen, setWarningDialogOpen] = useState(false);
    const [warningMessage, setWarningMessage] = useState("");
    const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
    const [pendingSelectionId, setPendingSelectionId] = useState(null);
    const [pendingOrganizationId, setPendingOrganizationId] = useState(null);
    const handleCancelRef = useRef(() => {});

    const filteredClients = useMemo(
        () => clients.filter(client => client.organizationId === selectedOrganizationId),
        [clients, selectedOrganizationId]
    );

    const selectedClient = clients.find(client => client.id === selectedClientId) ?? null;
    const isDirty = editingClientId != null || JSON.stringify(clients) !== JSON.stringify(savedClients);
    const isDraftDirty = editingClientId != null && (
        editingOriginalClient == null ||
        draftClient == null ||
        draftClient.shortName !== editingOriginalClient.shortName ||
        draftClient.fullName !== editingOriginalClient.fullName ||
        draftClient.organizationId !== editingOriginalClient.organizationId
    );
    const clientCountLabel = `${filteredClients.length} client${filteredClients.length === 1 ? "" : "s"}`;

    useEffect(() => {
        let active = true;

        async function loadData() {
            try {
                const nextClients = await loadClients();

                if (!active) {
                    return;
                }

                setClients(nextClients);
                setSavedClients(cloneClients(nextClients));
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
    }, [organizations]);

    const closeModals = () => {
        setValidationDialogOpen(false);
        setValidationIssues([]);
        setWarningDialogOpen(false);
        setWarningMessage("");
        setSwitchDialogOpen(false);
        setPendingSelectionId(null);
        setPendingOrganizationId(null);
    };

    const beginEdit = (client) => {
        setSelectedClientId(client.id);
        setEditingClientId(client.id);
        setDraftClient({ ...client });
        setEditingOriginalClient({ ...client });
        closeModals();
    };

    const discardCurrentEdit = (nextSelectedId = null) => {
        const currentEditingId = editingClientId;
        const savedClient = savedClients.find(client => client.id === currentEditingId);

        if (savedClient) {
            setClients(currentClients =>
                currentClients.map(client =>
                    client.id === savedClient.id
                        ? { ...savedClient }
                        : client
                )
            );
            setSelectedClientId(nextSelectedId ?? savedClient.id);
        } else {
            setClients(currentClients => currentClients.filter(client => client.id !== currentEditingId));
        }

        setEditingClientId(null);
        setDraftClient(null);
        setEditingOriginalClient(null);
        const nextVisibleClient = savedClient
            ? null
            : clients.find(client => client.organizationId === selectedOrganizationId && client.id !== currentEditingId) ?? null;
        if (!savedClient) {
            setSelectedClientId(nextVisibleClient?.id ?? nextSelectedId ?? null);
        }
        return Boolean(savedClient);
    };

    const commitDraft = (nextSelectedId = selectedClientId) => {
        if (!draftClient) {
            return false;
        }

        const issues = validateClient(draftClient);
        if (issues.length > 0) {
            setValidationIssues(issues);
            setValidationDialogOpen(true);
            return false;
        }

        const nextClients = clients.map(client =>
            client.id === draftClient.id
                ? { ...draftClient }
                : client
        );

        const nextSavedClients = savedClients.some(client => client.id === draftClient.id)
            ? savedClients.map(client =>
                client.id === draftClient.id
                    ? { ...draftClient }
                    : client
            )
            : [...savedClients, { ...draftClient }];

        setClients(nextClients);
        setSavedClients(cloneClients(nextSavedClients));
        setSelectedClientId(nextSelectedId);
        setEditingClientId(null);
        setDraftClient(null);
        setEditingOriginalClient(null);
        closeModals();
        return true;
    };

    const handleAddClient = () => {
        const nextClient = createClient(nextId, selectedOrganizationId);

        setClients(currentClients => [...currentClients, nextClient]);
        setSelectedClientId(nextClient.id);
        setEditingClientId(nextClient.id);
        setDraftClient({ ...nextClient });
        setEditingOriginalClient(null);
        setNextId(currentId => currentId + 1);
        closeModals();
    };

    const handleEditOrSave = () => {
        if (editingClientId != null) {
            commitDraft();
            return;
        }

        if (selectedClient) {
            beginEdit(selectedClient);
        }
    };

    const handleRowEditRequest = (client) => {
        if (editingClientId != null && client.id !== editingClientId) {
            if (isDraftDirty) {
                setPendingSelectionId(client.id);
                setSwitchDialogOpen(true);
                return;
            }

            discardCurrentEdit(client.id);
            beginEdit(client);
            return;
        }

        beginEdit(client);
    };

    const handleCancel = () => {
        if (editingClientId == null) {
            return;
        }

        discardCurrentEdit();
        closeModals();
    };

    const handleRowSelect = (client) => {
        if (editingClientId != null && client.id !== editingClientId) {
            if (!isDraftDirty) {
                discardCurrentEdit(client.id);
                closeModals();
                return;
            }

            setPendingSelectionId(client.id);
            setSwitchDialogOpen(true);
            return;
        }

        setSelectedClientId(client.id);
    };

    const handleDraftChange = (field, nextValue) => {
        if (!draftClient) {
            return;
        }

        setDraftClient({
            ...draftClient,
            [field]: nextValue
        });
        closeModals();
    };

    const handleOrganizationChange = (nextOrganizationId) => {
        const parsedOrganizationId = Number(nextOrganizationId);

        if (editingClientId != null && isDraftDirty) {
            setPendingOrganizationId(parsedOrganizationId);
            setSwitchDialogOpen(true);
            return;
        }

        if (editingClientId != null) {
            discardCurrentEdit();
        }

        setSelectedOrganizationId(parsedOrganizationId);
        const nextVisibleClient = clients.find(client => client.organizationId === parsedOrganizationId) ?? null;
        setSelectedClientId(nextVisibleClient?.id ?? null);
        closeModals();
    };

    const handleDeleteClient = () => {
        if (!selectedClient) {
            return;
        }

        if (isClientLinkedInSystem(selectedClient)) {
            setWarningMessage("Client is used in the system and cannot be deleted.");
            setWarningDialogOpen(true);
            return;
        }

        setClients(currentClients =>
            currentClients.filter(client => client.id !== selectedClient.id)
        );
        setSavedClients(currentSavedClients =>
            currentSavedClients.filter(client => client.id !== selectedClient.id)
        );

        if (editingClientId === selectedClient.id) {
            setEditingClientId(null);
            setDraftClient(null);
        }

        const remaining = filteredClients.filter(client => client.id !== selectedClient.id);
        setSelectedClientId(remaining[0]?.id ?? null);
        closeModals();
    };

    const handleSaveFromSwitchDialog = () => {
        if (commitDraft(pendingSelectionId)) {
            if (pendingOrganizationId != null) {
                setSelectedOrganizationId(pendingOrganizationId);
                const nextVisibleClient = clients.find(client => client.organizationId === pendingOrganizationId) ?? null;
                setSelectedClientId(nextVisibleClient?.id ?? null);
            }
            setSwitchDialogOpen(false);
            setPendingSelectionId(null);
            setPendingOrganizationId(null);
        }
    };

    const handleDiscardFromSwitchDialog = () => {
        if (editingClientId == null) {
            setSwitchDialogOpen(false);
            setPendingSelectionId(null);
            setPendingOrganizationId(null);
            return;
        }

        discardCurrentEdit(pendingSelectionId);
        if (pendingOrganizationId != null) {
            setSelectedOrganizationId(pendingOrganizationId);
            const nextVisibleClient = clients.find(client => client.organizationId === pendingOrganizationId) ?? null;
            setSelectedClientId(nextVisibleClient?.id ?? null);
        }
        setSwitchDialogOpen(false);
        setPendingSelectionId(null);
        setPendingOrganizationId(null);
    };

    const handleStayEditing = () => {
        setSwitchDialogOpen(false);
        setPendingSelectionId(null);
        setPendingOrganizationId(null);
    };

    useEffect(() => {
        handleCancelRef.current = handleCancel;
    });

    useEffect(() => {
        if (editingClientId == null || validationDialogOpen || warningDialogOpen || switchDialogOpen) {
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
    }, [editingClientId, switchDialogOpen, validationDialogOpen, warningDialogOpen]);

    const renderRow = (client) => {
        const isSelected = client.id === selectedClientId;
        const isEditingRow = client.id === editingClientId;

        return (
            <tr
                key={client.id}
                className={isSelected ? "organizations-row-selected" : ""}
                onClick={() => handleRowSelect(client)}
                onDoubleClick={() => handleRowEditRequest(client)}
            >
                <td>
                    {isEditingRow ? (
                        <input
                            className="app-master-data-input organizations-input"
                            type="text"
                            value={draftClient?.shortName ?? ""}
                            onChange={event => handleDraftChange("shortName", event.target.value)}
                            onClick={event => event.stopPropagation()}
                        />
                    ) : (
                        <span className="organizations-readonly-cell">{client.shortName}</span>
                    )}
                </td>
                <td>
                    {isEditingRow ? (
                        <input
                            className="app-master-data-input organizations-input"
                            type="text"
                            value={draftClient?.fullName ?? ""}
                            onChange={event => handleDraftChange("fullName", event.target.value)}
                            onClick={event => event.stopPropagation()}
                        />
                    ) : (
                        <span className="organizations-readonly-cell">{client.fullName}</span>
                    )}
                </td>
            </tr>
        );
    };

    return (
        <div className="tracking-main organizations-main" data-dirty={isDirty ? "true" : "false"}>
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
                <select
                    id="clients-organization-select"
                    className="clients-filter-select"
                    value={String(selectedOrganizationId ?? "")}
                    onChange={event => handleOrganizationChange(event.target.value)}
                >
                    {organizations.map(organization => (
                        <option key={organization.id} value={String(organization.id)}>
                            {organization.shortName} - {organization.fullName}
                        </option>
                    ))}
                </select>
            </div>

            <div className="tracking-content-grid organizations-content-grid">
                <section className="tracking-panel organizations-panel">
                    <div className="tracking-panel-header organizations-panel-header clients-panel-header">
                        <div>
                            <h3>Client List</h3>
                            <p className="organizations-subtitle">{clientCountLabel}</p>
                        </div>

                        <div className="clients-toolbar">
                            {editingClientId != null ? (
                                <>
                                    <button type="button" className="tracking-save-button" onClick={handleEditOrSave}>
                                        Save
                                    </button>
                                    <button type="button" className="tracking-save-button" onClick={handleCancel}>
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="organizations-toolbar-actions">
                                        <button type="button" className="tracking-save-button" onClick={handleAddClient}>
                                            Add
                                        </button>
                                        <button
                                            type="button"
                                            className="tracking-save-button"
                                            onClick={handleEditOrSave}
                                            disabled={!selectedClient}
                                        >
                                            Edit
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        className="organizations-delete-button organizations-delete-button-separated"
                                        onClick={handleDeleteClient}
                                        disabled={!selectedClient}
                                    >
                                        Delete
                                    </button>
                                </>
                            )}
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
                            <h3 id="clients-warning-title">Delete not available</h3>
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

            {switchDialogOpen && (
                <div className="tracking-modal-overlay" role="presentation">
                    <div className="tracking-modal tracking-modal-confirm" role="dialog" aria-modal="true" aria-labelledby="clients-switch-title">
                        <div className="tracking-modal-header">
                            <h3 id="clients-switch-title">Unsaved changes</h3>
                        </div>
                        <div className="tracking-modal-body">
                            <p className="tracking-modal-text">
                                There are unsaved changes for the current client. What do you want to do?
                            </p>
                        </div>
                        <div className="tracking-modal-actions">
                            <button type="button" className="tracking-modal-button" onClick={handleSaveFromSwitchDialog}>
                                Save changes
                            </button>
                            <button type="button" className="tracking-modal-button" onClick={handleDiscardFromSwitchDialog}>
                                Discard changes
                            </button>
                            <button type="button" className="tracking-modal-button tracking-modal-button-secondary" onClick={handleStayEditing}>
                                Stay
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
