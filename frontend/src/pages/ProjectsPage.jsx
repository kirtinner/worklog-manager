import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getClients as loadClients } from "../services/clientsService";
import {
    createProject as apiCreateProject,
    deleteProject as apiDeleteProject,
    getProjects as loadProjects,
    updateProject as apiUpdateProject
} from "../services/projectsService";

function createProjectDraft(organizationId, clientId) {
    return {
        id: null,
        organizationId,
        clientId,
        shortName: "",
        fullName: ""
    };
}

function validateProject(project) {
    const issues = [];

    if (project.organizationId == null) {
        issues.push("organization is required.");
    }

    if (project.clientId == null) {
        issues.push("client is required.");
    }

    if (!project.shortName.trim()) {
        issues.push("shortName is required.");
    }

    if (!project.fullName.trim()) {
        issues.push("fullName is required.");
    }

    return issues;
}

function getFirstVisibleProjectId(sourceProjects, organizationId, clientId) {
    return sourceProjects.find(project =>
        (organizationId == null || project.organizationId === organizationId)
        && (clientId == null || project.clientId === clientId)
    )?.id ?? null;
}

function readStoredNumber(key) {
    const value = sessionStorage.getItem(key);
    if (value == null || value === "") {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export default function ProjectsPage({
    organizations = [],
    currentOrganizationId = null
}) {
    const [clients, setClients] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedOrganizationId, setSelectedOrganizationId] = useState(
        readStoredNumber("dev-productivity:projects:selected-organization-id")
        ?? currentOrganizationId
        ?? organizations[0]?.id
        ?? null
    );
    const [selectedClientId, setSelectedClientId] = useState(readStoredNumber("dev-productivity:projects:selected-client-id"));
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorMode, setEditorMode] = useState(null);
    const [draftProject, setDraftProject] = useState(null);
    const [validationDialogOpen, setValidationDialogOpen] = useState(false);
    const [validationIssues, setValidationIssues] = useState([]);
    const [warningDialogOpen, setWarningDialogOpen] = useState(false);
    const [warningTitle, setWarningTitle] = useState("Delete not available");
    const [warningMessage, setWarningMessage] = useState("");
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const handleCancelRef = useRef(() => {});

    const filteredClients = useMemo(
        () => selectedOrganizationId == null
            ? clients
            : clients.filter(client => client.organizationId === selectedOrganizationId),
        [clients, selectedOrganizationId]
    );

    const filteredProjects = useMemo(
        () => projects.filter(project =>
            (selectedOrganizationId == null || project.organizationId === selectedOrganizationId)
            && (selectedClientId == null || project.clientId === selectedClientId)
        ),
        [projects, selectedClientId, selectedOrganizationId]
    );

    const draftOrganizationId = draftProject?.organizationId ?? null;
    const draftClients = useMemo(
        () => clients.filter(client => draftOrganizationId == null || client.organizationId === draftOrganizationId),
        [clients, draftOrganizationId]
    );

    const selectedProject = filteredProjects.find(project => project.id === selectedProjectId) ?? null;
    const projectCountLabel = `${filteredProjects.length} project${filteredProjects.length === 1 ? "" : "s"}`;

    useEffect(() => {
        let active = true;

        async function loadData() {
            try {
                const [nextClients, nextProjects] = await Promise.all([loadClients(), loadProjects()]);

                if (!active) {
                    return;
                }

                const storedOrganizationId = readStoredNumber("dev-productivity:projects:selected-organization-id");
                const storedClientId = readStoredNumber("dev-productivity:projects:selected-client-id");
                const initialOrganizationId =
                    storedOrganizationId
                    ?? currentOrganizationId
                    ?? organizations[0]?.id
                    ?? nextClients[0]?.organizationId
                    ?? null;
                const initialClientId = storedClientId != null && nextClients.some(client =>
                    client.id === storedClientId && client.organizationId === initialOrganizationId
                )
                    ? storedClientId
                    : nextClients.find(client => client.organizationId === initialOrganizationId)?.id ?? null;
                const initialProjectId = getFirstVisibleProjectId(nextProjects, initialOrganizationId, initialClientId);

                setClients(nextClients);
                setProjects(nextProjects);
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
        setDraftProject(null);
        closeTransientDialogs();
    }, [closeTransientDialogs]);

    const applyFilterSelection = (organizationId, clientId = null, sourceProjects = projects) => {
        const nextOrganizationClients = clients.filter(client => client.organizationId === organizationId);
        const resolvedClientId = clientId != null && nextOrganizationClients.some(client => client.id === clientId)
            ? clientId
            : nextOrganizationClients[0]?.id ?? null;

        setSelectedOrganizationId(organizationId);
        setSelectedClientId(resolvedClientId);
        sessionStorage.setItem("dev-productivity:projects:selected-organization-id", String(organizationId));
        if (resolvedClientId == null) {
            sessionStorage.removeItem("dev-productivity:projects:selected-client-id");
        } else {
            sessionStorage.setItem("dev-productivity:projects:selected-client-id", String(resolvedClientId));
        }
        setSelectedProjectId(getFirstVisibleProjectId(sourceProjects, organizationId, resolvedClientId));
    };

    const openEditorForExisting = (project) => {
        setSelectedProjectId(project.id);
        setEditorOpen(true);
        setEditorMode("edit");
        setDraftProject({ ...project });
        closeTransientDialogs();
    };

    const openEditorForNew = () => {
        const nextClientId = selectedClientId ?? filteredClients[0]?.id ?? null;
        const nextDraft = createProjectDraft(selectedOrganizationId, nextClientId);

        setEditorOpen(true);
        setEditorMode("add");
        setDraftProject(nextDraft);
        closeTransientDialogs();
    };

    const handleAddProject = () => {
        if (editorOpen) {
            return;
        }

        openEditorForNew();
    };

    const handleEditProject = () => {
        if (selectedProject && !editorOpen) {
            openEditorForExisting(selectedProject);
        }
    };

    const handleRowSelect = (project) => {
        setSelectedProjectId(project.id);
    };

    const handleRowEditRequest = (project) => {
        if (!editorOpen) {
            openEditorForExisting(project);
        }
    };

    const handleDraftChange = (field, nextValue) => {
        setDraftProject(current => (current ? {
            ...current,
            [field]: nextValue
        } : current));
    };

    const handleDraftOrganizationChange = (nextOrganizationId) => {
        const parsedOrganizationId = nextOrganizationId === "" ? null : Number(nextOrganizationId);

        setDraftProject(current => (current ? {
            ...current,
            organizationId: parsedOrganizationId
        } : current));
    };

    const handleDraftClientChange = (nextClientId) => {
        const parsedClientId = nextClientId === "" ? null : Number(nextClientId);
        handleDraftChange("clientId", parsedClientId);
    };

    const handleOrganizationChange = (nextOrganizationId) => {
        if (nextOrganizationId === "") {
            handleClearOrganizationFilter();
            return;
        }

        applyFilterSelection(Number(nextOrganizationId));
        closeTransientDialogs();
    };

    const handleClearOrganizationFilter = () => {
        setSelectedOrganizationId(null);
        sessionStorage.removeItem("dev-productivity:projects:selected-organization-id");
        closeTransientDialogs();
    };

    const handleClientChange = (nextClientId) => {
        const parsedClientId = nextClientId === "" ? null : Number(nextClientId);

        setSelectedClientId(parsedClientId);
        if (parsedClientId == null) {
            sessionStorage.removeItem("dev-productivity:projects:selected-client-id");
        } else {
            sessionStorage.setItem("dev-productivity:projects:selected-client-id", String(parsedClientId));
        }
        setSelectedProjectId(getFirstVisibleProjectId(projects, selectedOrganizationId, parsedClientId));
        closeTransientDialogs();
    };

    const handleClearClientFilter = () => {
        setSelectedClientId(null);
        sessionStorage.removeItem("dev-productivity:projects:selected-client-id");
        closeTransientDialogs();
    };

    const handleDeleteProject = async () => {
        if (!selectedProject || editorOpen) {
            return;
        }

        setDeleteConfirmOpen(true);
    };

    const handleCancelDeleteProject = () => {
        setDeleteConfirmOpen(false);
    };

    const handleConfirmDeleteProject = async () => {
        if (!selectedProject || editorOpen) {
            setDeleteConfirmOpen(false);
            return;
        }

        const projectId = selectedProject.id;
        try {
            await apiDeleteProject(projectId);
            const nextProjects = projects.filter(project => project.id !== projectId);

            setProjects(nextProjects);
            setSelectedProjectId(getFirstVisibleProjectId(nextProjects, selectedOrganizationId, selectedClientId));
            closeTransientDialogs();
        } catch (error) {
            const message =
                error?.response?.data?.message ??
                error?.response?.data?.error ??
                error?.message ??
                "Project is used in the system and cannot be deleted.";
            setWarningTitle("Delete not available");
            setWarningMessage(message);
            setWarningDialogOpen(true);
            setDeleteConfirmOpen(false);
        }
    };

    const handleSaveProject = async () => {
        if (!draftProject) {
            return;
        }

        const issues = validateProject(draftProject);
        if (issues.length > 0) {
            setValidationIssues(issues);
            setValidationDialogOpen(true);
            return;
        }

        try {
            const isNewProject = editorMode === "add";
            const payload = {
                organizationId: draftProject.organizationId,
                clientId: draftProject.clientId,
                shortName: draftProject.shortName.trim(),
                fullName: draftProject.fullName.trim(),
                description: draftProject.description ?? ""
            };
            const savedProject = isNewProject
                ? await apiCreateProject(payload)
                : await apiUpdateProject(draftProject.id, payload);
            const normalizedProject = {
                ...draftProject,
                ...savedProject,
                ...payload
            };

            const nextProjects = isNewProject
                ? [...projects, normalizedProject]
                : projects.map(project =>
                    project.id === draftProject.id
                        ? normalizedProject
                        : project
                );

            setProjects(nextProjects);
            if (
                normalizedProject.organizationId === selectedOrganizationId
                && normalizedProject.clientId === selectedClientId
            ) {
                setSelectedProjectId(normalizedProject.id);
            } else {
                setSelectedProjectId(getFirstVisibleProjectId(nextProjects, selectedOrganizationId, selectedClientId));
            }
            closeEditor();
        } catch (error) {
            const message =
                error?.response?.data?.message ??
                error?.response?.data?.error ??
                error?.message ??
                "Unable to save project.";
            setWarningTitle("Save not available");
            setWarningMessage(message);
            setWarningDialogOpen(true);
        }
    };

    const handleCancelProject = () => {
        if (!editorOpen) {
            return;
        }

        closeEditor();
    };

    useEffect(() => {
        handleCancelRef.current = handleCancelProject;
    });

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

    const renderRow = (project) => {
        const isSelected = project.id === selectedProjectId;

        return (
            <tr
                key={project.id}
                className={isSelected ? "organizations-row-selected" : ""}
                onClick={() => handleRowSelect(project)}
                onDoubleClick={() => handleRowEditRequest(project)}
            >
                <td>
                    <span className="organizations-readonly-cell">{project.shortName}</span>
                </td>
                <td>
                    <span className="organizations-readonly-cell">{project.fullName}</span>
                </td>
            </tr>
        );
    };

    return (
        <div className="tracking-main organizations-main">
            <header className="tracking-topbar">
                <div className="tracking-topbar-main">
                    <div>
                        <h2>Projects</h2>
                    </div>
                </div>
            </header>

            <section className="tasks-filter-bar">
                <div className="tasks-filter-header-row">
                    <label className="tasks-filter-heading" htmlFor="projects-organization-select">
                        Organization
                    </label>
                    <label className="tasks-filter-heading" htmlFor="projects-client-select">
                        Client
                    </label>
                </div>

                <div className="tasks-filter-values-row">
                    <div className="tasks-filter-field">
                    <div className="selector-clear-control">
                        <select
                            id="projects-organization-select"
                            className="clients-filter-select tasks-filter-select"
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

                    <div className="tasks-filter-field">
                    <div className="selector-clear-control">
                        <select
                            id="projects-client-select"
                            className="clients-filter-select tasks-filter-select"
                            value={String(selectedClientId ?? "")}
                            onChange={event => handleClientChange(event.target.value)}
                            disabled={filteredClients.length === 0}
                        >
                            <option value=""></option>
                            {filteredClients.map(client => (
                                <option key={client.id} value={String(client.id)}>
                                    {client.shortName}
                                </option>
                            ))}
                        </select>
                        {selectedClientId != null && (
                            <button type="button" className="selector-clear-button" onClick={handleClearClientFilter} aria-label="Clear client filter">
                                ×
                            </button>
                        )}
                    </div>
                </div>
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
                            <div className="organizations-toolbar-actions">
                                <button
                                    type="button"
                                    className="tracking-save-button"
                                    onClick={handleAddProject}
                                    disabled={editorOpen || !selectedClientId}
                                >
                                    Add
                                </button>
                                <button
                                    type="button"
                                    className="tracking-save-button"
                                    onClick={handleEditProject}
                                    disabled={editorOpen || !selectedProject}
                                >
                                    Edit
                                </button>
                            </div>
                            <button
                                type="button"
                                className="organizations-delete-button organizations-delete-button-separated"
                                onClick={handleDeleteProject}
                                disabled={editorOpen || !selectedProject}
                            >
                                Delete
                            </button>
                        </div>
                    </div>

                    <div className="tracking-panel-body organizations-panel-body">
                        <table className="app-master-data-table organizations-table tasks-table">
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

            {editorOpen && draftProject && (
                <div className="tracking-modal-overlay" role="presentation">
                    <div
                        className="tracking-modal tracking-modal-confirm tracking-modal-editor tracking-modal-client-editor"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="projects-editor-title"
                    >
                        <div className="tracking-modal-header">
                            <h3 id="projects-editor-title">{editorMode === "add" ? "Add Project" : "Edit Project"}</h3>
                        </div>
                        <div className="tracking-modal-body">
                            <div className="tracking-modal-fields">
                                <label className="tracking-modal-field">
                                    <span>Organization</span>
                                    <div className="selector-clear-control">
                                        <select
                                            value={String(draftProject.organizationId ?? "")}
                                            onChange={event => handleDraftOrganizationChange(event.target.value)}
                                        >
                                            <option value=""></option>
                                            {organizations.map(organization => (
                                                <option key={organization.id} value={String(organization.id)}>
                                                    {organization.shortName}
                                                </option>
                                            ))}
                                        </select>
                                        {draftProject.organizationId != null && (
                                            <button type="button" className="selector-clear-button" onClick={() => handleDraftOrganizationChange("")} aria-label="Clear organization">
                                                ×
                                            </button>
                                        )}
                                    </div>
                                </label>

                                <label className="tracking-modal-field">
                                    <span>Client</span>
                                    <div className="selector-clear-control">
                                        <select
                                            value={String(draftProject.clientId ?? "")}
                                            onChange={event => handleDraftClientChange(event.target.value)}
                                            disabled={draftClients.length === 0}
                                        >
                                            <option value=""></option>
                                            {draftClients.map(client => (
                                                <option key={client.id} value={String(client.id)}>
                                                    {client.shortName}
                                                </option>
                                            ))}
                                        </select>
                                        {draftProject.clientId != null && (
                                            <button type="button" className="selector-clear-button" onClick={() => handleDraftClientChange("")} aria-label="Clear client">
                                                ×
                                            </button>
                                        )}
                                    </div>
                                </label>

                                <label className="tracking-modal-field">
                                    <span>Short Name</span>
                                    <input
                                        type="text"
                                        value={draftProject.shortName ?? ""}
                                        onChange={event => handleDraftChange("shortName", event.target.value)}
                                    />
                                </label>

                                <label className="tracking-modal-field">
                                    <span>Full Name</span>
                                    <input
                                        type="text"
                                        value={draftProject.fullName ?? ""}
                                        onChange={event => handleDraftChange("fullName", event.target.value)}
                                    />
                                </label>
                            </div>
                        </div>
                        <div className="tracking-modal-actions">
                            <button type="button" className="tracking-modal-button" onClick={handleSaveProject}>
                                Save
                            </button>
                            <button
                                type="button"
                                className="tracking-modal-button tracking-modal-button-secondary"
                                onClick={handleCancelProject}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

            {deleteConfirmOpen && (
                <div className="tracking-modal-overlay" role="presentation">
                    <div className="tracking-modal tracking-modal-confirm" role="dialog" aria-modal="true" aria-labelledby="projects-delete-confirm-title">
                        <div className="tracking-modal-header">
                            <h3 id="projects-delete-confirm-title">Delete project</h3>
                        </div>
                        <div className="tracking-modal-body">
                            <p className="tracking-modal-text">Delete selected project?</p>
                        </div>
                        <div className="tracking-modal-actions">
                            <button type="button" className="tracking-modal-button" onClick={handleConfirmDeleteProject}>
                                Delete
                            </button>
                            <button
                                type="button"
                                className="tracking-modal-button tracking-modal-button-secondary"
                                onClick={handleCancelDeleteProject}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {warningDialogOpen && (
                <div className="tracking-modal-overlay" role="presentation">
                    <div className="tracking-modal tracking-modal-confirm" role="dialog" aria-modal="true" aria-labelledby="projects-warning-title">
                        <div className="tracking-modal-header">
                            <h3 id="projects-warning-title">{warningTitle}</h3>
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
