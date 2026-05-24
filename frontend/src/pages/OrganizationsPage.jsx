import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    createOrganization as apiCreateOrganization,
    deleteOrganization as apiDeleteOrganization,
    getOrganizations as loadOrganizations,
    updateOrganization as apiUpdateOrganization
} from "../services/organizationsService";

function createOrganizationDraft() {
    return {
        id: null,
        shortName: "",
        fullName: ""
    };
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

export default function OrganizationsPage({ currentOrganizationId = null, onCurrentOrganizationChange = async () => {} }) {
    const [organizations, setOrganizations] = useState([]);
    const [selectedOrganizationId, setSelectedOrganizationId] = useState(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorMode, setEditorMode] = useState(null);
    const [draftOrganization, setDraftOrganization] = useState(null);
    const [draftOrganizationIsCurrent, setDraftOrganizationIsCurrent] = useState(false);
    const [validationDialogOpen, setValidationDialogOpen] = useState(false);
    const [validationIssues, setValidationIssues] = useState([]);
    const [warningDialogOpen, setWarningDialogOpen] = useState(false);
    const [warningTitle, setWarningTitle] = useState("Delete not available");
    const [warningMessage, setWarningMessage] = useState("");
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const handleCancelRef = useRef(() => {});

    const organizationCountLabel = useMemo(
        () => `${organizations.length} organization${organizations.length === 1 ? "" : "s"}`,
        [organizations.length]
    );

    const selectedOrganization = organizations.find(organization => organization.id === selectedOrganizationId) ?? null;
    const orderedOrganizations = useMemo(() => {
        if (currentOrganizationId == null) {
            return organizations;
        }

        const currentOrganizations = organizations.filter(organization => String(organization.id) === String(currentOrganizationId));
        const otherOrganizations = organizations.filter(organization => String(organization.id) !== String(currentOrganizationId));
        return [...currentOrganizations, ...otherOrganizations];
    }, [currentOrganizationId, organizations]);

    const closeTransientDialogs = useCallback(() => {
        setValidationDialogOpen(false);
        setValidationIssues([]);
        setWarningDialogOpen(false);
        setWarningTitle("Delete not available");
        setWarningMessage("");
        setDeleteConfirmOpen(false);
    }, []);

    const closeEditor = useCallback(() => {
        setEditorOpen(false);
        setEditorMode(null);
        setDraftOrganization(null);
        setDraftOrganizationIsCurrent(false);
        closeTransientDialogs();
    }, [closeTransientDialogs]);

    const openEditorForExisting = (organization) => {
        setSelectedOrganizationId(organization.id);
        setEditorOpen(true);
        setEditorMode("edit");
        setDraftOrganization({ ...organization });
        setDraftOrganizationIsCurrent(String(organization.id) === String(currentOrganizationId));
        closeTransientDialogs();
    };

    const openEditorForNew = () => {
        setEditorOpen(true);
        setEditorMode("add");
        setDraftOrganization(createOrganizationDraft());
        setDraftOrganizationIsCurrent(false);
        closeTransientDialogs();
    };

    const handleAddOrganization = () => {
        if (editorOpen) {
            return;
        }

        openEditorForNew();
    };

    const handleEditOrganization = () => {
        if (selectedOrganization && !editorOpen) {
            openEditorForExisting(selectedOrganization);
        }
    };

    const handleRowSelect = (organization) => {
        setSelectedOrganizationId(organization.id);
    };

    const handleRowEditRequest = (organization) => {
        if (!editorOpen) {
            openEditorForExisting(organization);
        }
    };

    const handleDraftChange = (field, nextValue) => {
        setDraftOrganization(current => (current ? {
            ...current,
            [field]: nextValue
        } : current));
    };

    const handleDeleteOrganization = async () => {
        if (!selectedOrganization || editorOpen) {
            return;
        }

        setDeleteConfirmOpen(true);
    };

    const handleCancelDeleteOrganization = () => {
        setDeleteConfirmOpen(false);
    };

    const handleConfirmDeleteOrganization = async () => {
        if (!selectedOrganization || editorOpen) {
            setDeleteConfirmOpen(false);
            return;
        }

        const organizationId = selectedOrganization.id;
        try {
            await apiDeleteOrganization(organizationId);
            const nextOrganizations = organizations.filter(organization => organization.id !== organizationId);

            setOrganizations(nextOrganizations);
            setSelectedOrganizationId(nextOrganizations[0]?.id ?? null);
            if (String(currentOrganizationId) === String(organizationId)) {
                await onCurrentOrganizationChange(nextOrganizations[0]?.id ?? null);
            }
            closeTransientDialogs();
        } catch (error) {
            const message =
                error?.response?.data?.message ??
                error?.response?.data?.error ??
                error?.message ??
                "Organization is used in the system and cannot be deleted.";
            setWarningTitle("Delete not available");
            setWarningMessage(message);
            setWarningDialogOpen(true);
            setDeleteConfirmOpen(false);
        }
    };

    const handleSaveOrganization = async () => {
        if (!draftOrganization) {
            return;
        }

        const issues = validateOrganization(draftOrganization);
        if (issues.length > 0) {
            setValidationIssues(issues);
            setValidationDialogOpen(true);
            return;
        }

        try {
            const isNewOrganization = editorMode === "add";
            const payload = {
                shortName: draftOrganization.shortName.trim(),
                fullName: draftOrganization.fullName.trim()
            };
            const savedOrganization = isNewOrganization
                ? await apiCreateOrganization(payload)
                : await apiUpdateOrganization(draftOrganization.id, payload);
            const normalizedOrganization = {
                ...draftOrganization,
                ...savedOrganization,
                ...payload
            };
            const nextOrganizations = isNewOrganization
                ? [...organizations, normalizedOrganization]
                : organizations.map(organization =>
                    organization.id === draftOrganization.id
                        ? normalizedOrganization
                        : organization
                );

            setOrganizations(nextOrganizations);
            setSelectedOrganizationId(normalizedOrganization.id);
            if (draftOrganizationIsCurrent) {
                await onCurrentOrganizationChange(normalizedOrganization.id);
            } else if (String(currentOrganizationId) === String(normalizedOrganization.id)) {
                await onCurrentOrganizationChange(null);
            }
            closeEditor();
        } catch (error) {
            const message =
                error?.response?.data?.message ??
                error?.response?.data?.error ??
                error?.message ??
                "Unable to save organization.";
            setWarningTitle("Save not available");
            setWarningMessage(message);
            setWarningDialogOpen(true);
        }
    };

    const handleCancelOrganization = () => {
        if (!editorOpen) {
            return;
        }

        closeEditor();
    };

    useEffect(() => {
        handleCancelRef.current = handleCancelOrganization;
    });

    useEffect(() => {
        let active = true;

        async function loadData() {
            try {
                const nextOrganizations = await loadOrganizations();

                if (!active) {
                    return;
                }

                setOrganizations(nextOrganizations);
                setSelectedOrganizationId(nextOrganizations[0]?.id ?? null);
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
    }, []);

    useEffect(() => {
        if (!editorOpen || validationDialogOpen || warningDialogOpen || deleteConfirmOpen) {
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
    }, [deleteConfirmOpen, editorOpen, validationDialogOpen, warningDialogOpen]);

    const renderRow = (organization) => {
        const isSelected = organization.id === selectedOrganizationId;

        return (
            <tr
                key={organization.id}
                className={isSelected ? "organizations-row-selected" : ""}
                onClick={() => handleRowSelect(organization)}
                onDoubleClick={() => handleRowEditRequest(organization)}
            >
                <td className="organizations-current-cell">
                    {String(organization.id) === String(currentOrganizationId) ? (
                        <span className="tasks-completed-indicator" aria-label="Current organization" title="Current organization">
                            {"\u2713"}
                        </span>
                    ) : null}
                </td>
                <td>
                    <span className="organizations-readonly-cell">{organization.shortName}</span>
                </td>
                <td>
                    <span className="organizations-readonly-cell">{organization.fullName}</span>
                </td>
            </tr>
        );
    };

    return (
        <div className="tracking-main organizations-main">
            <header className="tracking-topbar">
                <div className="tracking-topbar-main">
                    <div>
                        <h2>Organizations</h2>
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
                            <div className="organizations-toolbar-actions">
                                <button
                                    type="button"
                                    className="tracking-save-button"
                                    onClick={handleAddOrganization}
                                    disabled={editorOpen}
                                >
                                    Add
                                </button>
                                <button
                                    type="button"
                                    className="tracking-save-button"
                                    onClick={handleEditOrganization}
                                    disabled={editorOpen || !selectedOrganization}
                                >
                                    Edit
                                </button>
                            </div>
                            <button
                                type="button"
                                className="organizations-delete-button organizations-delete-button-separated"
                                onClick={handleDeleteOrganization}
                                disabled={editorOpen || !selectedOrganization}
                            >
                                Delete
                            </button>
                        </div>
                    </div>

                    <div className="tracking-panel-body organizations-panel-body">
                        <table className="app-master-data-table organizations-table tasks-table">
                            <colgroup>
                                <col className="organizations-col-current" />
                                <col className="organizations-col-short" />
                                <col className="organizations-col-full" />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th></th>
                                    <th>Short Name</th>
                                    <th>Full Name</th>
                                </tr>
                            </thead>
            <tbody>{orderedOrganizations.map(renderRow)}</tbody>
                        </table>
                    </div>
                </section>
            </div>

            {editorOpen && draftOrganization && (
                <div className="tracking-modal-overlay" role="presentation">
                    <div
                        className="tracking-modal tracking-modal-confirm tracking-modal-editor tracking-modal-organization-editor"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="organizations-editor-title"
                    >
                        <div className="tracking-modal-header">
                            <h3 id="organizations-editor-title">
                                {editorMode === "add" ? "Add Organization" : "Edit Organization"}
                            </h3>
                        </div>
                        <div className="tracking-modal-body">
                            <div className="tracking-modal-fields">
                                <label className="tracking-modal-field tracking-modal-checkbox-field">
                                    <span>Current Organization</span>
                                    <div className="tracking-modal-checkbox-control">
                                        <input
                                            type="checkbox"
                                            checked={draftOrganizationIsCurrent}
                                            onChange={event => setDraftOrganizationIsCurrent(event.target.checked)}
                                        />
                                        <span>Mark this organization as current</span>
                                    </div>
                                </label>

                                <label className="tracking-modal-field">
                                    <span>Short Name</span>
                                    <input
                                        type="text"
                                        value={draftOrganization.shortName ?? ""}
                                        onChange={event => handleDraftChange("shortName", event.target.value)}
                                    />
                                </label>

                                <label className="tracking-modal-field">
                                    <span>Full Name</span>
                                    <input
                                        type="text"
                                        value={draftOrganization.fullName ?? ""}
                                        onChange={event => handleDraftChange("fullName", event.target.value)}
                                    />
                                </label>
                            </div>
                        </div>
                        <div className="tracking-modal-actions">
                            <button type="button" className="tracking-modal-button" onClick={handleSaveOrganization}>
                                Save
                            </button>
                            <button
                                type="button"
                                className="tracking-modal-button tracking-modal-button-secondary"
                                onClick={handleCancelOrganization}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

            {deleteConfirmOpen && (
                <div className="tracking-modal-overlay" role="presentation">
                    <div
                        className="tracking-modal tracking-modal-confirm"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="organizations-delete-confirm-title"
                    >
                        <div className="tracking-modal-header">
                            <h3 id="organizations-delete-confirm-title">Delete organization</h3>
                        </div>
                        <div className="tracking-modal-body">
                            <p className="tracking-modal-text">Delete selected organization?</p>
                        </div>
                        <div className="tracking-modal-actions">
                            <button type="button" className="tracking-modal-button" onClick={handleConfirmDeleteOrganization}>
                                Delete
                            </button>
                            <button
                                type="button"
                                className="tracking-modal-button tracking-modal-button-secondary"
                                onClick={handleCancelDeleteOrganization}
                            >
                                Cancel
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
                            <h3 id="organizations-warning-title">{warningTitle}</h3>
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
