import { useEffect, useRef, useState } from "react";
import MonthlySummaryTable from "../components/MonthlySummaryTable";
import TaskDetailsPanel from "../components/TaskDetailsPanel";
import WorklogEntriesTable from "../components/WorklogEntriesTable";
import { createLocalWorklogEntry } from "../utils/timeTrackingEntries";
import { buildCalendarDays, formatMonthYear } from "../utils/timeTrackingDates";
import { validateWorklogDay } from "../utils/timeTrackingValidation";
import { getOrganizations } from "../services/organizationsService";
import {
    getClients,
    getTasks,
    getTimeEntriesByDate,
    getTimeEntriesByMonth,
    saveTimeEntriesForDate
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

function areWorklogEntryContentsEqual(left, right) {
    if (!left || !right) {
        return false;
    }

    return left.clientId === right.clientId
        && left.taskId === right.taskId
        && Number(left.hours) === Number(right.hours)
        && (left.comment ?? "") === (right.comment ?? "");
}

function getEntryModifiedState(nextEntry, originalEntry) {
    if (!originalEntry) {
        return true;
    }

    return originalEntry.modified || !areWorklogEntryContentsEqual(nextEntry, originalEntry);
}

export default function TimeTrackingPage({ settingsOpenRequest = 0 }) {
    const today = new Date();

    const [entries, setEntries] = useState([]);
    const [clients, setClients] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [selectedDate, setSelectedDate] = useState(formatDateKey(today));
    const [selectedEntryId, setSelectedEntryId] = useState(null);
    const [editingEntryId, setEditingEntryId] = useState(null);
    const [editingOriginalEntry, setEditingOriginalEntry] = useState(null);
    const [editingEntryIsNew, setEditingEntryIsNew] = useState(false);
    const [editingFallbackSelectionId, setEditingFallbackSelectionId] = useState(null);
    const [localIdSeed, setLocalIdSeed] = useState(1);
    const [dailyHoursLimit, setDailyHoursLimit] = useState(16);
    const [organizations, setOrganizations] = useState([]);
    const [currentOrganizationId, setCurrentOrganizationId] = useState(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsDraftLimit, setSettingsDraftLimit] = useState("16");
    const [settingsDraftOrganizationId, setSettingsDraftOrganizationId] = useState("");
    const [settingsError, setSettingsError] = useState("");
    const [pendingSelectionId, setPendingSelectionId] = useState(null);
    const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
    const [pendingDateSelection, setPendingDateSelection] = useState(null);
    const [dateSwitchConfirmOpen, setDateSwitchConfirmOpen] = useState(false);
    const [validationDialogOpen, setValidationDialogOpen] = useState(false);
    const [validationIssues, setValidationIssues] = useState([]);
    const [apiErrorMessage, setApiErrorMessage] = useState("");
    const selectedDateRef = useRef(selectedDate);
    const cancelEntryEditRef = useRef(() => {});
    const settingsOpenRequestRef = useRef(settingsOpenRequest);

    const calendarDays = buildCalendarDays(selectedMonth, selectedYear);
    const selectedMonthLabel = formatMonthYear(selectedMonth, selectedYear);
    const filteredEntries = entries.filter(entry => entry.date === selectedDate);
    const selectedEntry = filteredEntries.find(entry => entry.id === selectedEntryId);
    const selectedDayHasUnsavedChanges = entries.some(entry => entry.date === selectedDate && entry.modified);
    const editingCurrentEntry = entries.find(entry => entry.id === editingEntryId) ?? null;
    const isEditingEntryDirty = Boolean(
        editingEntryId != null &&
        (editingEntryIsNew || editingOriginalEntry == null || !areWorklogEntryContentsEqual(editingCurrentEntry, editingOriginalEntry))
    );

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
        let active = true;

        async function loadOrganizations() {
            try {
                const nextOrganizations = await getOrganizations();

                if (!active) {
                    return;
                }

                setOrganizations(nextOrganizations);
                setCurrentOrganizationId(current => current ?? nextOrganizations[0]?.id ?? null);
                setSettingsDraftOrganizationId(current => current || String(nextOrganizations[0]?.id ?? ""));
            } catch (error) {
                if (!active) {
                    return;
                }

                setApiErrorMessage(getApiErrorMessage(error, "Unable to load organization lookup data."));
            }
        }

        loadOrganizations();

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
                    setEditingEntryId(null);
                    setEditingOriginalEntry(null);
                    setEditingEntryIsNew(false);
                    setEditingFallbackSelectionId(null);
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

    const switchToDate = (date, shouldLoadDayEntries = true) => {
        setSelectedDate(date);
        setSelectedEntryId(null);
        setEditingEntryId(null);
        setEditingOriginalEntry(null);
        setEditingEntryIsNew(false);
        setEditingFallbackSelectionId(null);
        setPendingSelectionId(null);
        setSwitchDialogOpen(false);
        clearTransientMessages();
        if (shouldLoadDayEntries) {
            void loadEntriesForDate(date);
        }
    };

    const requestDateSwitch = (nextDate, nextMonth = null, nextYear = null) => {
        if (nextDate === selectedDate && nextMonth == null && nextYear == null) {
            return;
        }

        if (selectedDayHasUnsavedChanges) {
            setPendingDateSelection({ date: nextDate, month: nextMonth, year: nextYear });
            setDateSwitchConfirmOpen(true);
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

    const updateEditableEntry = (entryId, updater) => {
        setEntries(currentEntries =>
            currentEntries.map(entry => {
                if (entry.id !== entryId) {
                    return entry;
                }

                const nextEntry = updater(entry);
                const modified = editingEntryIsNew
                    ? true
                    : getEntryModifiedState(nextEntry, editingOriginalEntry?.id === entryId ? editingOriginalEntry : null);

                return {
                    ...nextEntry,
                    modified
                };
            })
        );
    };

    const beginEntryEdit = (entry, previousSelectionId = entry.id, isNewEntry = false) => {
        setSelectedEntryId(entry.id);
        setEditingEntryId(entry.id);
        setEditingOriginalEntry(entry ? { ...entry } : null);
        setEditingEntryIsNew(isNewEntry);
        setEditingFallbackSelectionId(previousSelectionId);
        clearTransientMessages();
    };

    const getEditingDayEntries = (sourceEntries = entries) =>
        sourceEntries.filter(entry => entry.date === selectedDate);

    const handleSelectEntry = (entryId) => {
        if (editingEntryId != null && entryId !== editingEntryId) {
            if (isEditingEntryDirty) {
                setPendingSelectionId(entryId);
                setSwitchDialogOpen(true);
                return;
            }

            const selected = entries.find(entry => entry.id === entryId);
            if (selected) {
                setSelectedEntryId(entryId);
                setEditingEntryId(null);
                setEditingOriginalEntry(null);
                setEditingEntryIsNew(false);
                setEditingFallbackSelectionId(null);
                setPendingSelectionId(null);
                setSwitchDialogOpen(false);
                clearTransientMessages();
            }
            return;
        }

        setSelectedEntryId(entryId);
    };

    const handleRowEditRequest = (entryId) => {
        const targetEntry = entries.find(entry => entry.id === entryId);
        if (!targetEntry) {
            return;
        }

        if (editingEntryId != null && entryId === editingEntryId) {
            return;
        }

        if (editingEntryId != null && entryId !== editingEntryId) {
            if (isEditingEntryDirty) {
                setPendingSelectionId(entryId);
                setSwitchDialogOpen(true);
                return;
            }

            setSelectedEntryId(entryId);
            beginEntryEdit(targetEntry, entryId, false);
            setPendingSelectionId(null);
            setSwitchDialogOpen(false);
            return;
        }

        beginEntryEdit(targetEntry, selectedEntryId ?? entryId, false);
    };

    const handleEntryHoursChange = (entryId, nextHours) => {
        updateEditableEntry(entryId, entry => ({ ...entry, hours: nextHours }));
    };

    const handleEntryMetaChange = (entryId, field, value) => {
        updateEditableEntry(entryId, entry => {
            if (field === "comment") {
                return {
                    ...entry,
                    comment: value
                };
            }

            if (field === "client") {
                if (value === "") {
                    return {
                        ...entry,
                        clientId: null,
                        clientName: "New Client",
                        taskId: null,
                        taskName: ""
                    };
                }

                const clientId = Number(value);
                const selectedClient = clients.find(client => client.id === clientId);

                return {
                    ...entry,
                    clientId: selectedClient?.id ?? null,
                    clientName: selectedClient?.name ?? "New Client",
                    taskId: null,
                    taskName: ""
                };
            }

            if (field === "task") {
                if (value === "") {
                    return {
                        ...entry,
                        taskId: null,
                        taskName: ""
                    };
                }

                const taskId = Number(value);
                const selectedTask = tasks.find(task => task.id === taskId);
                const taskMatchesClient =
                    entry.clientId != null && selectedTask?.clientId === entry.clientId;

                return {
                    ...entry,
                    taskId: taskMatchesClient ? selectedTask.id : null,
                    taskName: taskMatchesClient ? selectedTask.name : ""
                };
            }

            return entry;
        });
    };

    const handleEntryCommentChange = (nextValue) => {
        if (!editingEntryId || selectedEntryId !== editingEntryId) {
            return;
        }

        handleEntryMetaChange(editingEntryId, "comment", nextValue);
    };

    const handleAddEntry = () => {
        const nextEntry = createLocalWorklogEntry(selectedDate, localIdSeed);

        setEntries(currentEntries => [...currentEntries, nextEntry]);
        setSelectedEntryId(nextEntry.id);
        setEditingEntryId(nextEntry.id);
        setEditingOriginalEntry({ ...nextEntry });
        setEditingEntryIsNew(true);
        setEditingFallbackSelectionId(selectedEntryId);
        setLocalIdSeed(currentSeed => currentSeed + 1);
        setPendingSelectionId(null);
        setSwitchDialogOpen(false);
        clearTransientMessages();
    };

    const handleDeleteEntry = (entryId) => {
        if (!entryId) {
            return;
        }

        let nextSelection = selectedEntryId;

        setEntries(currentEntries => {
            const remainingEntries = currentEntries.filter(entry => entry.id !== entryId);
            if (selectedEntryId === entryId) {
                const remainingSameDay = remainingEntries.filter(entry => entry.date === selectedDate);
                nextSelection = remainingSameDay[0]?.id ?? null;
            }
            return remainingEntries;
        });

        setSelectedEntryId(nextSelection);
        if (editingEntryId === entryId) {
            setEditingEntryId(null);
            setEditingOriginalEntry(null);
            setEditingEntryIsNew(false);
            setEditingFallbackSelectionId(null);
        }

        clearTransientMessages();
    };

    const resolveEntrySelectionAfterDiscard = () => {
        if (editingFallbackSelectionId != null && entries.some(entry => entry.id === editingFallbackSelectionId)) {
            return editingFallbackSelectionId;
        }

        return entries.find(entry => entry.date === selectedDate && entry.id !== editingEntryId)?.id ?? null;
    };

    const cancelEntryEdit = () => {
        if (!editingEntryId) {
            return;
        }

        const currentEditingId = editingEntryId;
        const originalEntry = editingOriginalEntry;

        if (editingEntryIsNew) {
            setEntries(currentEntries => currentEntries.filter(entry => entry.id !== currentEditingId));
        } else {
            setEntries(currentEntries =>
                currentEntries.map(entry =>
                    entry.id === currentEditingId
                        ? { ...originalEntry }
                        : entry
                )
            );
        }

        setSelectedEntryId(resolveEntrySelectionAfterDiscard());
        setEditingEntryId(null);
        setEditingOriginalEntry(null);
        setEditingEntryIsNew(false);
        setEditingFallbackSelectionId(null);
        setPendingSelectionId(null);
        setSwitchDialogOpen(false);
        clearTransientMessages();
    };

    const saveEditingEntry = () => {
        if (!editingEntryId) {
            return true;
        }

        const dayEntries = getEditingDayEntries();
        const validation = validateWorklogDay(dayEntries, dailyHoursLimit);

        if (!validation.isValid) {
            setValidationIssues(validation.issues);
            setValidationDialogOpen(true);
            return false;
        }

        setEditingEntryId(null);
        setEditingOriginalEntry(null);
        setEditingEntryIsNew(false);
        setEditingFallbackSelectionId(null);
        clearTransientMessages();
        return true;
    };

    const handleSaveDay = async () => {
        const dayEntries = getEditingDayEntries();
        const validation = validateWorklogDay(dayEntries, dailyHoursLimit);

        if (!validation.isValid) {
            setValidationIssues(validation.issues);
            setValidationDialogOpen(true);
            return;
        }

        const selectedDayIndex = dayEntries.findIndex(entry => entry.id === selectedEntry?.id);

        try {
            const savedEntries = await saveTimeEntriesForDate(selectedDate, dayEntries);

            setEntries(currentEntries =>
                mergeEntriesForDate(
                    currentEntries,
                    selectedDate,
                    savedEntries.map(entry => ({
                        ...entry,
                        modified: false
                    }))
                )
            );

            setEditingEntryId(null);
            setEditingOriginalEntry(null);
            setEditingEntryIsNew(false);
            setEditingFallbackSelectionId(null);
            setPendingSelectionId(null);
            setSwitchDialogOpen(false);

            if (savedEntries.length > 0) {
                const nextSelectedEntry = savedEntries[selectedDayIndex >= 0 ? selectedDayIndex : 0];
                setSelectedEntryId(nextSelectedEntry?.id ?? null);
            }

            setApiErrorMessage("");
        } catch (error) {
            setApiErrorMessage(getApiErrorMessage(error, "Unable to save time entries for the selected day."));
        }
    };

    const handleApplySettings = () => {
        const parsedLimit = Number(settingsDraftLimit);

        if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
            setSettingsError("Daily hours limit must be greater than 0.");
            return;
        }

        setDailyHoursLimit(parsedLimit);
        if (settingsDraftOrganizationId !== "") {
            setCurrentOrganizationId(Number(settingsDraftOrganizationId));
        }
        setSettingsOpen(false);
        setSettingsError("");
    };

    useEffect(() => {
        if (settingsOpenRequest === settingsOpenRequestRef.current) {
            return;
        }

        settingsOpenRequestRef.current = settingsOpenRequest;
        setSettingsDraftLimit(String(dailyHoursLimit));
        setSettingsDraftOrganizationId(String(currentOrganizationId ?? organizations[0]?.id ?? ""));
        setSettingsError("");
        setSettingsOpen(true);
    }, [currentOrganizationId, dailyHoursLimit, organizations, settingsOpenRequest]);

    const handleConfirmDateSwitch = () => {
        if (!pendingDateSelection) {
            setDateSwitchConfirmOpen(false);
            return;
        }

        if (pendingDateSelection.month != null) {
            setSelectedMonth(pendingDateSelection.month);
        }

        if (pendingDateSelection.year != null) {
            setSelectedYear(pendingDateSelection.year);
        }

        switchToDate(
            pendingDateSelection.date,
            pendingDateSelection.month == null && pendingDateSelection.year == null
        );
        setPendingDateSelection(null);
        setDateSwitchConfirmOpen(false);
    };

    const handleCancelDateSwitch = () => {
        setPendingDateSelection(null);
        setDateSwitchConfirmOpen(false);
    };

    const handleSaveFromRowSwitchDialog = () => {
        if (saveEditingEntry()) {
            setEditingEntryId(null);
            setEditingOriginalEntry(null);
            setEditingEntryIsNew(false);
            setEditingFallbackSelectionId(null);
            setSelectedEntryId(pendingSelectionId);
            setPendingSelectionId(null);
            setSwitchDialogOpen(false);
        }
    };

    const handleDiscardFromRowSwitchDialog = () => {
        if (!editingEntryId) {
            setPendingSelectionId(null);
            setSwitchDialogOpen(false);
            return;
        }

        const currentEditingId = editingEntryId;
        const originalEntry = editingOriginalEntry;

        if (editingEntryIsNew) {
            setEntries(currentEntries => currentEntries.filter(entry => entry.id !== currentEditingId));
        } else {
            setEntries(currentEntries =>
                currentEntries.map(entry =>
                    entry.id === currentEditingId
                        ? { ...originalEntry }
                        : entry
                )
            );
        }

        setEditingEntryId(null);
        setEditingOriginalEntry(null);
        setEditingEntryIsNew(false);
        setEditingFallbackSelectionId(null);
        setSelectedEntryId(pendingSelectionId);
        setPendingSelectionId(null);
        setSwitchDialogOpen(false);
    };

    const handleStayEditing = () => {
        setPendingSelectionId(null);
        setSwitchDialogOpen(false);
    };

    useEffect(() => {
        cancelEntryEditRef.current = cancelEntryEdit;
    });

    useEffect(() => {
        if (
            editingEntryId == null ||
            settingsOpen ||
            validationDialogOpen ||
            dateSwitchConfirmOpen ||
            switchDialogOpen
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
    }, [
        dateSwitchConfirmOpen,
        editingEntryId,
        settingsOpen,
        switchDialogOpen,
        validationDialogOpen
    ]);

    return (
        <div className="tracking-main tracking-time-tracking-main" data-dirty={selectedDayHasUnsavedChanges ? "true" : "false"}>
            <header className="tracking-topbar">
                <div className="tracking-topbar-main">
                    <div>
                        <h2>Time Tracking</h2>
                        <p>Worklog overview and monthly productivity summary</p>
                    </div>
                    <div className="tracking-topbar-actions">
                        <div
                            className={[
                                "tracking-save-status",
                                selectedDayHasUnsavedChanges ? "tracking-save-status-dirty" : ""
                            ].filter(Boolean).join(" ")}
                        >
                            {selectedDayHasUnsavedChanges ? "Unsaved changes" : "Saved"}
                        </div>
                        <button
                            type="button"
                            className="tracking-save-button"
                            onClick={handleSaveDay}
                            disabled={!selectedDayHasUnsavedChanges}
                        >
                            Save
                        </button>
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
                            clients={clients}
                            tasks={tasks}
                            selectedEntryId={selectedEntryId}
                            editingEntryId={editingEntryId}
                            onSelectEntry={handleSelectEntry}
                            onRequestEditEntry={handleRowEditRequest}
                            onEntryHoursChange={handleEntryHoursChange}
                            onEntryMetaChange={handleEntryMetaChange}
                            onAddEntry={handleAddEntry}
                            onDeleteEntry={handleDeleteEntry}
                            onSaveEntryEdit={saveEditingEntry}
                            onCancelEntryEdit={cancelEntryEdit}
                        />
                    </PlaceholderPanel>

                    <PlaceholderPanel title="Comment" className="tracking-details-panel">
                        <TaskDetailsPanel
                            entry={selectedEntry}
                            value={selectedEntry?.comment ?? ""}
                            disabled={editingEntryId == null || selectedEntryId !== editingEntryId}
                            onChange={handleEntryCommentChange}
                            onCommit={() => {}}
                            onEscape={cancelEntryEdit}
                        />
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

            {settingsOpen && (
                <div className="tracking-modal-overlay" role="presentation">
                    <div className="tracking-modal" role="dialog" aria-modal="true" aria-labelledby="tracking-settings-title">
                        <div className="tracking-modal-header">
                            <h3 id="tracking-settings-title">Settings</h3>
                        </div>
                        <div className="tracking-modal-body">
                            <div className="tracking-modal-fields">
                                <label className="tracking-modal-field">
                                    <span>Daily hours limit</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.25"
                                        value={settingsDraftLimit}
                                        onChange={event => setSettingsDraftLimit(event.target.value)}
                                    />
                                </label>
                                <label className="tracking-modal-field">
                                    <span>Current Organization</span>
                                    <select
                                        value={settingsDraftOrganizationId}
                                        onChange={event => setSettingsDraftOrganizationId(event.target.value)}
                                    >
                                        <option value="">Select organization</option>
                                        {organizations.map(organization => (
                                            <option key={organization.id} value={String(organization.id)}>
                                                {organization.shortName} - {organization.fullName}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            {settingsError ? (
                                <div className="tracking-modal-error">{settingsError}</div>
                            ) : null}
                        </div>
                        <div className="tracking-modal-actions">
                            <button type="button" className="tracking-modal-button" onClick={handleApplySettings}>
                                Apply
                            </button>
                            <button
                                type="button"
                                className="tracking-modal-button tracking-modal-button-secondary"
                                onClick={() => {
                                    setSettingsOpen(false);
                                    setSettingsError("");
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
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

            {dateSwitchConfirmOpen && (
                <div className="tracking-modal-overlay" role="presentation">
                    <div className="tracking-modal tracking-modal-confirm" role="dialog" aria-modal="true" aria-labelledby="tracking-confirm-title">
                        <div className="tracking-modal-header">
                            <h3 id="tracking-confirm-title">Unsaved changes</h3>
                        </div>
                        <div className="tracking-modal-body">
                            <p className="tracking-modal-text">
                                Есть несохраненные изменения за текущий день. Переключиться на другую дату без сохранения?
                            </p>
                        </div>
                        <div className="tracking-modal-actions">
                            <button type="button" className="tracking-modal-button" onClick={handleConfirmDateSwitch}>
                                Переключиться
                            </button>
                            <button
                                type="button"
                                className="tracking-modal-button tracking-modal-button-secondary"
                                onClick={handleCancelDateSwitch}
                            >
                                Остаться
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {switchDialogOpen && (
                <div className="tracking-modal-overlay" role="presentation">
                    <div className="tracking-modal tracking-modal-confirm" role="dialog" aria-modal="true" aria-labelledby="tracking-row-switch-title">
                        <div className="tracking-modal-header">
                            <h3 id="tracking-row-switch-title">Unsaved changes</h3>
                        </div>
                        <div className="tracking-modal-body">
                            <p className="tracking-modal-text">
                                There are unsaved changes for the current worklog row. What do you want to do?
                            </p>
                        </div>
                        <div className="tracking-modal-actions">
                            <button type="button" className="tracking-modal-button" onClick={handleSaveFromRowSwitchDialog}>
                                Save changes
                            </button>
                            <button type="button" className="tracking-modal-button" onClick={handleDiscardFromRowSwitchDialog}>
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
