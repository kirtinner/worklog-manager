import { useEffect, useMemo, useRef, useState } from "react";
import { getClients as loadClients } from "../services/clientsService";
import { getProjects as loadProjects } from "../services/projectsService";

function cloneProjects(items) {
    return items.map(item => ({ ...item }));
}

function createProject(nextId, organizationId, clientId) {
    return {
        id: nextId,
        organizationId,
        clientId,
        shortName: "",
        fullName: ""
    };
}

function isProjectLinkedInSystem(project) {
    return project.id === 201 || project.shortName.toUpperCase() === "ACME-OPS";
}

function validateProject(project) {
    const issues = [];

    if (!project.shortName.trim()) {
        issues.push("shortName is required.");
    }

    if (!project.fullName.trim()) {
        issues.push("fullName is required.");
    }

    return issues;
}

function getNextVisibleProjectId(sourceProjects, organizationId, clientId, excludedProjectId = null) {
    return sourceProjects.find(project =>
        project.organizationId === organizationId
        && project.clientId === clientId
        && project.id !== excludedProjectId
    )?.id ?? null;
}

export default function ProjectsPage({
    organizations = [],
    currentOrganizationId = null
}) {
    const [clients, setClients] = useState([]);
    const [projects, setProjects] = useState([]);
    const [savedProjects, setSavedProjects] = useState([]);
    const [selectedOrganizationId, setSelectedOrganizationId] = useState(currentOrganizationId ?? organizations[0]?.id ?? null);
    const [selectedClientId, setSelectedClientId] = useState(null);
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [editingProjectId, setEditingProjectId] = useState(null);
    const [draftProject, setDraftProject] = useState(null);
    const [editingOriginalProject, setEditingOriginalProject] = useState(null);
    const [nextId, setNextId] = useState(206);
    const [validationDialogOpen, setValidationDialogOpen] = useState(false);
    const [validationIssues, setValidationIssues] = useState([]);
    const [warningDialogOpen, setWarningDialogOpen] = useState(false);
    const [warningMessage, setWarningMessage] = useState("");
    const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
    const [pendingSelectionId, setPendingSelectionId] = useState(null);
    const [pendingOrganizationId, setPendingOrganizationId] = useState(null);
    const [pendingClientId, setPendingClientId] = useState(null);
    const handleCancelRef = useRef(() => {});

    const filteredClients = useMemo(
        () => clients.filter(client => client.organizationId === selectedOrganizationId),
        [clients, selectedOrganizationId]
    );

    const filteredProjects = useMemo(
        () => projects.filter(project =>
            project.organizationId === selectedOrganizationId
            && project.clientId === selectedClientId
        ),
        [projects, selectedClientId, selectedOrganizationId]
    );

    const selectedProject = projects.find(project => project.id === selectedProjectId) ?? null;
    const selectedClient = clients.find(client => client.id === selectedClientId) ?? null;
    const isDirty = editingProjectId != null || JSON.stringify(projects) !== JSON.stringify(savedProjects);
    const isDraftDirty = editingProjectId != null && (
        editingOriginalProject == null ||
        draftProject == null ||
        draftProject.shortName !== editingOriginalProject.shortName ||
        draftProject.fullName !== editingOriginalProject.fullName
    );
    const projectCountLabel = `${filteredProjects.length} project${filteredProjects.length === 1 ? "" : "s"}`;

    useEffect(() => {
        let active = true;

        async function loadData() {
            try {
                const [nextClients, nextProjects] = await Promise.all([loadClients(), loadProjects()]);

                if (!active) {
                    return;
                }

                setClients(nextClients);
                setProjects(nextProjects);
                setSavedProjects(cloneProjects(nextProjects));
                setNextId(Math.max(...nextProjects.map(project => project.id), 205) + 1);

                const initialOrganizationId = currentOrganizationId ?? organizations[0]?.id ?? nextClients[0]?.organizationId ?? null;
                const initialClients = nextClients.filter(client => client.organizationId === initialOrganizationId);
                const initialClientId = initialClients[0]?.id ?? null;
                const initialProjectId = getNextVisibleProjectId(nextProjects, initialOrganizationId, initialClientId);

                setSelectedOrganizationId(initialOrganizationId);
                setSelectedClientId(initialClientId);
                setSelectedProjectId(initialProjectId);
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

    const closeModals = () => {
        setValidationDialogOpen(false);
        setValidationIssues([]);
        setWarningDialogOpen(false);
        setWarningMessage("");
        setSwitchDialogOpen(false);
        setPendingSelectionId(null);
        setPendingOrganizationId(null);
        setPendingClientId(null);
    };

    const applyFilterSelection = (organizationId, clientId = null) => {
        const nextOrganizationClients = clients.filter(client => client.organizationId === organizationId);
        const resolvedClientId = clientId != null && nextOrganizationClients.some(client => client.id === clientId)
            ? clientId
            : nextOrganizationClients[0]?.id ?? null;

        setSelectedOrganizationId(organizationId);
        setSelectedClientId(resolvedClientId);
        setSelectedProjectId(getNextVisibleProjectId(projects, organizationId, resolvedClientId));
    };

    const beginEdit = (project) => {
        setSelectedProjectId(project.id);
        setEditingProjectId(project.id);
        setDraftProject({ ...project });
        setEditingOriginalProject({ ...project });
        closeModals();
    };

    const discardCurrentEdit = (nextSelectedId = null) => {
        const currentEditingId = editingProjectId;
        const savedProject = savedProjects.find(project => project.id === currentEditingId);

        if (savedProject) {
            setProjects(currentProjects =>
                currentProjects.map(project =>
                    project.id === savedProject.id
                        ? { ...savedProject }
                        : project
                )
            );
            setSelectedProjectId(nextSelectedId ?? savedProject.id);
        } else {
            setProjects(currentProjects => {
                const nextProjects = currentProjects.filter(project => project.id !== currentEditingId);
                setSelectedProjectId(nextSelectedId ?? getNextVisibleProjectId(nextProjects, selectedOrganizationId, selectedClientId, currentEditingId));
                return nextProjects;
            });
        }

        setEditingProjectId(null);
        setDraftProject(null);
        setEditingOriginalProject(null);
        return Boolean(savedProject);
    };

    const commitDraft = (nextSelectedId = selectedProjectId) => {
        if (!draftProject) {
            return false;
        }

        const issues = validateProject(draftProject);
        if (issues.length > 0) {
            setValidationIssues(issues);
            setValidationDialogOpen(true);
            return false;
        }

        const nextProjects = projects.map(project =>
            project.id === draftProject.id
                ? { ...draftProject }
                : project
        );

        const nextSavedProjects = savedProjects.some(project => project.id === draftProject.id)
            ? savedProjects.map(project =>
                project.id === draftProject.id
                    ? { ...draftProject }
                    : project
            )
            : [...savedProjects, { ...draftProject }];

        setProjects(nextProjects);
        setSavedProjects(cloneProjects(nextSavedProjects));
        setSelectedProjectId(nextSelectedId);
        setEditingProjectId(null);
        setDraftProject(null);
        setEditingOriginalProject(null);
        closeModals();
        return true;
    };

    const handleAddProject = () => {
        const nextClientId = selectedClientId ?? filteredClients[0]?.id ?? null;
        const nextProject = createProject(nextId, selectedOrganizationId, nextClientId);

        setProjects(currentProjects => [...currentProjects, nextProject]);
        setSelectedProjectId(nextProject.id);
        setEditingProjectId(nextProject.id);
        setDraftProject({ ...nextProject });
        setEditingOriginalProject(null);
        setNextId(currentId => currentId + 1);
        closeModals();
    };

    const handleEditOrSave = () => {
        if (editingProjectId != null) {
            commitDraft();
            return;
        }

        if (selectedProject) {
            beginEdit(selectedProject);
        }
    };

    const handleRowEditRequest = (project) => {
        if (editingProjectId != null && project.id !== editingProjectId) {
            if (isDraftDirty) {
                setPendingSelectionId(project.id);
                setSwitchDialogOpen(true);
                return;
            }

            discardCurrentEdit(project.id);
            beginEdit(project);
            return;
        }

        beginEdit(project);
    };

    const handleCancel = () => {
        if (editingProjectId == null) {
            return;
        }

        discardCurrentEdit();
        closeModals();
    };

    const handleRowSelect = (project) => {
        if (editingProjectId != null && project.id !== editingProjectId) {
            if (!isDraftDirty) {
                discardCurrentEdit(project.id);
                closeModals();
                return;
            }

            setPendingSelectionId(project.id);
            setSwitchDialogOpen(true);
            return;
        }

        setSelectedProjectId(project.id);
    };

    const handleDraftChange = (field, nextValue) => {
        if (!draftProject) {
            return;
        }

        setDraftProject({
            ...draftProject,
            [field]: nextValue
        });
        closeModals();
    };

    const handleOrganizationChange = (nextOrganizationId) => {
        const parsedOrganizationId = Number(nextOrganizationId);

        if (editingProjectId != null && isDraftDirty) {
            setPendingOrganizationId(parsedOrganizationId);
            setSwitchDialogOpen(true);
            return;
        }

        if (editingProjectId != null) {
            discardCurrentEdit();
        }

        applyFilterSelection(parsedOrganizationId);
        closeModals();
    };

    const handleClientChange = (nextClientId) => {
        const parsedClientId = nextClientId === "" ? null : Number(nextClientId);

        if (editingProjectId != null && isDraftDirty) {
            setPendingClientId(parsedClientId);
            setSwitchDialogOpen(true);
            return;
        }

        if (editingProjectId != null) {
            discardCurrentEdit();
        }

        if (parsedClientId == null) {
            setSelectedClientId(null);
            setSelectedProjectId(null);
            closeModals();
            return;
        }

        setSelectedClientId(parsedClientId);
        setSelectedProjectId(getNextVisibleProjectId(projects, selectedOrganizationId, parsedClientId));
        closeModals();
    };

    const handleDeleteProject = () => {
        if (!selectedProject) {
            return;
        }

        if (isProjectLinkedInSystem(selectedProject)) {
            setWarningMessage("Project is used in the system and cannot be deleted.");
            setWarningDialogOpen(true);
            return;
        }

        setProjects(currentProjects =>
            currentProjects.filter(project => project.id !== selectedProject.id)
        );
        setSavedProjects(currentSavedProjects =>
            currentSavedProjects.filter(project => project.id !== selectedProject.id)
        );

        if (editingProjectId === selectedProject.id) {
            setEditingProjectId(null);
            setDraftProject(null);
        }

        const remaining = filteredProjects.filter(project => project.id !== selectedProject.id);
        setSelectedProjectId(remaining[0]?.id ?? null);
        closeModals();
    };

    const handleSaveFromSwitchDialog = () => {
        if (commitDraft(pendingSelectionId)) {
            if (pendingOrganizationId != null) {
                applyFilterSelection(pendingOrganizationId, pendingClientId);
            } else if (pendingClientId != null) {
                applyFilterSelection(selectedOrganizationId, pendingClientId);
            } else if (pendingSelectionId != null) {
                setSelectedProjectId(pendingSelectionId);
            }

            setSwitchDialogOpen(false);
            setPendingSelectionId(null);
            setPendingOrganizationId(null);
            setPendingClientId(null);
        }
    };

    const handleDiscardFromSwitchDialog = () => {
        if (editingProjectId == null) {
            setSwitchDialogOpen(false);
            setPendingSelectionId(null);
            setPendingOrganizationId(null);
            setPendingClientId(null);
            return;
        }

        discardCurrentEdit(pendingSelectionId);

        if (pendingOrganizationId != null) {
            applyFilterSelection(pendingOrganizationId, pendingClientId);
        } else if (pendingClientId != null) {
            applyFilterSelection(selectedOrganizationId, pendingClientId);
        } else if (pendingSelectionId != null) {
            setSelectedProjectId(pendingSelectionId);
        }

        setSwitchDialogOpen(false);
        setPendingSelectionId(null);
        setPendingOrganizationId(null);
        setPendingClientId(null);
    };

    const handleStayEditing = () => {
        setSwitchDialogOpen(false);
        setPendingSelectionId(null);
        setPendingOrganizationId(null);
        setPendingClientId(null);
    };

    useEffect(() => {
        handleCancelRef.current = handleCancel;
    });

    useEffect(() => {
        if (editingProjectId == null || validationDialogOpen || warningDialogOpen || switchDialogOpen) {
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
    }, [editingProjectId, switchDialogOpen, validationDialogOpen, warningDialogOpen]);

    const renderRow = (project) => {
        const isSelected = project.id === selectedProjectId;
        const isEditingRow = project.id === editingProjectId;

        return (
            <tr
                key={project.id}
                className={isSelected ? "organizations-row-selected" : ""}
                onClick={() => handleRowSelect(project)}
                onDoubleClick={() => handleRowEditRequest(project)}
            >
                <td>
                    {isEditingRow ? (
                        <input
                            className="app-master-data-input organizations-input"
                            type="text"
                            value={draftProject?.shortName ?? ""}
                            onChange={event => handleDraftChange("shortName", event.target.value)}
                            onClick={event => event.stopPropagation()}
                        />
                    ) : (
                        <span className="organizations-readonly-cell">{project.shortName}</span>
                    )}
                </td>
                <td>
                    {isEditingRow ? (
                        <input
                            className="app-master-data-input organizations-input"
                            type="text"
                            value={draftProject?.fullName ?? ""}
                            onChange={event => handleDraftChange("fullName", event.target.value)}
                            onClick={event => event.stopPropagation()}
                        />
                    ) : (
                        <span className="organizations-readonly-cell">{project.fullName}</span>
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
                        <h2>Projects</h2>
                        <p>Master data workspace for project records</p>
                    </div>
                </div>
            </header>

            <section className="projects-filter-bar">
                <div className="projects-filter-field">
                    <label className="clients-filter-label" htmlFor="projects-organization-select">
                        Organization
                    </label>
                    <select
                        id="projects-organization-select"
                        className="clients-filter-select projects-filter-select"
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

                <div className="projects-filter-field">
                    <label className="clients-filter-label" htmlFor="projects-client-select">
                        Client
                    </label>
                    <select
                        id="projects-client-select"
                        className="clients-filter-select projects-filter-select"
                        value={String(selectedClientId ?? "")}
                        onChange={event => handleClientChange(event.target.value)}
                        disabled={filteredClients.length === 0}
                    >
                        {filteredClients.length === 0 ? (
                            <option value="">No clients</option>
                        ) : (
                            filteredClients.map(client => (
                                <option key={client.id} value={String(client.id)}>
                                    {client.shortName} - {client.fullName}
                                </option>
                            ))
                        )}
                    </select>
                </div>
            </section>

            <div className="tracking-content-grid organizations-content-grid">
                <section className="tracking-panel organizations-panel">
                    <div className="tracking-panel-header organizations-panel-header projects-panel-header">
                        <div>
                            <h3>Project List</h3>
                            <p className="organizations-subtitle">{projectCountLabel}</p>
                        </div>

                        <div className="clients-toolbar">
                            {editingProjectId != null ? (
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
                                        <button
                                            type="button"
                                            className="tracking-save-button"
                                            onClick={handleAddProject}
                                            disabled={!selectedClient}
                                        >
                                            Add
                                        </button>
                                        <button
                                            type="button"
                                            className="tracking-save-button"
                                            onClick={handleEditOrSave}
                                            disabled={!selectedProject}
                                        >
                                            Edit
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        className="organizations-delete-button organizations-delete-button-separated"
                                        onClick={handleDeleteProject}
                                        disabled={!selectedProject}
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
                            <tbody>{filteredProjects.map(renderRow)}</tbody>
                        </table>
                    </div>
                </section>
            </div>

            {validationDialogOpen && (
                <div className="tracking-modal-overlay" role="presentation">
                    <div className="tracking-modal tracking-modal-confirm" role="dialog" aria-modal="true" aria-labelledby="projects-validation-title">
                        <div className="tracking-modal-header">
                            <h3 id="projects-validation-title">Validation errors</h3>
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
                    <div className="tracking-modal tracking-modal-confirm" role="dialog" aria-modal="true" aria-labelledby="projects-warning-title">
                        <div className="tracking-modal-header">
                            <h3 id="projects-warning-title">Delete not available</h3>
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
                    <div className="tracking-modal tracking-modal-confirm" role="dialog" aria-modal="true" aria-labelledby="projects-switch-title">
                        <div className="tracking-modal-header">
                            <h3 id="projects-switch-title">Unsaved changes</h3>
                        </div>
                        <div className="tracking-modal-body">
                            <p className="tracking-modal-text">
                                There are unsaved changes for the current project. What do you want to do?
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
