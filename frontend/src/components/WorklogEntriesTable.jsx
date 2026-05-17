function formatHours(value) {
    return value.toFixed(2);
}

function isValidHoursInput(value) {
    return value === "" || /^\d*\.?\d*$/.test(value);
}

export default function WorklogEntriesTable({
    entries,
    selectedEntryId,
    editingEntryId,
    onSelectEntry,
    onRequestEditEntry,
    onEntryHoursChange,
    onEntryMetaChange,
    onAddEntry,
    onDeleteEntry,
    onSaveEntryEdit,
    onCancelEntryEdit,
    clients = [],
    tasks = [],
    validationErrorIds = [],
    hasDailyLimitViolation = false
}) {
    const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);

    const isEditMode = editingEntryId != null;

    const selectEntry = (entry) => {
        onSelectEntry(entry.id);
    };

    const handleClientChange = (entryId, value) => {
        onEntryMetaChange(entryId, "client", value);
    };

    const handleTaskChange = (entryId, value) => {
        onEntryMetaChange(entryId, "task", value);
    };

    const renderReadOnlyCell = (value, className = "") => (
        <span className={["worklog-readonly-cell", className].filter(Boolean).join(" ")}>
            {value}
        </span>
    );

    return (
        <div className="worklog-table-shell">
            <div className="worklog-toolbar">
                <div className="worklog-toolbar-title">Entries</div>
                <div className="worklog-toolbar-actions">
                    {isEditMode ? (
                        <>
                            <button type="button" className="worklog-toolbar-add" onClick={onSaveEntryEdit}>
                                Save
                            </button>
                            <button type="button" className="worklog-toolbar-secondary" onClick={onCancelEntryEdit}>
                                Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            <button type="button" className="worklog-toolbar-add" onClick={onAddEntry}>
                                Add
                            </button>
                            <button
                                type="button"
                                className="worklog-toolbar-edit"
                                onClick={() => selectedEntryId && onRequestEditEntry(selectedEntryId)}
                                disabled={!selectedEntryId}
                            >
                                Edit
                            </button>
                            <button
                                type="button"
                                className="worklog-toolbar-delete worklog-toolbar-delete-separated"
                                onClick={() => onDeleteEntry(selectedEntryId)}
                                disabled={!selectedEntryId}
                            >
                                Delete
                            </button>
                        </>
                    )}
                </div>
            </div>
            <div className="worklog-table-scroll">
                <table className="worklog-table">
                    <colgroup>
                        <col className="worklog-col-client" />
                        <col className="worklog-col-task" />
                        <col className="worklog-col-hours" />
                        <col className="worklog-col-total" />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Client</th>
                            <th>Task</th>
                            <th className="worklog-number-column">Hours</th>
                            <th className="worklog-number-column">Total Task Hours</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map(entry => {
                            const isEditing = editingEntryId === entry.id;
                            const isSelected = selectedEntryId === entry.id;
                            const hasValidationError = validationErrorIds.includes(entry.id);
                            const availableTasks = entry.clientId == null
                                ? []
                                : tasks.filter(task => task.clientId === entry.clientId);

                            return (
                                <tr
                                    key={entry.id}
                                    className={[
                                        isSelected ? "worklog-row-selected" : "",
                                        isEditing ? "worklog-row-editing" : "",
                                        hasValidationError ? "worklog-row-validation-error" : ""
                                    ].filter(Boolean).join(" ")}
                                    onClick={() => selectEntry(entry)}
                                    onDoubleClick={() => onRequestEditEntry(entry.id)}
                                >
                                    <td>
                                        {isEditing ? (
                                            <select
                                                className="worklog-inline-select"
                                                value={String(entry.clientId ?? "")}
                                                onChange={event => handleClientChange(entry.id, event.target.value)}
                                                onClick={event => event.stopPropagation()}
                                            >
                                                <option value="">Select client</option>
                                                {clients.map(client => (
                                                    <option key={client.id} value={String(client.id)}>
                                                        {client.name}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            renderReadOnlyCell(entry.clientName)
                                        )}
                                    </td>
                                    <td>
                                        {isEditing ? (
                                            <select
                                                className="worklog-inline-select"
                                                value={String(entry.taskId ?? "")}
                                                disabled={entry.clientId == null || availableTasks.length === 0}
                                                onChange={event => handleTaskChange(entry.id, event.target.value)}
                                                onClick={event => event.stopPropagation()}
                                            >
                                                <option value="">Select task</option>
                                                {availableTasks.map(task => (
                                                    <option key={task.id} value={String(task.id)}>
                                                        {task.name}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            renderReadOnlyCell(entry.taskName || "")
                                        )}
                                    </td>
                                    <td className="worklog-number-column">
                                        {isEditing ? (
                                            <input
                                                className="worklog-hours-input"
                                                value={entry.hours === 0 ? "" : String(entry.hours)}
                                                onChange={event => {
                                                    if (!isValidHoursInput(event.target.value)) {
                                                        return;
                                                    }

                                                    if (event.target.value === "") {
                                                        onEntryHoursChange(entry.id, 0);
                                                        return;
                                                    }

                                                    const parsedHours = Number(event.target.value);
                                                    if (!Number.isNaN(parsedHours)) {
                                                        onEntryHoursChange(entry.id, parsedHours);
                                                    }
                                                }}
                                                onClick={event => event.stopPropagation()}
                                                inputMode="decimal"
                                            />
                                        ) : (
                                            renderReadOnlyCell(formatHours(entry.hours))
                                        )}
                                    </td>
                                    <td className="worklog-number-column">
                                        {renderReadOnlyCell(formatHours(entry.totalTaskHours))}
                                    </td>
                                </tr>
                            );
                        })}
                        <tr className="worklog-spacer-row" aria-hidden="true">
                            <td colSpan="4" />
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr className={hasDailyLimitViolation ? "worklog-footer-limit-error" : ""}>
                            <td>Daily Total</td>
                            <td />
                            <td className="worklog-number-column">
                                {formatHours(totalHours)}
                            </td>
                            <td className="worklog-number-column" />
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
