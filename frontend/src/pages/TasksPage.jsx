import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getClients as loadClients } from "../services/clientsService";
import { getProjects as loadProjects } from "../services/projectsService";
import {
    checkTaskCanDelete,
    createTask as apiCreateTask,
    deleteTask as apiDeleteTask,
    getTasks as loadTasks,
    updateTask as apiUpdateTask
} from "../services/tasksService";
import { getTimeEntriesByTask } from "../services/timeTrackingService";

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

function createTaskDraft(context) {
    return {
        id: null,
        completed: false,
        created_at: todayIso(),
        task_number: "",
        name: "",
        comment: "",
        task_link: "",
        description: "",
        implementation_details: "",
        estimated_hours: 0,
        actual_hours: 0,
        softwareProductId: null,
        organizationId: context.organizationId ?? null,
        clientId: context.clientId ?? null,
        projectId: context.projectId ?? null
    };
}

function validateTask(task, softwareProducts) {
    const issues = [];

    if (!task.task_number.trim()) {
        issues.push("task_number is required.");
    }

    if (!task.name.trim()) {
        issues.push("name is required.");
    }

    if (task.organizationId == null) {
        issues.push("organization is required.");
    }

    if (task.clientId == null) {
        issues.push("client is required.");
    }

    if (task.projectId == null) {
        issues.push("project is required.");
    }

    if (softwareProducts.length === 0) {
        issues.push("No software products are available. Add software products in Settings.");
    } else if (task.softwareProductId == null) {
        issues.push("software_product is required.");
    }

    const estimatedHours = Number(task.estimated_hours);
    if (!Number.isFinite(estimatedHours) || estimatedHours < 0) {
        issues.push("estimated_hours must be a number greater than or equal to 0.");
    }

    return issues;
}

function formatDate(value) {
    if (!value) {
        return "";
    }

    const [year, month, day] = value.split("-");
    if (!year || !month || !day) {
        return value;
    }

    return `${day}.${month}.${year}`;
}

function resolveClientLabel(clients, clientId) {
    return clients.find(client => sameId(client.id, clientId))?.shortName ?? "";
}

function shouldHighlightActualHours(actualHours, estimatedHours) {
    const actual = Number(actualHours);
    const estimated = Number(estimatedHours);

    if (!Number.isFinite(actual) || !Number.isFinite(estimated)) {
        return false;
    }

    if (actual <= 0 || estimated <= 0) {
        return false;
    }

    return actual > estimated;
}

function sameId(left, right) {
    return left != null && right != null && String(left) === String(right);
}

function readStoredNumber(key) {
    const value = sessionStorage.getItem(key);
    if (value == null || value === "") {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function TaskEditorModal({
    editorMode,
    draftTask,
    organizations,
    clients,
    projects,
    softwareProducts,
    taskTimeEntries = [],
    taskTimeEntriesLoading = false,
    taskTimeEntriesError = "",
    onDraftChange,
    onOrganizationChange,
    onClientChange,
    onProjectChange,
    onSoftwareProductChange,
    onCompletedChange,
    onEstimatedHoursChange,
    onSave,
    onCancel
}) {
    const actualHoursValue = Number(draftTask.actual_hours ?? 0);
    const estimatedHoursValue = Number(draftTask.estimated_hours ?? 0);
    const taskTimeEntriesTotal = taskTimeEntries.reduce((sum, entry) => sum + Number(entry.hours ?? 0), 0);
    const modalActualHoursValue = draftTask.id != null && !taskTimeEntriesLoading && !taskTimeEntriesError
        ? taskTimeEntriesTotal
        : actualHoursValue;
    const actualHoursIsOverEstimate = shouldHighlightActualHours(modalActualHoursValue, estimatedHoursValue);

    return (
        <div className="tracking-modal-overlay" role="presentation">
            <div
                className="tracking-modal tracking-modal-confirm tracking-modal-task-editor"
                role="dialog"
                aria-modal="true"
                aria-labelledby="tasks-editor-title"
            >
                <div className="tracking-modal-header">
                    <h3 id="tasks-editor-title">{editorMode === "add" ? "Add Task" : "Edit Task"}</h3>
                </div>
                <div className="tracking-modal-body tracking-modal-task-editor-body">
                    <div className="tasks-editor-grid">
                        <label className="tracking-modal-field tasks-editor-field tasks-editor-field-completed">
                            <span>Completed</span>
                            <input
                                type="checkbox"
                                checked={Boolean(draftTask.completed)}
                                onChange={event => onCompletedChange(event.target.checked)}
                            />
                        </label>

                        <label className="tracking-modal-field tasks-editor-field tasks-editor-field-created">
                            <span>Created Date</span>
                            <input
                                type="date"
                                value={draftTask.created_at ?? ""}
                                onChange={event => onDraftChange("created_at", event.target.value)}
                            />
                        </label>

                        <label className="tracking-modal-field tasks-editor-field tasks-editor-field-organization">
                            <span>Organization</span>
                            <select
                                value={String(draftTask.organizationId ?? "")}
                                onChange={event => onOrganizationChange(event.target.value)}
                            >
                                <option value=""></option>
                                {organizations.map(organization => (
                                    <option key={organization.id} value={String(organization.id)}>
                                        {organization.shortName}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="tracking-modal-field tasks-editor-field tasks-editor-field-client">
                            <span>Client</span>
                            <select
                                value={String(draftTask.clientId ?? "")}
                                onChange={event => onClientChange(event.target.value)}
                                disabled={clients.length === 0}
                            >
                                <option value=""></option>
                                {clients.map(client => (
                                    <option key={client.id} value={String(client.id)}>
                                        {client.shortName}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="tracking-modal-field tasks-editor-field tasks-editor-field-project">
                            <span>Project</span>
                            <select
                                value={String(draftTask.projectId ?? "")}
                                onChange={event => onProjectChange(event.target.value)}
                                disabled={projects.length === 0}
                            >
                                <option value=""></option>
                                {projects.map(project => (
                                    <option key={project.id} value={String(project.id)}>
                                        {project.shortName}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="tracking-modal-field tasks-editor-field tasks-editor-field-software">
                            <span>Software Product</span>
                            <select
                                value={String(draftTask.softwareProductId ?? "")}
                                onChange={event => onSoftwareProductChange(event.target.value)}
                                disabled={softwareProducts.length === 0}
                            >
                                <option value=""></option>
                                {softwareProducts.map(product => (
                                    <option key={product.id} value={String(product.id)}>
                                        {product.shortName}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="tracking-modal-field tasks-editor-field tasks-editor-field-task-number">
                            <span>Task Number</span>
                            <input
                                type="text"
                                value={draftTask.task_number ?? ""}
                                onChange={event => onDraftChange("task_number", event.target.value)}
                            />
                        </label>

                        <label className="tracking-modal-field tasks-editor-field tasks-editor-field-name">
                            <span>Name</span>
                            <input
                                type="text"
                                value={draftTask.name ?? ""}
                                onChange={event => onDraftChange("name", event.target.value)}
                            />
                        </label>

                        <div className="tasks-editor-hours-row">
                            <label className="tracking-modal-field tasks-editor-field tasks-editor-field-actual">
                                <span>Actual Hours</span>
                                <input
                                    type="text"
                                    className={actualHoursIsOverEstimate ? "tasks-hours-danger" : ""}
                                    value={modalActualHoursValue.toFixed(2)}
                                    readOnly
                                    aria-readonly="true"
                                />
                            </label>

                            <label className="tracking-modal-field tasks-editor-field tasks-editor-field-estimated">
                                <span>Estimated Hours</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.25"
                                    value={draftTask.estimated_hours}
                                    onChange={event => onEstimatedHoursChange(event.target.value)}
                                />
                            </label>
                        </div>

                        <label className="tracking-modal-field tasks-editor-field tasks-editor-field-link">
                            <span>Task Link</span>
                            <div className="tasks-editor-link-control">
                                <input
                                    type="url"
                                    value={draftTask.task_link ?? ""}
                                    onChange={event => onDraftChange("task_link", event.target.value)}
                                />
                                <a
                                    className={[
                                        "tracking-save-button",
                                        "tasks-editor-link-open",
                                        draftTask.task_link ? "" : "tasks-editor-link-open-disabled"
                                    ].filter(Boolean).join(" ")}
                                    href={draftTask.task_link || undefined}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-disabled={!draftTask.task_link}
                                    onClick={event => {
                                        if (!draftTask.task_link) {
                                            event.preventDefault();
                                        }
                                    }}
                                >
                                    Open
                                </a>
                            </div>
                        </label>

                        <label className="tracking-modal-field tasks-editor-field tasks-editor-field-comment">
                            <span>Comment</span>
                            <textarea
                                rows="3"
                                value={draftTask.comment ?? ""}
                                onChange={event => onDraftChange("comment", event.target.value)}
                            />
                        </label>
                    </div>
                    <section className="tasks-editor-timesheet">
                        <div className="tasks-editor-timesheet-header">
                            <h4>Task Worklog</h4>
                            <span className="tasks-editor-timesheet-total">
                                Total {taskTimeEntriesTotal.toFixed(2)}
                            </span>
                        </div>

                        {draftTask.id == null ? (
                            <div className="tasks-editor-timesheet-empty">
                                Save the task first to view worklog entries.
                            </div>
                        ) : taskTimeEntriesLoading ? (
                            <div className="tasks-editor-timesheet-empty">
                                Loading worklog entries...
                            </div>
                        ) : taskTimeEntriesError ? (
                            <div className="tracking-modal-error tasks-editor-timesheet-error">
                                {taskTimeEntriesError}
                            </div>
                        ) : (
                            <div className="tasks-editor-timesheet-table-wrap">
                                <table className="tasks-editor-timesheet-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th className="tasks-number-cell">Hours</th>
                                            <th>Entry Comment</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {taskTimeEntries.length === 0 ? (
                                            <tr>
                                                <td colSpan="3" className="tasks-editor-timesheet-empty-cell">
                                                    No worklog entries for this task.
                                                </td>
                                            </tr>
                                        ) : (
                                            taskTimeEntries.map(entry => (
                                                <tr key={entry.id ?? `${entry.date}-${entry.hours}-${entry.comment ?? ""}`}>
                                                    <td>{formatDate(entry.date)}</td>
                                                    <td className="tasks-number-cell">{Number(entry.hours ?? 0).toFixed(2)}</td>
                                                    <td>{entry.comment ?? ""}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                    {softwareProducts.length === 0 ? (
                        <div className="tracking-modal-error">
                            No software products are available. Add software products in Settings.
                        </div>
                    ) : null}
                </div>
                <div className="tracking-modal-actions">
                    <button type="button" className="tracking-modal-button" onClick={onSave}>
                        Save
                    </button>
                    <button
                        type="button"
                        className="tracking-modal-button tracking-modal-button-secondary"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function TasksPage({
    organizations = [],
    currentOrganizationId = null,
    softwareProducts = []
}) {
    const [clients, setClients] = useState([]);
    const [projects, setProjects] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [selectedOrganizationId, setSelectedOrganizationId] = useState(
        readStoredNumber("dev-productivity:tasks:selected-organization-id")
        ?? currentOrganizationId
        ?? organizations[0]?.id
        ?? null
    );
    const [selectedClientId, setSelectedClientId] = useState(readStoredNumber("dev-productivity:tasks:selected-client-id"));
    const [selectedProjectId, setSelectedProjectId] = useState(readStoredNumber("dev-productivity:tasks:selected-project-id"));
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [showIncompleteOnly, setShowIncompleteOnly] = useState(
        sessionStorage.getItem("dev-productivity:tasks:show-incomplete-only") !== "false"
    );
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorMode, setEditorMode] = useState(null); // "add" | "edit"
    const [draftTask, setDraftTask] = useState(null);
    const [taskTimeEntries, setTaskTimeEntries] = useState([]);
    const [taskTimeEntriesLoading, setTaskTimeEntriesLoading] = useState(false);
    const [taskTimeEntriesError, setTaskTimeEntriesError] = useState("");
    const [validationDialogOpen, setValidationDialogOpen] = useState(false);
    const [validationIssues, setValidationIssues] = useState([]);
    const [warningDialogOpen, setWarningDialogOpen] = useState(false);
    const [warningMessage, setWarningMessage] = useState("");
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const handleCancelRef = useRef(() => {});

    const filteredTasks = useMemo(
        () => tasks
            .filter(task =>
                (selectedOrganizationId == null || sameId(task.organizationId, selectedOrganizationId))
                && (selectedClientId == null || sameId(task.clientId, selectedClientId))
                && (selectedProjectId == null || sameId(task.projectId, selectedProjectId))
                && (!showIncompleteOnly || !task.completed)
            )
            .sort((left, right) => {
                const leftDate = left.created_at ?? "";
                const rightDate = right.created_at ?? "";

                if (leftDate !== rightDate) {
                    return leftDate.localeCompare(rightDate);
                }

                return String(left.id ?? "").localeCompare(String(right.id ?? ""));
            }),
        [tasks, selectedClientId, selectedOrganizationId, selectedProjectId, showIncompleteOnly]
    );

    const selectedTask = filteredTasks.find(task => sameId(task.id, selectedTaskId)) ?? null;
    const taskCountLabel = `${filteredTasks.length} task${filteredTasks.length === 1 ? "" : "s"}`;

    useEffect(() => {
        let active = true;

        async function loadData() {
            try {
                const [nextClients, nextProjects, nextTasks] = await Promise.all([
                    loadClients(),
                    loadProjects(),
                    loadTasks()
                ]);

                if (!active) {
                    return;
                }

                setClients(nextClients);
                setProjects(nextProjects);
                setTasks(nextTasks);

                const storedOrganizationId = readStoredNumber("dev-productivity:tasks:selected-organization-id");
                const storedClientId = readStoredNumber("dev-productivity:tasks:selected-client-id");
                const storedProjectId = readStoredNumber("dev-productivity:tasks:selected-project-id");
                const initialOrganizationId = storedOrganizationId ?? currentOrganizationId ?? organizations[0]?.id ?? nextClients[0]?.organizationId ?? null;
                const initialClients = nextClients.filter(client => sameId(client.organizationId, initialOrganizationId));
                const initialClientId = storedClientId != null && initialClients.some(client => sameId(client.id, storedClientId))
                    ? storedClientId
                    : initialClients[0]?.id ?? null;
                const initialProjects = nextProjects.filter(project =>
                    sameId(project.organizationId, initialOrganizationId)
                    && sameId(project.clientId, initialClientId)
                );
                const initialProjectId = storedProjectId != null && initialProjects.some(project => sameId(project.id, storedProjectId))
                    ? storedProjectId
                    : initialProjects[0]?.id ?? null;
                const initialTaskId = nextTasks.find(task =>
                    sameId(task.organizationId, initialOrganizationId)
                    && sameId(task.clientId, initialClientId)
                    && sameId(task.projectId, initialProjectId)
                )?.id ?? null;

                setSelectedOrganizationId(initialOrganizationId);
                setSelectedClientId(initialClientId);
                setSelectedProjectId(initialProjectId);
                setSelectedTaskId(initialTaskId);
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
        setWarningMessage("");
        setDeleteConfirmOpen(false);
    }, []);

    const closeEditor = useCallback(() => {
        setEditorOpen(false);
        setEditorMode(null);
        setDraftTask(null);
        setTaskTimeEntries([]);
        setTaskTimeEntriesLoading(false);
        setTaskTimeEntriesError("");
        closeTransientDialogs();
    }, [closeTransientDialogs]);

    const getContextDefaults = (organizationId, clientId = null, projectId = null) => {
        const nextOrganizationClients = clients.filter(client => sameId(client.organizationId, organizationId));
        const resolvedClientId = clientId != null && nextOrganizationClients.some(client => sameId(client.id, clientId))
            ? clientId
            : nextOrganizationClients[0]?.id ?? null;

        const nextProjects = projects.filter(project =>
            sameId(project.organizationId, organizationId)
            && sameId(project.clientId, resolvedClientId)
        );
        const resolvedProjectId = projectId != null && nextProjects.some(project => sameId(project.id, projectId))
            ? projectId
            : nextProjects[0]?.id ?? null;

        return {
            organizationId,
            clientId: resolvedClientId,
            projectId: resolvedProjectId
        };
    };

    const openEditorForExisting = (task) => {
        setTaskTimeEntries([]);
        setTaskTimeEntriesLoading(true);
        setTaskTimeEntriesError("");
        setEditorOpen(true);
        setEditorMode("edit");
        setDraftTask({
            ...task,
            softwareProductId: task.softwareProductId ?? null
        });
        setSelectedTaskId(task.id);
        closeTransientDialogs();
    };

    const openEditorForNew = () => {
        setTaskTimeEntries([]);
        setTaskTimeEntriesLoading(false);
        setTaskTimeEntriesError("");
        const defaults = getContextDefaults(selectedOrganizationId, selectedClientId, selectedProjectId);
        const nextDraft = createTaskDraft(defaults);

        setEditorOpen(true);
        setEditorMode("add");
        setDraftTask(nextDraft);
        closeTransientDialogs();
    };

    const applyFilterSelection = (organizationId, clientId = null, projectId = null) => {
        const defaults = getContextDefaults(organizationId, clientId, projectId);
        setSelectedOrganizationId(defaults.organizationId);
        setSelectedClientId(defaults.clientId);
        setSelectedProjectId(defaults.projectId);
        if (defaults.organizationId == null) {
            sessionStorage.removeItem("dev-productivity:tasks:selected-organization-id");
        } else {
            sessionStorage.setItem("dev-productivity:tasks:selected-organization-id", String(defaults.organizationId));
        }
        if (defaults.clientId == null) {
            sessionStorage.removeItem("dev-productivity:tasks:selected-client-id");
        } else {
            sessionStorage.setItem("dev-productivity:tasks:selected-client-id", String(defaults.clientId));
        }
        if (defaults.projectId == null) {
            sessionStorage.removeItem("dev-productivity:tasks:selected-project-id");
        } else {
            sessionStorage.setItem("dev-productivity:tasks:selected-project-id", String(defaults.projectId));
        }
        setSelectedTaskId(
            tasks.find(task =>
                sameId(task.organizationId, defaults.organizationId)
                && sameId(task.clientId, defaults.clientId)
                && sameId(task.projectId, defaults.projectId)
            )?.id ?? null
        );
    };

    const handleRowSelect = (task) => {
        if (editorOpen) {
            return;
        }

        setSelectedTaskId(task.id);
    };

    const handleRowEditRequest = (task) => {
        if (editorOpen) {
            return;
        }

        openEditorForExisting(task);
    };

    const handleAddTask = () => {
        if (editorOpen) {
            return;
        }

        openEditorForNew();
    };

    const handleEditTask = () => {
        if (selectedTask && !editorOpen) {
            openEditorForExisting(selectedTask);
        }
    };

    const getTaskDeleteErrorMessage = (error) => {
        const status = error?.response?.status;

        if (status === 401 || status === 403) {
            return "Task delete request was rejected by security. Please sign in again or check access permissions.";
        }

        return error?.response?.data?.message ??
            error?.response?.data?.error ??
            error?.message ??
            "Task cannot be deleted because worklog entries exist.";
    };

    const handleDeleteTask = async () => {
        if (!selectedTask || editorOpen) {
            return;
        }

        try {
            await checkTaskCanDelete(selectedTask.id);
            setDeleteConfirmOpen(true);
        } catch (error) {
            setWarningMessage(getTaskDeleteErrorMessage(error));
            setWarningDialogOpen(true);
            setDeleteConfirmOpen(false);
        }
    };

    const handleCancelDeleteTask = () => {
        setDeleteConfirmOpen(false);
    };

    const handleConfirmDeleteTask = async () => {
        if (!selectedTask || editorOpen) {
            setDeleteConfirmOpen(false);
            return;
        }

        try {
            await apiDeleteTask(selectedTask.id);
            setTasks(currentTasks => currentTasks.filter(task => task.id !== selectedTask.id));
            const remaining = filteredTasks.filter(task => task.id !== selectedTask.id);
            setSelectedTaskId(remaining[0]?.id ?? null);
            closeTransientDialogs();
        } catch (error) {
            setWarningMessage(getTaskDeleteErrorMessage(error));
            setWarningDialogOpen(true);
            setDeleteConfirmOpen(false);
        }
    };

    const handleDraftChange = (field, value) => {
        setDraftTask(current => (current ? {
            ...current,
            [field]: value
        } : current));
    };

    const handleDraftOrganizationChange = (nextOrganizationId) => {
        if (!draftTask) {
            return;
        }

        const parsedOrganizationId = nextOrganizationId === "" ? null : Number(nextOrganizationId);
        if (parsedOrganizationId == null) {
            handleDraftChange("organizationId", null);
            return;
        }

        const nextClients = clients.filter(client => sameId(client.organizationId, parsedOrganizationId));
        const nextClientId = nextClients.some(client => sameId(client.id, draftTask.clientId))
            ? draftTask.clientId
            : null;
        setDraftTask(current => (current ? {
            ...current,
            organizationId: parsedOrganizationId,
            clientId: nextClientId,
            projectId: null
        } : current));
    };

    const handleDraftClientChange = (nextClientId) => {
        if (!draftTask) {
            return;
        }

        const parsedClientId = nextClientId === "" ? null : Number(nextClientId);
        if (parsedClientId == null) {
            handleDraftChange("clientId", null);
            return;
        }

        const nextProjects = projects.filter(project =>
            sameId(project.organizationId, draftTask.organizationId)
            && sameId(project.clientId, parsedClientId)
        );
        const nextProjectId = nextProjects.some(project => sameId(project.id, draftTask.projectId))
            ? draftTask.projectId
            : null;

        setDraftTask(current => (current ? {
            ...current,
            clientId: parsedClientId,
            projectId: nextProjectId
        } : current));
    };

    const handleDraftProjectChange = (nextProjectId) => {
        const parsedProjectId = nextProjectId === "" ? null : Number(nextProjectId);
        handleDraftChange("projectId", parsedProjectId);
    };

    const handleDraftSoftwareProductChange = (nextSoftwareProductId) => {
        const parsedSoftwareProductId = nextSoftwareProductId === "" ? null : Number(nextSoftwareProductId);
        handleDraftChange("softwareProductId", parsedSoftwareProductId);
    };

    const handleCompletedChange = (checked) => {
        handleDraftChange("completed", checked);
    };

    const handleEstimatedHoursChange = (value) => {
        if (!draftTask) {
            return;
        }

        if (value === "") {
            handleDraftChange("estimated_hours", 0);
            return;
        }

        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
            handleDraftChange("estimated_hours", parsed);
        }
    };

    const handleOrganizationChange = (nextOrganizationId) => {
        if (nextOrganizationId === "") {
            handleClearOrganizationFilter();
            return;
        }

        const parsedOrganizationId = Number(nextOrganizationId);

        if (editorOpen) {
            closeEditor();
        }

        applyFilterSelection(parsedOrganizationId);
        closeTransientDialogs();
    };

    const handleClearOrganizationFilter = () => {
        if (editorOpen) {
            closeEditor();
        }

        setSelectedOrganizationId(null);
        sessionStorage.removeItem("dev-productivity:tasks:selected-organization-id");
        setSelectedTaskId(tasks.find(task =>
            (selectedClientId == null || sameId(task.clientId, selectedClientId))
            && (selectedProjectId == null || sameId(task.projectId, selectedProjectId))
            && (!showIncompleteOnly || !task.completed)
        )?.id ?? null);
        closeTransientDialogs();
    };

    const handleClientChange = (nextClientId) => {
        const parsedClientId = nextClientId === "" ? null : Number(nextClientId);

        if (editorOpen) {
            closeEditor();
        }

        if (parsedClientId == null) {
            setSelectedClientId(null);
            setSelectedProjectId(null);
            sessionStorage.removeItem("dev-productivity:tasks:selected-client-id");
            sessionStorage.removeItem("dev-productivity:tasks:selected-project-id");
            setSelectedTaskId(null);
            closeTransientDialogs();
            return;
        }

        const nextProjects = projects.filter(project =>
            sameId(project.organizationId, selectedOrganizationId)
            && sameId(project.clientId, parsedClientId)
        );

        setSelectedClientId(parsedClientId);
        setSelectedProjectId(nextProjects[0]?.id ?? null);
        sessionStorage.setItem("dev-productivity:tasks:selected-client-id", String(parsedClientId));
        if (nextProjects[0]?.id == null) {
            sessionStorage.removeItem("dev-productivity:tasks:selected-project-id");
        } else {
            sessionStorage.setItem("dev-productivity:tasks:selected-project-id", String(nextProjects[0].id));
        }
        setSelectedTaskId(tasks.find(task =>
            sameId(task.organizationId, selectedOrganizationId)
            && sameId(task.clientId, parsedClientId)
            && sameId(task.projectId, nextProjects[0]?.id)
        )?.id ?? null);
        closeTransientDialogs();
    };

    const handleClearClientFilter = () => {
        if (editorOpen) {
            closeEditor();
        }

        setSelectedClientId(null);
        sessionStorage.removeItem("dev-productivity:tasks:selected-client-id");
        setSelectedTaskId(tasks.find(task =>
            (selectedOrganizationId == null || sameId(task.organizationId, selectedOrganizationId))
            && (selectedProjectId == null || sameId(task.projectId, selectedProjectId))
            && (!showIncompleteOnly || !task.completed)
        )?.id ?? null);
        closeTransientDialogs();
    };

    const handleProjectChange = (nextProjectId) => {
        const parsedProjectId = nextProjectId === "" ? null : Number(nextProjectId);

        if (editorOpen) {
            closeEditor();
        }

        setSelectedProjectId(parsedProjectId);
        if (parsedProjectId == null) {
            sessionStorage.removeItem("dev-productivity:tasks:selected-project-id");
        } else {
            sessionStorage.setItem("dev-productivity:tasks:selected-project-id", String(parsedProjectId));
        }
        setSelectedTaskId(tasks.find(task =>
            sameId(task.organizationId, selectedOrganizationId)
            && sameId(task.clientId, selectedClientId)
            && sameId(task.projectId, parsedProjectId)
        )?.id ?? null);
        closeTransientDialogs();
    };

    const handleClearProjectFilter = () => {
        if (editorOpen) {
            closeEditor();
        }

        setSelectedProjectId(null);
        sessionStorage.removeItem("dev-productivity:tasks:selected-project-id");
        setSelectedTaskId(tasks.find(task =>
            (selectedOrganizationId == null || sameId(task.organizationId, selectedOrganizationId))
            && (selectedClientId == null || sameId(task.clientId, selectedClientId))
            && (!showIncompleteOnly || !task.completed)
        )?.id ?? null);
        closeTransientDialogs();
    };

    const handleSaveTask = async () => {
        if (!draftTask) {
            return;
        }

        const issues = validateTask(draftTask, softwareProducts);
        if (issues.length > 0) {
            setValidationIssues(issues);
            setValidationDialogOpen(true);
            return;
        }

        try {
            const isNewTask = editorMode === "add";
            const savedTask = isNewTask
                ? await apiCreateTask(draftTask)
                : await apiUpdateTask(draftTask.id, draftTask);
            const normalizedTask = {
                ...draftTask,
                ...savedTask,
                actual_hours: savedTask.actual_hours ?? draftTask.actual_hours ?? 0,
                softwareProductId: draftTask.softwareProductId ?? savedTask.softwareProductId ?? null
            };

            setTasks(currentTasks =>
                isNewTask
                    ? [...currentTasks, normalizedTask]
                    : currentTasks.map(task =>
                        sameId(task.id, draftTask.id)
                            ? normalizedTask
                            : task
                    )
            );
            setSelectedTaskId(normalizedTask.id);
            closeEditor();
        } catch (error) {
            const message =
                error?.response?.data?.message ??
                error?.response?.data?.error ??
                error?.message ??
                "Unable to save task.";
            setWarningMessage(message);
            setWarningDialogOpen(true);
        }
    };

    const handleCancelTask = () => {
        if (!editorOpen) {
            return;
        }

        closeEditor();
    };

    useEffect(() => {
        handleCancelRef.current = () => {
            if (!editorOpen) {
                return;
            }

            closeEditor();
        };
    }, [editorOpen, closeEditor]);

    useEffect(() => {
        let active = true;

        async function loadTaskTimeEntries() {
            if (!editorOpen || draftTask?.id == null) {
                setTaskTimeEntries([]);
                setTaskTimeEntriesLoading(false);
                setTaskTimeEntriesError("");
                return;
            }

            setTaskTimeEntriesLoading(true);
            setTaskTimeEntriesError("");

            try {
                const nextEntries = await getTimeEntriesByTask(draftTask.id);
                if (!active) {
                    return;
                }

                setTaskTimeEntries(nextEntries);
            } catch (error) {
                if (!active) {
                    return;
                }

                setTaskTimeEntries([]);
                setTaskTimeEntriesError(
                    error?.response?.data?.message ??
                    error?.response?.data?.error ??
                    error?.message ??
                    "Unable to load task worklog entries."
                );
            } finally {
                if (active) {
                    setTaskTimeEntriesLoading(false);
                }
            }
        }

        loadTaskTimeEntries();

        return () => {
            active = false;
        };
    }, [draftTask?.id, editorOpen]);

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

    const renderRow = (task) => {
        const isSelected = sameId(task.id, selectedTaskId);
        const actualHoursValue = Number(task.actual_hours ?? 0);
        const estimatedHoursValue = Number(task.estimated_hours ?? 0);
        const actualHoursClassName = shouldHighlightActualHours(actualHoursValue, estimatedHoursValue)
            ? "tasks-hours-danger"
            : "";

        return (
            <tr
                key={task.id}
                className={isSelected ? "organizations-row-selected" : ""}
                onClick={() => handleRowSelect(task)}
                onDoubleClick={() => handleRowEditRequest(task)}
            >
                <td className="tasks-completed-cell">
                    {task.completed ? (
                        <span className="tasks-completed-indicator" aria-label="Completed" title="Completed">
                            {"\u2713"}
                        </span>
                    ) : null}
                </td>
                <td>{formatDate(task.created_at)}</td>
                <td>{task.task_number}</td>
                <td>{resolveClientLabel(clients, task.clientId)}</td>
                <td>{task.name}</td>
                <td className={["tasks-number-cell", actualHoursClassName].filter(Boolean).join(" ")}>{actualHoursValue.toFixed(2)}</td>
                <td className="tasks-number-cell">{estimatedHoursValue.toFixed(2)}</td>
            </tr>
        );
    };

    const filterClients = useMemo(
        () => selectedOrganizationId == null
            ? clients
            : clients.filter(client => sameId(client.organizationId, selectedOrganizationId)),
        [clients, selectedOrganizationId]
    );
    const filterProjects = useMemo(
        () => projects.filter(project =>
            (selectedOrganizationId == null || sameId(project.organizationId, selectedOrganizationId))
            && (selectedClientId == null || sameId(project.clientId, selectedClientId))
        ),
        [projects, selectedClientId, selectedOrganizationId]
    );
    const editorClients = draftTask
        ? clients.filter(client => draftTask.organizationId == null || sameId(client.organizationId, draftTask.organizationId))
        : [];
    const editorProjects = draftTask
        ? projects.filter(project =>
            (draftTask.organizationId == null || sameId(project.organizationId, draftTask.organizationId))
            && (draftTask.clientId == null || sameId(project.clientId, draftTask.clientId))
        )
        : [];

    return (
        <div className="tracking-main organizations-main">
            <header className="tracking-topbar">
                <div className="tracking-topbar-main">
                    <div>
                        <h2>Tasks</h2>
                    </div>
                </div>
            </header>

            <section className="tasks-filter-bar">
                <div className="tasks-filter-header-row">
                    <label className="tasks-filter-heading" htmlFor="tasks-organization-select">
                        Organization
                    </label>
                    <label className="tasks-filter-heading" htmlFor="tasks-client-select">
                        Client
                    </label>
                    <label className="tasks-filter-heading tasks-filter-heading-project" htmlFor="tasks-project-select">
                        Project
                    </label>
                </div>

                <div className="tasks-filter-values-row">
                    <div className="tasks-filter-field">
                        <div className="selector-clear-control">
                            <select
                                id="tasks-organization-select"
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
                                id="tasks-client-select"
                                className="clients-filter-select tasks-filter-select"
                                value={String(selectedClientId ?? "")}
                                onChange={event => handleClientChange(event.target.value)}
                                disabled={filterClients.length === 0}
                            >
                                <option value=""></option>
                                {filterClients.map(client => (
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

                    <div className="tasks-filter-field tasks-filter-field-project">
                        <div className="selector-clear-control">
                            <select
                                id="tasks-project-select"
                                className="clients-filter-select tasks-filter-select"
                                value={String(selectedProjectId ?? "")}
                                onChange={event => handleProjectChange(event.target.value)}
                                disabled={filterProjects.length === 0}
                            >
                                <option value=""></option>
                                {filterProjects.map(project => (
                                    <option key={project.id} value={String(project.id)}>
                                        {project.shortName}
                                    </option>
                                ))}
                            </select>
                            {selectedProjectId != null && (
                                <button type="button" className="selector-clear-button" onClick={handleClearProjectFilter} aria-label="Clear project filter">
                                    ×
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <div className="tracking-content-grid organizations-content-grid">
                <section className="tracking-panel organizations-panel">
                    <div className="tracking-panel-header organizations-panel-header">
                        <div>
                            <h3>Task List</h3>
                            <p className="organizations-subtitle">{taskCountLabel}</p>
                        </div>

                        <div className="organizations-toolbar">
                            <label className="tasks-toolbar-toggle">
                                <input
                                    type="checkbox"
                                    checked={showIncompleteOnly}
                                    onChange={event => {
                                        setShowIncompleteOnly(event.target.checked);
                                        sessionStorage.setItem("dev-productivity:tasks:show-incomplete-only", String(event.target.checked));
                                    }}
                                />
                                <span>Only open tasks</span>
                            </label>
                            <div className="organizations-toolbar-actions">
                                <button
                                    type="button"
                                    className="tracking-save-button"
                                    onClick={handleAddTask}
                                    disabled={editorOpen}
                                >
                                    Add
                                </button>
                                <button
                                    type="button"
                                    className="tracking-save-button"
                                    onClick={handleEditTask}
                                    disabled={editorOpen || !selectedTask}
                                >
                                    Edit
                                </button>
                            </div>
                            <button
                                type="button"
                                className="organizations-delete-button organizations-delete-button-separated"
                                onClick={handleDeleteTask}
                                disabled={editorOpen || !selectedTask}
                            >
                                Delete
                            </button>
                        </div>
                    </div>

                    <div className="tracking-panel-body organizations-panel-body">
                        <table className="app-master-data-table tasks-table">
                            <colgroup>
                                <col className="tasks-col-completed" />
                                <col className="tasks-col-date" />
                                <col className="tasks-col-number" />
                                <col className="tasks-col-client" />
                                <col className="tasks-col-name" />
                                <col className="tasks-col-hours" />
                                <col className="tasks-col-hours" />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>Completed</th>
                                    <th>Created Date</th>
                                    <th>Task Number</th>
                                    <th>Client</th>
                                    <th>Name</th>
                                    <th className="tasks-number-cell">Actual Hours</th>
                                    <th className="tasks-number-cell">Estimated Hours</th>
                                </tr>
                            </thead>
                            <tbody>{filteredTasks.map(renderRow)}</tbody>
                        </table>
                    </div>
                </section>
            </div>

            {editorOpen && draftTask && (
                <TaskEditorModal
                    editorMode={editorMode}
                    draftTask={draftTask}
                    organizations={organizations}
                    clients={editorClients}
                    projects={editorProjects}
                    softwareProducts={softwareProducts}
                    taskTimeEntries={taskTimeEntries}
                    taskTimeEntriesLoading={taskTimeEntriesLoading}
                    taskTimeEntriesError={taskTimeEntriesError}
                    onDraftChange={handleDraftChange}
                    onOrganizationChange={handleDraftOrganizationChange}
                    onClientChange={handleDraftClientChange}
                    onProjectChange={handleDraftProjectChange}
                    onSoftwareProductChange={handleDraftSoftwareProductChange}
                    onCompletedChange={handleCompletedChange}
                    onEstimatedHoursChange={handleEstimatedHoursChange}
                    onSave={handleSaveTask}
                    onCancel={handleCancelTask}
                />
            )}

            {validationDialogOpen && (
                <div className="tracking-modal-overlay" role="presentation">
                    <div
                        className="tracking-modal tracking-modal-confirm"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="tasks-validation-title"
                    >
                        <div className="tracking-modal-header">
                            <h3 id="tasks-validation-title">Validation errors</h3>
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
                        aria-labelledby="tasks-delete-confirm-title"
                    >
                        <div className="tracking-modal-header">
                            <h3 id="tasks-delete-confirm-title">Delete task</h3>
                        </div>
                        <div className="tracking-modal-body">
                            <p className="tracking-modal-text">Delete selected task?</p>
                        </div>
                        <div className="tracking-modal-actions">
                            <button type="button" className="tracking-modal-button" onClick={handleConfirmDeleteTask}>
                                Delete
                            </button>
                            <button
                                type="button"
                                className="tracking-modal-button tracking-modal-button-secondary"
                                onClick={handleCancelDeleteTask}
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
                        aria-labelledby="tasks-warning-title"
                    >
                        <div className="tracking-modal-header">
                            <h3 id="tasks-warning-title">Delete not available</h3>
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
