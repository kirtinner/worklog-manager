import { useEffect, useRef, useState } from "react";
import MonthlySummaryTable from "../components/MonthlySummaryTable";
import TaskDetailsPanel from "../components/TaskDetailsPanel";
import WorklogEntriesTable from "../components/WorklogEntriesTable";
import { createLocalWorklogEntry } from "../utils/timeTrackingEntries";
import { buildCalendarDays, formatMonthYear } from "../utils/timeTrackingDates";
import { validateWorklogDay } from "../utils/timeTrackingValidation";
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

export default function TimeTrackingPage() {
    const today = new Date();

    const [entries, setEntries] = useState([]);
    const [clients, setClients] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [selectedDate, setSelectedDate] = useState(formatDateKey(today));
    const [selectedEntryId, setSelectedEntryId] = useState(null);
    const [dirtyDates, setDirtyDates] = useState({});
    const [localIdSeed, setLocalIdSeed] = useState(1);
    const [dailyHoursLimit, setDailyHoursLimit] = useState(16);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsDraftLimit, setSettingsDraftLimit] = useState("16");
    const [settingsError, setSettingsError] = useState("");
    const [pendingDateSelection, setPendingDateSelection] = useState(null);
    const [dateSwitchConfirmOpen, setDateSwitchConfirmOpen] = useState(false);
    const [validationDialogOpen, setValidationDialogOpen] = useState(false);
    const [validationIssues, setValidationIssues] = useState([]);
    const [commentDraft, setCommentDraft] = useState("");
    const [apiErrorMessage, setApiErrorMessage] = useState("");
    const selectedDateRef = useRef(selectedDate);

    const calendarDays = buildCalendarDays(selectedMonth, selectedYear);
    const selectedMonthLabel = formatMonthYear(selectedMonth, selectedYear);
    const filteredEntries = entries.filter(entry => entry.date === selectedDate);
    const selectedEntry = filteredEntries.find(entry => entry.id === selectedEntryId);
    const selectedDayHasUnsavedChanges = Boolean(dirtyDates[selectedDate]);

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
                    setCommentDraft("");
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

    const syncCommentDraftForEntry = (entryId, sourceEntries = entries) => {
        const nextEntry = sourceEntries.find(entry => entry.id === entryId && entry.date === selectedDate);
        setCommentDraft(nextEntry?.comment ?? "");
    };

    const commitCommentDraft = () => {
        if (!selectedEntry || commentDraft === selectedEntry.comment) {
            return;
        }

        setEntries(currentEntries =>
            currentEntries.map(entry =>
                entry.id === selectedEntry.id
                    ? { ...entry, comment: commentDraft, modified: true }
                    : entry
            )
        );
        markSelectedDayDirty();
    };

    const handleCommentChange = (nextValue) => {
        setCommentDraft(nextValue);

        if (!selectedEntry) {
            return;
        }

        markSelectedDayDirty();
    };

    const revertCommentDraft = () => {
        setCommentDraft(selectedEntry?.comment ?? "");

        const hasModifiedEntries = entries.some(
            entry => entry.date === selectedDate && entry.modified
        );

        if (!hasModifiedEntries) {
            setDirtyDates(currentDirtyDates => ({
                ...currentDirtyDates,
                [selectedDate]: false
            }));
        }
    };

    const markSelectedDayDirty = () => {
        setDirtyDates(currentDirtyDates => ({
            ...currentDirtyDates,
            [selectedDate]: true
        }));
        clearTransientMessages();
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
        setCommentDraft("");
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

    const handleSelectEntry = (entryId) => {
        setSelectedEntryId(entryId);
        syncCommentDraftForEntry(entryId);
    };

    const handleEntryHoursChange = (entryId, nextHours) => {
        setEntries(currentEntries =>
            currentEntries.map(entry =>
                entry.id === entryId
                    ? { ...entry, hours: nextHours, modified: true }
                    : entry
            )
        );
        markSelectedDayDirty();
    };

    const handleEntryMetaChange = (entryId, field, value) => {
        setEntries(currentEntries =>
            currentEntries.map(entry => {
                if (entry.id !== entryId) {
                    return entry;
                }

                if (field === "client") {
                    if (value === "") {
                        return {
                            ...entry,
                            clientId: null,
                            clientName: "New Client",
                            taskId: null,
                            taskName: "",
                            modified: true
                        };
                    }

                    const clientId = Number(value);
                    const selectedClient = clients.find(client => client.id === clientId);

                    return {
                        ...entry,
                        clientId: selectedClient?.id ?? null,
                        clientName: selectedClient?.name ?? "New Client",
                        taskId: null,
                        taskName: "",
                        modified: true
                    };
                }

                if (field === "task") {
                    if (value === "") {
                        return {
                            ...entry,
                            taskId: null,
                            taskName: "",
                            modified: true
                        };
                    }

                    const taskId = Number(value);
                    const selectedTask = tasks.find(task => task.id === taskId);
                    const taskMatchesClient =
                        entry.clientId != null && selectedTask?.clientId === entry.clientId;

                    return {
                        ...entry,
                        taskId: taskMatchesClient ? selectedTask.id : null,
                        taskName: taskMatchesClient ? selectedTask.name : "",
                        modified: true
                    };
                }

                return entry;
            })
        );
        markSelectedDayDirty();
    };

    const handleAddEntry = () => {
        const nextEntry = createLocalWorklogEntry(selectedDate, localIdSeed);

        setEntries(currentEntries => [...currentEntries, nextEntry]);
        setSelectedEntryId(nextEntry.id);
        setCommentDraft(nextEntry.comment);
        setLocalIdSeed(currentSeed => currentSeed + 1);
        markSelectedDayDirty();
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
                syncCommentDraftForEntry(nextSelection, remainingEntries);
            }
            return remainingEntries;
        });

        setSelectedEntryId(nextSelection);
        markSelectedDayDirty();
    };

    const handleSaveDay = async () => {
        let nextEntries = entries;

        if (selectedEntry && commentDraft !== selectedEntry.comment) {
            nextEntries = nextEntries.map(entry =>
                entry.id === selectedEntry.id
                    ? { ...entry, comment: commentDraft, modified: true }
                    : entry
            );
        }

        const dayEntries = nextEntries.filter(entry => entry.date === selectedDate);
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

            setDirtyDates(currentDirtyDates => ({
                ...currentDirtyDates,
                [selectedDate]: false
            }));

            if (savedEntries.length > 0) {
                const nextSelectedEntry = savedEntries[selectedDayIndex >= 0 ? selectedDayIndex : 0];
                setSelectedEntryId(nextSelectedEntry?.id ?? null);
                setCommentDraft(nextSelectedEntry?.comment ?? "");
            }

            setApiErrorMessage("");
        } catch (error) {
            setApiErrorMessage(getApiErrorMessage(error, "Unable to save time entries for the selected day."));
        }
    };

    const handleOpenSettings = () => {
        setSettingsDraftLimit(String(dailyHoursLimit));
        setSettingsError("");
        setSettingsOpen(true);
    };

    const handleApplySettings = () => {
        const parsedLimit = Number(settingsDraftLimit);

        if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
            setSettingsError("Daily hours limit must be greater than 0.");
            return;
        }

        setDailyHoursLimit(parsedLimit);
        setSettingsOpen(false);
        setSettingsError("");
    };

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
                        <button
                            type="button"
                            className="tracking-settings-button"
                            aria-label="Open time tracking settings"
                            onClick={handleOpenSettings}
                        >
                            {"\u2699"}
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
                            onSelectEntry={handleSelectEntry}
                            onEntryHoursChange={handleEntryHoursChange}
                            onEntryMetaChange={handleEntryMetaChange}
                            onAddEntry={handleAddEntry}
                            onDeleteEntry={handleDeleteEntry}
                        />
                    </PlaceholderPanel>

                    <PlaceholderPanel title="Comment" className="tracking-details-panel">
                        <TaskDetailsPanel
                            entry={selectedEntry}
                            value={commentDraft}
                            onChange={handleCommentChange}
                            onCommit={commitCommentDraft}
                            onEscape={revertCommentDraft}
                        />
                    </PlaceholderPanel>

                    <PlaceholderPanel title="Monthly Summary" className="tracking-summary-panel">
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
        </div>
    );
}
