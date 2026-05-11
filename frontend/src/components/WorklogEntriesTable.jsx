function formatHours(value) {
    return value.toFixed(2);
}

export default function WorklogEntriesTable({ entries }) {
    const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);

    return (
        <div className="worklog-table-shell">
            <div className="worklog-table-scroll">
                <table className="worklog-table">
                    <thead>
                        <tr>
                            <th>Client</th>
                            <th>Task</th>
                            <th className="worklog-number-column">Hours</th>
                            <th className="worklog-number-column">Total Task Hours</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map(entry => (
                            <tr key={entry.id}>
                                <td>
                                    <span className="worklog-client">{entry.clientName}</span>
                                </td>
                                <td>
                                    <span className="worklog-task">{entry.taskName}</span>
                                </td>
                                <td className="worklog-number-column">
                                    <span className="worklog-edit-ready">
                                        {formatHours(entry.hours)}
                                    </span>
                                </td>
                                <td className="worklog-number-column">
                                    {formatHours(entry.totalTaskHours)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan="2">Daily Total</td>
                            <td className="worklog-number-column">
                                {formatHours(totalHours)}
                            </td>
                            <td />
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
