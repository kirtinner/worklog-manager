import { useEffect, useMemo, useRef, useState } from "react";
import { initialOrganizations } from "../mock/organizations";

function cloneOrganizations(items) {
    return items.map(item => ({ ...item }));
}

function createOrganization(nextId) {
    return {
        id: nextId,
        shortName: "",
        fullName: ""
    };
}

function isOrganizationLinkedInSystem(organization) {
    return organization.id === 1 || organization.shortName.toUpperCase() === "CONT";
}

function validateOrganization(organization) {
    const issues = [];

    if (!organization.shortName.trim()) {
        issues.push("shortName is required.");
    }

    if (!organization.fullName.trim()) {
        issues.push("fullName is required.");
    }

    return issues;
}

export default function OrganizationsPage() {
    const [organizations, setOrganizations] = useState(cloneOrganizations(initialOrganizations));
    const [savedOrganizations, setSavedOrganizations] = useState(cloneOrganizations(initialOrganizations));
    const [selectedOrganizationId, setSelectedOrganizationId] = useState(initialOrganizations[0]?.id ?? null);
    const [editingOrganizationId, setEditingOrganizationId] = useState(null);
    const [draftOrganization, setDraftOrganization] = useState(null);
    const [editingOriginalOrganization, setEditingOriginalOrganization] = useState(null);
    const [nextId, setNextId] = useState(initialOrganizations.length + 1);
    const [validationDialogOpen, setValidationDialogOpen] = useState(false);
    const [validationIssues, setValidationIssues] = useState([]);
    const [warningDialogOpen, setWarningDialogOpen] = useState(false);
    const [warningMessage, setWarningMessage] = useState("");
    const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
    const [pendingSelectionId, setPendingSelectionId] = useState(null);
    const handleCancelRef = useRef(() => {});

    const organizationCountLabel = useMemo(
        () => `${organizations.length} organization${organizations.length === 1 ? "" : "s"}`,
        [organizations.length]
    );

    const selectedOrganization = organizations.find(organization => organization.id === selectedOrganizationId);
    const isDirty = editingOrganizationId != null || JSON.stringify(organizations) !== JSON.stringify(savedOrganizations);
    const isDraftDirty = editingOrganizationId != null && (
        editingOriginalOrganization == null ||
        draftOrganization == null ||
        draftOrganization.shortName !== editingOriginalOrganization.shortName ||
        draftOrganization.fullName !== editingOriginalOrganization.fullName
    );

    const discardCurrentEdit = (nextSelectedId = null) => {
        const currentEditingId = editingOrganizationId;
        const savedOrganization = savedOrganizations.find(organization => organization.id === currentEditingId);

        if (savedOrganization) {
            setOrganizations(currentOrganizations =>
                currentOrganizations.map(organization =>
                    organization.id === savedOrganization.id
                        ? { ...savedOrganization }
                        : organization
                )
            );
            setSelectedOrganizationId(nextSelectedId ?? savedOrganization.id);
        } else {
            setOrganizations(currentOrganizations => {
                const nextOrganizations = currentOrganizations.filter(
                    organization => organization.id !== currentEditingId
                );
                setSelectedOrganizationId(nextSelectedId ?? nextOrganizations[nextOrganizations.length - 1]?.id ?? null);
                return nextOrganizations;
            });
        }

        setEditingOrganizationId(null);
        setDraftOrganization(null);
        setEditingOriginalOrganization(null);
        return Boolean(savedOrganization);
    };

    const closeModals = () => {
        setValidationDialogOpen(false);
        setValidationIssues([]);
        setWarningDialogOpen(false);
        setWarningMessage("");
        setSwitchDialogOpen(false);
        setPendingSelectionId(null);
    };

    const beginEdit = (organization) => {
        setSelectedOrganizationId(organization.id);
        setEditingOrganizationId(organization.id);
        setDraftOrganization({ ...organization });
        setEditingOriginalOrganization({ ...organization });
        closeModals();
    };

    const commitDraft = (nextSelectedId = selectedOrganizationId) => {
        if (!draftOrganization) {
            return false;
        }

        const issues = validateOrganization(draftOrganization);
        if (issues.length > 0) {
            setValidationIssues(issues);
            setValidationDialogOpen(true);
            return false;
        }

        const nextOrganizations = organizations.map(organization =>
            organization.id === draftOrganization.id
                ? { ...draftOrganization }
                : organization
        );

        const nextSavedOrganizations = savedOrganizations.some(organization => organization.id === draftOrganization.id)
            ? savedOrganizations.map(organization =>
                organization.id === draftOrganization.id
                    ? { ...draftOrganization }
                    : organization
            )
            : [...savedOrganizations, { ...draftOrganization }];

        setOrganizations(nextOrganizations);
        setSavedOrganizations(cloneOrganizations(nextSavedOrganizations));
        setSelectedOrganizationId(nextSelectedId);
        setEditingOrganizationId(null);
        setDraftOrganization(null);
        setEditingOriginalOrganization(null);
        closeModals();
        return true;
    };

    const handleAddOrganization = () => {
        const nextOrganization = createOrganization(nextId);

        setOrganizations(currentOrganizations => [...currentOrganizations, nextOrganization]);
        setSelectedOrganizationId(nextOrganization.id);
        setEditingOrganizationId(nextOrganization.id);
        setDraftOrganization({ ...nextOrganization });
        setEditingOriginalOrganization(null);
        setNextId(currentId => currentId + 1);
        closeModals();
    };

    const handleEditOrSave = () => {
        if (editingOrganizationId != null) {
            commitDraft();
            return;
        }

        if (selectedOrganization) {
            beginEdit(selectedOrganization);
        }
    };

    const handleRowEditRequest = (organization) => {
        if (editingOrganizationId != null && organization.id !== editingOrganizationId) {
            if (isDraftDirty) {
                setPendingSelectionId(organization.id);
                setSwitchDialogOpen(true);
                return;
            }

            discardCurrentEdit(organization.id);
            beginEdit(organization);
            return;
        }

        beginEdit(organization);
    };

    const handleCancel = () => {
        if (editingOrganizationId == null) {
            return;
        }

        discardCurrentEdit();
        closeModals();
    };

    const handleRowSelect = (organization) => {
        if (editingOrganizationId != null && organization.id !== editingOrganizationId) {
            if (!isDraftDirty) {
                discardCurrentEdit(organization.id);
                closeModals();
                return;
            }

            setPendingSelectionId(organization.id);
            setSwitchDialogOpen(true);
            return;
        }

        setSelectedOrganizationId(organization.id);
    };

    const handleDraftChange = (field, nextValue) => {
        if (!draftOrganization) {
            return;
        }

        setDraftOrganization({
            ...draftOrganization,
            [field]: nextValue
        });
        setSelectedOrganizationId(draftOrganization.id);
        closeModals();
    };

    const handleDeleteOrganization = () => {
        if (!selectedOrganization) {
            return;
        }

        if (isOrganizationLinkedInSystem(selectedOrganization)) {
            setWarningMessage("Организация используется в системе и не может быть удалена.");
            setWarningDialogOpen(true);
            return;
        }

        setOrganizations(currentOrganizations =>
            currentOrganizations.filter(organization => organization.id !== selectedOrganization.id)
        );
        setSavedOrganizations(currentOrganizations =>
            currentOrganizations.filter(organization => organization.id !== selectedOrganization.id)
        );

        if (editingOrganizationId === selectedOrganization.id) {
            setEditingOrganizationId(null);
            setDraftOrganization(null);
        }

        const remaining = organizations.filter(organization => organization.id !== selectedOrganization.id);
        setSelectedOrganizationId(remaining[0]?.id ?? null);
        closeModals();
    };

    const handleSaveFromSwitchDialog = () => {
        if (commitDraft(pendingSelectionId)) {
            setSwitchDialogOpen(false);
            setPendingSelectionId(null);
        }
    };

    const handleDiscardFromSwitchDialog = () => {
        if (!editingOrganizationId) {
            setSwitchDialogOpen(false);
            setPendingSelectionId(null);
            return;
        }

        discardCurrentEdit(pendingSelectionId);
        setSwitchDialogOpen(false);
        setPendingSelectionId(null);
    };

    const handleStayEditing = () => {
        setSwitchDialogOpen(false);
        setPendingSelectionId(null);
    };

    useEffect(() => {
        handleCancelRef.current = handleCancel;
    });

    useEffect(() => {
        if (editingOrganizationId == null || validationDialogOpen || warningDialogOpen || switchDialogOpen) {
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
    }, [
        editingOrganizationId,
        switchDialogOpen,
        validationDialogOpen,
        warningDialogOpen
    ]);

    const renderRow = (organization) => {
        const isSelected = organization.id === selectedOrganizationId;
        const isEditingRow = organization.id === editingOrganizationId;

        return (
            <tr
                key={organization.id}
                className={isSelected ? "organizations-row-selected" : ""}
                onClick={() => handleRowSelect(organization)}
                onDoubleClick={() => handleRowEditRequest(organization)}
            >
                <td>
                    {isEditingRow ? (
                        <input
                            className="app-master-data-input organizations-input"
                            type="text"
                            value={draftOrganization?.shortName ?? ""}
                            onChange={event => handleDraftChange("shortName", event.target.value)}
                            onClick={event => event.stopPropagation()}
                        />
                    ) : (
                        <span className="organizations-readonly-cell">{organization.shortName}</span>
                    )}
                </td>
                <td>
                    {isEditingRow ? (
                        <input
                            className="app-master-data-input organizations-input"
                            type="text"
                            value={draftOrganization?.fullName ?? ""}
                            onChange={event => handleDraftChange("fullName", event.target.value)}
                            onClick={event => event.stopPropagation()}
                        />
                    ) : (
                        <span className="organizations-readonly-cell">{organization.fullName}</span>
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
                        <h2>Organizations</h2>
                        <p>Master data workspace for organization records</p>
                    </div>
                </div>
            </header>

            <div className="tracking-content-grid organizations-content-grid">
                <section className="tracking-panel organizations-panel">
                    <div className="tracking-panel-header organizations-panel-header">
                        <div>
                            <h3>Organization List</h3>
                            <p className="organizations-subtitle">{organizationCountLabel}</p>
                        </div>

                        <div className="organizations-toolbar">
                            {editingOrganizationId != null ? (
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
                                        <button type="button" className="tracking-save-button" onClick={handleAddOrganization}>
                                            Add
                                        </button>
                                        <button type="button" className="tracking-save-button" onClick={handleEditOrSave}>
                                            Edit
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        className="organizations-delete-button organizations-delete-button-separated"
                                        onClick={handleDeleteOrganization}
                                        disabled={!selectedOrganization}
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
                            <tbody>{organizations.map(renderRow)}</tbody>
                        </table>
                    </div>
                </section>
            </div>

            {validationDialogOpen && (
                <div className="tracking-modal-overlay" role="presentation">
                    <div
                        className="tracking-modal tracking-modal-confirm"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="organizations-validation-title"
                    >
                        <div className="tracking-modal-header">
                            <h3 id="organizations-validation-title">Validation errors</h3>
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
                    <div
                        className="tracking-modal tracking-modal-confirm"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="organizations-warning-title"
                    >
                        <div className="tracking-modal-header">
                            <h3 id="organizations-warning-title">Delete not available</h3>
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
                    <div
                        className="tracking-modal tracking-modal-confirm"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="organizations-switch-title"
                    >
                        <div className="tracking-modal-header">
                            <h3 id="organizations-switch-title">Unsaved changes</h3>
                        </div>
                        <div className="tracking-modal-body">
                            <p className="tracking-modal-text">
                                There are unsaved changes for the current organization. What do you want to do?
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
