import { useEffect, useRef, useState } from "react";
import MonthlySummaryTable from "../components/MonthlySummaryTable";
import WorklogEntriesTable from "../components/WorklogEntriesTable";
import { createLocalWorklogEntry } from "../utils/timeTrackingEntries";
import { buildCalendarDays, formatMonthYear } from "../utils/timeTrackingDates";
import { validateWorklogDay } from "../utils/timeTrackingValidation";
import {
    createTimeEntry,
    deleteTimeEntry,
    getClients,
    getTasks,
    getTimeEntriesByDate,
    getTimeEntriesByMonth,
    updateTimeEntry
} from "../services/timeTrackingService";
import "../styles/timeTracking.css";

function PlaceholderPanel({ title, className = "", children }) {
    return (
        <section className={`tracking-panel ${className}`}>
            <div className="tracking-panel-header">
                <h3>{title}</h3>
            </div>
            <div className="tracking-panel-body">
                {children}
            </div>
        </section>
    );
}

function formatDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getApiErrorMessage(error, fallbackMessage) {
    const message = error?.response?.data?.message || error?.message;
    return message || fallbackMessage;
}

function mergeEntriesForDate(currentEntries, date, nextDayEntries) {
    const nextEntries = [];
    let inserted = false;

    currentEntries.forEach(entry => {
        if (entry.date === date) {
            if (!inserted) {
                nextEntries.push(...nextDayEntries);
                inserted = true;
            }
            return;
        }

        nextEntries.push(entry);
    });

    if (!inserted) {
        nextEntries.push(...nextDayEntries);
    }

    return nextEntries;
}

function isValidHoursInput(value) {
    return value === "" || /^\d*\.?\d*$/.test(value);
}

function sameId(left, right) {
    return left != null && right != null && String(left) === String(right);
}

function toOptionalNumber(value) {
    if (value == null || value === "") {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function WorklogEntryModal({
    mode,
    draftEntry,
    organizations,
    clients,
    tasks,
    onChange,
    onSave,
    onCancel
}) {
    const availableClients = draftEntry.organizationId == null
        ? clients
        : clients.filter(client => sameId(client.organizationId, draftEntry.organizationId));
    const availableTasks = draftEntry.clientId == null
        ? []
        : tasks.filter(task =>
            sameId(task.clientId, draftEntry.clientId)
            && (draftEntry.organizationId == null || sameId(task.organizationId, draftEntry.organizationId))
        );
    const selectedTaskName = availableTasks.find(task => sameId(task.id, draftEntry.taskId))?.name
        ?? draftEntry.taskName
        ?? "";
    const handleSubmit = (event) => {
        event.preventDefault();
        onSave();
    };

    return (
        <div className="tracking-modal-overlay" role="presentation">
            <form
                onSubmit={handleSubmit}
                className="tracking-modal tracking-modal-confirm tracking-modal-worklog-editor"
                role="dialog"
                aria-modal="true"
                aria-labelledby="worklog-entry-editor-title"
            >
                <div className="tracking-modal-header">
                    <h3 id="worklog-entry-editor-title">{mode === "add" ? "Add Worklog Entry" : "Edit Worklog Entry"}</h3>
                </div>
                <div className="tracking-modal-body">
                    <div className="tracking-modal-fields">
                        <label className="tracking-modal-field">
                            <span>Organization</span>
                            <div className="selector-clear-control">
                                <select
                                    value={String(draftEntry.organizationId ?? "")}
                                    onChange={event => onChange("organization", event.target.value)}
                                >
                                    <option value=""></option>
                                    {organizations.map(organization => (
                                        <option key={organization.id} value={String(organization.id)}>
                                            {organization.shortName}
                                        </option>
                                    ))}
                                </select>
                                {draftEntry.organizationId != null && (
                                    <button type="button" className="selector-clear-button" onClick={() => onChange("organization", "")} aria-label="Clear organization">
                                        ×
                                    </button>
                                )}
                            </div>
                        </label>

                        <label className="tracking-modal-field">
                            <span>Client</span>
                            <div className="selector-clear-control">
                                <select
                                    value={String(draftEntry.clientId ?? "")}
                                    onChange={event => onChange("client", event.target.value)}
                                    disabled={availableClients.length === 0}
                                >
                                    <option value=""></option>
                                    {availableClients.map(client => (
                                        <option key={client.id} value={String(client.id)}>
                                            {client.name}
                                        </option>
                                    ))}
                                </select>
                                {draftEntry.clientId != null && (
                                    <button type="button" className="selector-clear-button" onClick={() => onChange("client", "")} aria-label="Clear client">
                                        ×
                                    </button>
                                )}
                            </div>
                        </label>

                        <label className="tracking-modal-field tracking-modal-worklog-task-field">
                            <span>Task</span>
                            <div className="selector-clear-control">
                                <select
                                    value={String(draftEntry.taskId ?? "")}
                                    onChange={event => onChange("task", event.target.value)}
                                    disabled={availableTasks.length === 0}
                                    title={selectedTaskName}
                                >
                                    <option value=""></option>
                                    {availableTasks.map(task => (
                                        <option key={task.id} value={String(task.id)} title={task.name}>
                                            {task.name}
                                        </option>
                                    ))}
                                </select>
                                {draftEntry.taskId != null && (
                                    <button type="button" className="selector-clear-button" onClick={() => onChange("task", "")} aria-label="Clear task">
                                        ×
                                    </button>
                                )}
                            </div>
                        </label>

                        <label className="tracking-modal-field">
                            <span>Hours</span>
                            <input
                                type="number"
                                min="0"
                                step="0.25"
                                inputMode="decimal"
                                value={draftEntry.hours}
                                onChange={event => {
                                    if (isValidHoursInput(event.target.value)) {
                                        onChange("hours", event.target.value);
                                    }
                                }}
                            />
                        </label>

                        <label className="tracking-modal-field">
                            <span>Comment</span>
                            <textarea
                                rows="4"
                                value={draftEntry.comment ?? ""}
                                onChange={event => onChange("comment", event.target.value)}
                            />
                        </label>
                    </div>
                </div>
                <div className="tracking-modal-actions">
                    <button type="submit" className="tracking-modal-button">
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
            </form>
        </div>
    );
}

export default function TimeTrackingPage({
    organizations = [],
    userSettings = { currentOrganizationId: null, dailyHoursLimit: 8 }
}) {
    const today = new Date();

    const [entries, setEntries] = useState([]);
    const [clients, setClients] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [selectedDate, setSelectedDate] = useState(formatDateKey(today));
    const [selectedEntryId, setSelectedEntryId] = useState(null);
    const [entryEditorOpen, setEntryEditorOpen] = useState(false);
    const [entryEditorMode, setEntryEditorMode] = useState(null);
    const [draftEntry, setDraftEntry] = useState(null);
    const [localIdSeed, setLocalIdSeed] = useState(1);
    const [validationDialogOpen, setValidationDialogOpen] = useState(false);
    const [validationIssues, setValidationIssues] = useState([]);
    const [apiErrorMessage, setApiErrorMessage] = useState("");
    const selectedDateRef = useRef(selectedDate);
    const cancelEntryEditRef = useRef(() => {});

    const dailyHoursLimit = Number(userSettings.dailyHoursLimit ?? 8);
    const calendarDays = buildCalendarDays(selectedMonth, selectedYear);
    const selectedMonthLabel = formatMonthYear(selectedMonth, selectedYear);
    const filteredEntries = entries.filter(entry => entry.date === selectedDate);
    const selectedEntry = filteredEntries.find(entry => sameId(entry.id, selectedEntryId));
    const currentOrganizationId = toOptionalNumber(userSettings.currentOrganizationId);

    useEffect(() => {
        let active = true;

        async function loadLookups() {
            try {
                const [nextClients, nextTasks] = await Promise.all([getClients(), getTasks()]);

                if (!active) {
                    return;
                }

                setClients(nextClients);
                setTasks(nextTasks);
                setApiErrorMessage("");
            } catch (error) {
                if (!active) {
                    return;
                }

                setApiErrorMessage(getApiErrorMessage(error, "Unable to load time tracking lookup data."));
            }
        }

        loadLookups();

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        selectedDateRef.current = selectedDate;
    }, [selectedDate]);

    useEffect(() => {
        let active = true;

        async function loadMonthEntries() {
            try {
                const nextEntries = await getTimeEntriesByMonth(selectedYear, selectedMonth);

                if (!active) {
                    return;
                }

                setEntries(nextEntries);

                const hasSelectedDate = nextEntries.some(entry => entry.date === selectedDateRef.current);
                if (!hasSelectedDate) {
                    const nextSelectedDate = nextEntries[0]?.date ?? formatDateKey(new Date(selectedYear, selectedMonth, 1));
                    setSelectedDate(nextSelectedDate);
                    setSelectedEntryId(null);
                    setEntryEditorOpen(false);
                    setEntryEditorMode(null);
                    setDraftEntry(null);
                }

                setApiErrorMessage("");
            } catch (error) {
                if (!active) {
                    return;
                }

                setApiErrorMessage(getApiErrorMessage(error, "Unable to load time entries for the selected month."));
            }
        }

        loadMonthEntries();

        return () => {
            active = false;
        };
    }, [selectedMonth, selectedYear]);

    const clearTransientMessages = () => {
        setValidationDialogOpen(false);
        setValidationIssues([]);
    };

    const loadEntriesForDate = async (date) => {
        try {
            const nextDayEntries = await getTimeEntriesByDate(date);

            setEntries(currentEntries => mergeEntriesForDate(currentEntries, date, nextDayEntries));
            setApiErrorMessage("");
        } catch (error) {
            setApiErrorMessage(getApiErrorMessage(error, "Unable to load time entries for the selected day."));
        }
    };

    const reloadMonthEntries = async (nextSelectedEntryId = selectedEntryId) => {
        const nextEntries = await getTimeEntriesByMonth(selectedYear, selectedMonth);

        setEntries(nextEntries);
        setSelectedEntryId(nextEntries.some(entry => sameId(entry.id, nextSelectedEntryId)) ? nextSelectedEntryId : null);
        setApiErrorMessage("");
        return nextEntries;
    };

    const switchToDate = (date, shouldLoadDayEntries = true) => {
        setSelectedDate(date);
        setSelectedEntryId(null);
        setEntryEditorOpen(false);
        setEntryEditorMode(null);
        setDraftEntry(null);
        clearTransientMessages();
        if (shouldLoadDayEntries) {
            void loadEntriesForDate(date);
        }
    };

    const requestDateSwitch = (nextDate, nextMonth = null, nextYear = null) => {
        if (nextDate === selectedDate && nextMonth == null && nextYear == null) {
            return;
        }

        if (nextMonth != null) {
            setSelectedMonth(nextMonth);
        }

        if (nextYear != null) {
            setSelectedYear(nextYear);
        }

        switchToDate(nextDate, nextMonth == null && nextYear == null);
    };

    const handleSelectCalendarDay = (day) => {
        if (!day?.date) {
            return;
        }

        requestDateSwitch(day.date);
    };

    const handlePreviousMonth = () => {
        const nextDate = new Date(selectedYear, selectedMonth - 1, 1);
        requestDateSwitch(formatDateKey(nextDate), nextDate.getMonth(), nextDate.getFullYear());
    };

    const handleNextMonth = () => {
        const nextDate = new Date(selectedYear, selectedMonth + 1, 1);
        requestDateSwitch(formatDateKey(nextDate), nextDate.getMonth(), nextDate.getFullYear());
    };

    const handlePreviousYear = () => {
        const nextDate = new Date(selectedYear - 1, selectedMonth, 1);
        requestDateSwitch(formatDateKey(nextDate), nextDate.getMonth(), nextDate.getFullYear());
    };

    const handleNextYear = () => {
        const nextDate = new Date(selectedYear + 1, selectedMonth, 1);
        requestDateSwitch(formatDateKey(nextDate), nextDate.getMonth(), nextDate.getFullYear());
    };

    const handleSelectEntry = (entryId) => {
        setSelectedEntryId(entryId);
    };

    const createDraftFromEntry = (entry) => ({
        ...entry,
        hours: entry.hours === 0 ? "" : String(entry.hours),
        comment: entry.comment ?? ""
    });

    const openEntryEditor = (mode, entry) => {
        setEntryEditorMode(mode);
        setDraftEntry(createDraftFromEntry(entry));
        setEntryEditorOpen(true);
        if (mode === "edit") {
            setSelectedEntryId(entry.id);
        }
        clearTransientMessages();
    };

    const handleRowEditRequest = (entryId) => {
        const targetEntry = entries.find(entry => entry.id === entryId);
        if (!targetEntry) {
            return;
        }

        openEntryEditor("edit", targetEntry);
    };

    const handleDraftEntryChange = (field, value) => {
        if (!draftEntry) {
            return;
        }

        if (field === "comment" || field === "hours") {
            setDraftEntry(current => (current ? { ...current, [field]: value } : current));
            return;
        }

        if (field === "organization") {
            if (value === "") {
                setDraftEntry(current => (current ? {
                    ...current,
                    organizationId: null,
                    organizationName: ""
                } : current));
                return;
            }

            const organizationId = toOptionalNumber(value);
            const selectedOrganization = organizations.find(organization => sameId(organization.id, organizationId));

            setDraftEntry(current => {
                if (!current) {
                    return current;
                }

                const currentClient = clients.find(client => sameId(client.id, current.clientId));
                const keepClient = currentClient && sameId(currentClient.organizationId, organizationId);

                return {
                    ...current,
                    organizationId: selectedOrganization?.id ?? null,
                    organizationName: selectedOrganization?.shortName ?? "",
                    clientId: keepClient ? current.clientId : null,
                    clientName: keepClient ? current.clientName : "",
                    taskId: keepClient ? current.taskId : null,
                    taskName: keepClient ? current.taskName : ""
                };
            });
            return;
        }

        if (field === "client") {
            if (value === "") {
                setDraftEntry(current => (current ? {
                    ...current,
                    clientId: null,
                    clientName: ""
                } : current));
                return;
            }

            const clientId = toOptionalNumber(value);
            const selectedClient = clients.find(client => sameId(client.id, clientId));

            setDraftEntry(current => (current ? {
                ...current,
                organizationId: selectedClient?.organizationId ?? current.organizationId ?? null,
                clientId: selectedClient?.id ?? null,
                clientName: selectedClient?.name ?? "",
                taskId: null,
                taskName: ""
            } : current));
            return;
        }

        if (field === "task") {
            if (value === "") {
                setDraftEntry(current => (current ? {
                    ...current,
                    taskId: null,
                    taskName: ""
                } : current));
                return;
            }

            const taskId = toOptionalNumber(value);
            const selectedTask = tasks.find(task => sameId(task.id, taskId));

            setDraftEntry(current => (current ? {
                ...current,
                organizationId: selectedTask?.organizationId ?? current.organizationId,
                taskId: selectedTask?.id ?? null,
                taskName: selectedTask?.name ?? ""
            } : current));
        }
    };

    const handleAddEntry = () => {
        const currentOrganization = organizations.find(organization => sameId(organization.id, currentOrganizationId));
        const nextEntry = createLocalWorklogEntry(selectedDate, localIdSeed, currentOrganizationId);

        openEntryEditor("add", {
            ...nextEntry,
            organizationId: currentOrganizationId,
            organizationName: currentOrganization?.shortName ?? "",
            clientName: "",
            hours: "",
            comment: "",
            modified: false
        });
    };

    const handleDeleteEntry = async (entryId) => {
        if (!entryId) {
            return;
        }

        try {
            await deleteTimeEntry(entryId);
            const nextEntries = await getTimeEntriesByMonth(selectedYear, selectedMonth);
            const remainingSameDay = nextEntries.filter(entry => entry.date === selectedDate);

            setEntries(nextEntries);
            setSelectedEntryId(remainingSameDay[0]?.id ?? null);
            setEntryEditorOpen(false);
            setEntryEditorMode(null);
            setDraftEntry(null);
            setApiErrorMessage("");
            clearTransientMessages();
        } catch (error) {
            setApiErrorMessage(getApiErrorMessage(error, "Unable to delete time entry."));
        }
    };

    const cancelEntryEdit = () => {
        setEntryEditorOpen(false);
        setEntryEditorMode(null);
        setDraftEntry(null);
        clearTransientMessages();
    };

    const validateDraftEntry = (entry, dayEntries) => {
        const entryIndex = Math.max(0, dayEntries.findIndex(dayEntry => sameId(dayEntry.id, entry.id)));
        const rowLabel = `Row ${entryIndex + 1}`;
        const issues = [];
        const hours = entry.hours === "" ? null : Number(entry.hours);

        if (entry.organizationId == null) {
            issues.push(`${rowLabel}: Organization is required.`);
        }

        if (entry.clientId == null) {
            issues.push(`${rowLabel}: Client is required.`);
        }

        if (entry.taskId == null) {
            issues.push(`${rowLabel}: Task is required.`);
        }

        const selectedClient = clients.find(client => sameId(client.id, entry.clientId));
        if (entry.clientId != null && !selectedClient) {
            issues.push(`${rowLabel}: Selected client was not found.`);
        } else if (selectedClient && !sameId(selectedClient.organizationId, entry.organizationId)) {
            issues.push(`${rowLabel}: Client does not belong to the selected organization.`);
        }

        const selectedTask = tasks.find(task => sameId(task.id, entry.taskId));
        if (entry.taskId != null && !selectedTask) {
            issues.push(`${rowLabel}: Selected task was not found.`);
        } else if (selectedTask) {
            if (!sameId(selectedTask.organizationId, entry.organizationId)) {
                issues.push(`${rowLabel}: Task does not belong to the selected organization.`);
            }

            if (!sameId(selectedTask.clientId, entry.clientId)) {
                issues.push(`${rowLabel}: Task does not belong to the selected client.`);
            }
        }

        if (hours == null) {
            issues.push(`${rowLabel}: Hours is required.`);
        } else if (!Number.isFinite(hours)) {
            issues.push(`${rowLabel}: Hours must be a number.`);
        } else if (hours <= 0) {
            issues.push(`${rowLabel}: Hours must be greater than 0.`);
        } else if (hours > dailyHoursLimit) {
            issues.push(`${rowLabel}: Hours cannot exceed ${dailyHoursLimit}.`);
        }

        return issues;
    };

    const normalizeDraftEntry = (entry) => ({
        ...entry,
        hours: Number(entry.hours),
        totalTaskHours: Number(entry.hours),
        comment: entry.comment ?? "",
        modified: false
    });

    const saveEditingEntry = async () => {
        if (!draftEntry) {
            return false;
        }

        const normalizedEntry = normalizeDraftEntry(draftEntry);
        const nextDayEntries = entryEditorMode === "add"
            ? [...filteredEntries, normalizedEntry]
            : filteredEntries.map(entry => sameId(entry.id, normalizedEntry.id) ? normalizedEntry : entry);
        const draftIssues = validateDraftEntry(draftEntry, nextDayEntries);
        if (draftIssues.length > 0) {
            setValidationIssues(draftIssues);
            setValidationDialogOpen(true);
            return false;
        }

        const validation = validateWorklogDay(nextDayEntries, dailyHoursLimit);

        if (!validation.isValid) {
            setValidationIssues(validation.issues);
            setValidationDialogOpen(true);
            return false;
        }

        try {
            const savedEntry = entryEditorMode === "add"
                ? await createTimeEntry(normalizedEntry)
                : await updateTimeEntry(normalizedEntry.id, normalizedEntry);

            await reloadMonthEntries(savedEntry.id);
            setEntryEditorOpen(false);
            setEntryEditorMode(null);
            setDraftEntry(null);

            if (entryEditorMode === "add") {
                setLocalIdSeed(currentSeed => currentSeed + 1);
            }

            clearTransientMessages();
            return true;
        } catch (error) {
            setApiErrorMessage(getApiErrorMessage(error, "Unable to save time entry."));
            return false;
        }
    };

    useEffect(() => {
        cancelEntryEditRef.current = cancelEntryEdit;
    });

    useEffect(() => {
        if (
            !entryEditorOpen ||
            validationDialogOpen
        ) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key !== "Escape") {
                return;
            }

            event.preventDefault();
            cancelEntryEditRef.current();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [entryEditorOpen, validationDialogOpen]);

    return (
        <div className="tracking-main tracking-time-tracking-main">
            <header className="tracking-topbar">
                <div className="tracking-topbar-main">
                    <div>
                        <h2>Time Tracking</h2>
                        <p>Worklog overview and monthly productivity summary</p>
                    </div>
                </div>
            </header>

            {apiErrorMessage ? (
                <div className="tracking-status-banner tracking-status-banner-error">
                    {apiErrorMessage}
                </div>
            ) : null}

            <div className="tracking-content-grid">
                <PlaceholderPanel title="Calendar" className="tracking-calendar-panel">
                    <div className="tracking-calendar-toolbar">
                        <div className="tracking-calendar-nav-group">
                            <button type="button" onClick={handlePreviousYear} aria-label="Previous year">
                                {"\u00AB"}
                            </button>
                            <button type="button" onClick={handlePreviousMonth} aria-label="Previous month">
                                {"\u2039"}
                            </button>
                        </div>
                        <div className="tracking-calendar-current">{selectedMonthLabel}</div>
                        <div className="tracking-calendar-nav-group">
                            <button type="button" onClick={handleNextMonth} aria-label="Next month">
                                {"\u203A"}
                            </button>
                            <button type="button" onClick={handleNextYear} aria-label="Next year">
                                {"\u00BB"}
                            </button>
                        </div>
                    </div>

                    <div className="tracking-mini-calendar">
                        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(day => (
                            <div key={day} className="tracking-calendar-weekday">
                                {day}
                            </div>
                        ))}

                        {calendarDays.map(day => (
                            <button
                                key={day.id}
                                type="button"
                                className={[
                                    "tracking-calendar-cell",
                                    day.isMuted ? "tracking-calendar-cell-muted" : "",
                                    day.isWeekend ? "tracking-calendar-cell-weekend" : "",
                                    day.date === selectedDate ? "tracking-calendar-cell-selected" : ""
                                ].filter(Boolean).join(" ")}
                                onClick={() => handleSelectCalendarDay(day)}
                                disabled={day.isMuted}
                            >
                                {day.label}
                            </button>
                        ))}
                    </div>
                </PlaceholderPanel>

                <div className="tracking-right-column">
                    <PlaceholderPanel title="Worklog Entries" className="tracking-worklog-panel">
                        <WorklogEntriesTable
                            key={selectedDate}
                            entries={filteredEntries}
                            organizations={organizations}
                            selectedEntryId={selectedEntryId}
                            onSelectEntry={handleSelectEntry}
                            onRequestEditEntry={handleRowEditRequest}
                            onAddEntry={handleAddEntry}
                            onDeleteEntry={handleDeleteEntry}
                        />
                    </PlaceholderPanel>

                    <PlaceholderPanel title="Comment" className="tracking-details-panel">
                        <div className="task-details-panel">
                            <div className="task-details-comment">
                                <p className="tracking-modal-text">
                                    {selectedEntry?.comment || ""}
                                </p>
                            </div>
                        </div>
                    </PlaceholderPanel>

                    <PlaceholderPanel title={`Monthly Summary — ${selectedMonthLabel}`} className="tracking-summary-panel">
                        <MonthlySummaryTable
                            entries={entries}
                            selectedMonth={selectedMonth}
                            selectedYear={selectedYear}
                        />
                    </PlaceholderPanel>
                </div>
            </div>

            {entryEditorOpen && draftEntry && (
                <WorklogEntryModal
                    mode={entryEditorMode}
                    draftEntry={draftEntry}
                    organizations={organizations}
                    clients={clients}
                    tasks={tasks}
                    onChange={handleDraftEntryChange}
                    onSave={saveEditingEntry}
                    onCancel={cancelEntryEdit}
                />
            )}

            {validationDialogOpen && (
                <div className="tracking-modal-overlay" role="presentation">
                    <div className="tracking-modal tracking-modal-confirm" role="dialog" aria-modal="true" aria-labelledby="tracking-validation-title">
                        <div className="tracking-modal-header">
                            <h3 id="tracking-validation-title">Validation errors</h3>
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
        </div>
    );
}
